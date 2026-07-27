/**
 * Shared utilities for CLI commands.
 * Handles connecting to daemon, sending commands, and formatting output.
 */

import type { Command } from 'commander';
import type {
  ActionResultMap,
  ActionType,
  Command as BrowserCommand,
  ErrorCode,
  ProtocolError,
} from '@browser-cli/shared';
import {
  BrowserCliError,
  exitCodeFor,
  normalizeError,
  socketTimeoutFor,
} from '@browser-cli/shared';
import { SocketClient } from '../client/socket-client.js';
import { ensureDaemon } from '../daemon/process.js';
import { getSocketPath } from '../util/paths.js';
import { logger } from '../util/logger.js';
import { canPromptConfirm, checkAction, describeCommand, promptConfirm } from '../lib/policy.js';

/**
 * Batch/repl mode: many commands share one daemon connection inside one
 * process, so nothing may call process.exit and nothing may print its own
 * JSON envelope — the driver collects results and emits NDJSON itself.
 */
export interface BatchContext {
  client: SocketClient;
  sessionId?: string;
  tabId?: number;
  /** Response of the most recent sendCommand, for the driver's NDJSON line. */
  lastData?: unknown;
}

let batchContext: BatchContext | null = null;

export function setBatchContext(ctx: BatchContext | null): void {
  batchContext = ctx;
}

export function getBatchContext(): BatchContext | null {
  return batchContext;
}

/**
 * Render a structured error for a human or an agent reading stderr:
 *   ✗ Error [ELEMENT_OCCLUDED]: <message>
 *     hint: <what to do next>
 */
export function printProtocolError(error: ProtocolError | undefined): void {
  const normalized = normalizeError(error ?? { message: 'Unknown error' });
  logger.error(`Error [${normalized.code}]: ${normalized.message}`);
  if (normalized.hint) logger.error(`  hint: ${normalized.hint}`);
  if (normalized.stack) logger.error(normalized.stack);
}

/**
 * Abort the current command with a structured error.
 *
 * Honours --json (emits the same `{success:false,error:{code,message,hint}}`
 * envelope as a daemon-side failure) and exits with the code's exit class.
 * Inside batch/repl it throws instead, so the driver can report the failure
 * and move on to the next line.
 */
export function fail(cmd: Command, code: ErrorCode, message: string, hint?: string): never {
  if (batchContext) throw new BrowserCliError(code, message, hint);

  const error = hint ? { code, message, hint } : { code, message };
  if (getRootOpts(cmd).json) {
    console.log(JSON.stringify({ success: false, error }, null, 2));
  } else {
    printProtocolError(error);
  }
  process.exit(exitCodeFor(code));
}

/** Parse an integer option, failing with INVALID_ARGS when it is not one. */
export function requireInt(
  cmd: Command,
  value: string | undefined,
  flag: string,
  opts?: { min?: number },
): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  const min = opts?.min ?? 0;
  if (!Number.isInteger(n) || n < min) {
    fail(
      cmd,
      'INVALID_ARGS',
      `${flag} requires an integer >= ${min}, got: ${value}`,
      `Pass a numeric value, e.g. ${flag} ${min + 1}.`,
    );
  }
  return n;
}

export interface TargetOptions {
  first?: boolean;
  last?: boolean;
  nth?: number;
  force?: boolean;
}

export type Position = { type: 'first' | 'last' | 'nth'; index?: number } | undefined;

/**
 * Which match to act on when a selector is ambiguous. Without one of these,
 * an ambiguous selector fails with MULTIPLE_MATCHES rather than guessing.
 */
export function addPositionOptions(command: Command): Command {
  return command
    .option('--first', 'Target the first matching element')
    .option('--last', 'Target the last matching element')
    .option('--nth <n>', 'Target the nth matching element (1-based)', (v: string) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1) throw new Error(`--nth requires a positive integer, got: ${v}`);
      return n;
    });
}

/** Position options plus the escape hatch for the actionability checks. */
export function addTargetOptions(command: Command): Command {
  return addPositionOptions(command).option('--force', 'Skip the disabled and occlusion checks');
}

export function positionFrom(opts: TargetOptions): Position {
  if (opts.first) return { type: 'first' };
  if (opts.last) return { type: 'last' };
  if (opts.nth !== undefined) return { type: 'nth', index: opts.nth };
  return undefined;
}

/** Get root program options */
export function getRootOpts(cmd: Command): { session?: string; tab?: string; json?: boolean } {
  // Walk up to root
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts();
}

/**
 * Apply the action policy before anything leaves the process.
 *
 * This is a CLI-side guard rail only: the daemon does not re-check, so a
 * client that speaks to the socket directly is not bound by it.
 */
async function enforcePolicy(cmd: Command, command: BrowserCommand): Promise<void> {
  const verdict = checkAction(command.action);
  if (verdict.decision === 'allow') return;

  const summary = describeCommand(command.action, command.params);
  const source = verdict.rule ? `deny rule "${verdict.rule}"` : 'the policy default';

  if (verdict.decision === 'deny') {
    fail(
      cmd,
      'POLICY_DENIED',
      `Action '${command.action}' is blocked by the active policy (${source}): ${summary}`,
      `Move '${command.action}' to the policy's "allow" list, or run without --policy / BROWSER_CLI_POLICY.`,
    );
  }

  if (batchContext || !canPromptConfirm()) {
    fail(
      cmd,
      'POLICY_DENIED',
      `Action '${command.action}' needs interactive confirmation, which is unavailable here: ${summary}`,
      batchContext
        ? `Confirmation cannot be collected inside batch/repl — pre-approve '${command.action}' in the policy's "allow" list.`
        : `Run it from a TTY, or move '${command.action}' to the policy's "allow" list.`,
    );
  }

  const approved = await promptConfirm(`Policy confirm — run "${summary}"? [y/N] `);
  if (!approved) {
    fail(
      cmd,
      'POLICY_DENIED',
      `Action '${command.action}' was declined at the confirmation prompt: ${summary}`,
      `Answer "y" to proceed, or move '${command.action}' to the policy's "allow" list to stop being asked.`,
    );
  }
}

/**
 * Send a command to the daemon and return the result data.
 * Handles daemon auto-start, connection, error display.
 */
export async function sendCommand<A extends ActionType>(
  cmd: Command,
  command: BrowserCommand & { action: A },
  options?: { tabId?: number; skipJson?: boolean },
): Promise<ActionResultMap[A] | null> {
  const rootOpts = getRootOpts(cmd);

  await enforcePolicy(cmd, command);

  // Batch/repl: reuse the driver's already-open connection and let it own
  // both the output and the failure handling.
  if (batchContext) {
    const response = await batchContext.client.sendCommand(command, {
      tabId: options?.tabId ?? batchContext.tabId,
      sessionId: batchContext.sessionId,
      timeout: socketTimeoutFor(command) + 5_000,
    });
    if (!response.success) {
      const err = normalizeError(response.error ?? { message: 'Unknown error' });
      throw new BrowserCliError(err.code, err.message, err.hint, err.stack);
    }
    batchContext.lastData = response.data;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- data may be undefined at runtime even on success
    return (response.data as ActionResultMap[A]) ?? ({} as ActionResultMap[A]);
  }

  // Ensure daemon is running
  try {
    await ensureDaemon();
  } catch (err) {
    fail(
      cmd,
      'EXTENSION_NOT_CONNECTED',
      `Failed to start daemon: ${(err as Error).message}`,
      'Start it manually with: browser-cli start',
    );
  }

  // Connect to daemon with retry (daemon may still be starting up)
  const client = new SocketClient();
  const socketPath = getSocketPath();
  const connectDeadline = Date.now() + 5000;
  let lastConnectErr: Error | undefined;
  while (Date.now() < connectDeadline) {
    try {
      await client.connect(socketPath);
      lastConnectErr = undefined;
      break;
    } catch (err) {
      lastConnectErr = err as Error;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  if (lastConnectErr) {
    fail(
      cmd,
      'EXTENSION_NOT_CONNECTED',
      `Failed to connect to daemon: ${lastConnectErr.message}`,
      'Is the daemon running? Try: browser-cli start',
    );
  }

  try {
    // Command-level tabId takes precedence over global --tab option
    let tabId = options?.tabId;
    if (tabId == null && rootOpts.tab) {
      tabId = Number(rootOpts.tab);
      if (Number.isNaN(tabId)) {
        client.disconnect();
        fail(
          cmd,
          'INVALID_ARGS',
          `Invalid --tab value "${rootOpts.tab}" — must be a numeric tab ID`,
          "Run 'tab list' to see the open tab IDs.",
        );
      }
    }
    const response = await client.sendCommand(command, {
      tabId,
      sessionId: rootOpts.session,
      // Give the daemon room to answer past the command's own timeout, so a
      // long `--timeout` is not cut short by the transport.
      timeout: socketTimeoutFor(command) + 5_000,
    });

    if (rootOpts.json && !options?.skipJson) {
      // The daemon's correlation id is transport bookkeeping — not part of
      // the contract an agent consumes.
      const envelope: { success: boolean; data?: unknown; error?: ProtocolError } = {
        success: response.success,
      };
      if (response.data !== undefined) envelope.data = response.data;
      if (response.error) envelope.error = normalizeError(response.error);
      console.log(JSON.stringify(envelope, null, 2));
      client.disconnect();
      process.exit(response.success ? 0 : exitCodeFor(envelope.error?.code));
    }

    if (!response.success) {
      printProtocolError(response.error);
      process.exit(exitCodeFor(response.error?.code));
    }

    // Surface capability/degradation warnings (unsupported option, page never
    // settled) as a yellow ⚠ on stderr; the command still succeeded, so stdout
    // still gets its normal result.
    const warningMsg = (response.data as Record<string, unknown> | undefined)?.warning;
    if (typeof warningMsg === 'string') {
      logger.warn(warningMsg);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- data may be undefined at runtime even on success
    return (response.data as ActionResultMap[A]) ?? ({} as ActionResultMap[A]);
  } finally {
    client.disconnect();
  }
}
