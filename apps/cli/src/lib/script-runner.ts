/**
 * Script runner: Proxy-based BrowserSDK for multi-step browser automation scripts.
 *
 * Scripts are ES modules that export a default async function receiving a `browser` SDK object.
 * Each `browser.xxx(params)` call dispatches the corresponding action through the existing
 * CLI → Daemon → Extension pipeline.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { format } from 'node:util';
import type {
  ActionParamsMap,
  ActionResultMap,
  ActionType,
  ConsoleEntry,
} from '@browser-cli/shared';
import { SocketClient } from '../client/socket-client.js';
import { ensureDaemon } from '../daemon/process.js';
import { getSocketPath } from '../util/paths.js';

// ─── Types ──────────────────────────────────────────────────────────

/** The Proxy-based SDK passed to user scripts. */
export type BrowserSDK = {
  [A in ActionType]: (params?: ActionParamsMap[A]) => Promise<ActionResultMap[A]>;
};

export interface ScriptOptions {
  sessionId?: string;
  tabId?: number;
  timeout?: number;
  /** Raw args passed after `--`, parsed into key-value pairs for the script. */
  scriptArgs?: Record<string, string | boolean>;
  /** Named export to call (default: 'default') */
  call?: string;
  /** If true, list all exported functions instead of running */
  list?: boolean;
}

// ─── Error ──────────────────────────────────────────────────────────

/** Error with step context for structured error reporting. */
export class ScriptStepError extends Error {
  constructor(
    public readonly action: string,
    public readonly params: unknown,
    public readonly stepIndex: number,
    public readonly cause: unknown,
  ) {
    const errMsg =
      cause && typeof cause === 'object' && 'message' in cause
        ? (cause as { message: string }).message
        : String(cause);
    super(`Step ${stepIndex} (${action}) failed: ${errMsg}`);
    this.name = 'ScriptStepError';
  }
}

// ─── Logging ────────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const MAGENTA = '\x1b[35m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

const LEVEL_STYLE: Record<string, string> = {
  log: MAGENTA,
  info: MAGENTA,
  warn: YELLOW,
  error: RED,
  debug: DIM,
};

/** Print a single log line to stderr with level-aware formatting. */
function writeLog(level: string, ...args: unknown[]): void {
  const ts = DIM + new Date().toLocaleTimeString() + RESET;
  const style = LEVEL_STYLE[level] ?? MAGENTA;
  const prefix = level === 'log' || level === 'info' ? '▸' : level;
  const msg = args.length === 1 && typeof args[0] === 'string' ? args[0] : format(...args);
  process.stderr.write(`${ts} ${style}${prefix}${RESET} ${msg}\n`);
}

/** Print captured console entries (from evaluate) to stderr. */
export function printConsoleLogs(logs: ConsoleEntry[]): void {
  for (const entry of logs) {
    const ts = DIM + new Date(entry.timestamp).toLocaleTimeString() + RESET;
    const style = LEVEL_STYLE[entry.level] ?? MAGENTA;
    const prefix = entry.level === 'log' || entry.level === 'info' ? '▸' : entry.level;
    const msg = entry.args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    process.stderr.write(`${ts} ${style}${prefix}${RESET} ${msg}\n`);
  }
}

// ─── SDK Factory ────────────────────────────────────────────────────

function createBrowserSDK(client: SocketClient, options: ScriptOptions): BrowserSDK {
  let stepIndex = 0;

  return new Proxy({} as BrowserSDK, {
    get(_target, prop) {
      // Guard: symbols, Promise thenable check, and JSON serialization
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'toJSON') return undefined;

      const action = prop;
      return async (params: Record<string, unknown> = {}) => {
        stepIndex++;
        const response = await client.sendCommand(
          { action: action as ActionType, params } as never,
          { tabId: options.tabId, sessionId: options.sessionId, timeout: options.timeout },
        );
        if (!response.success) {
          throw new ScriptStepError(action, params, stepIndex, response.error);
        }

        // Print console logs captured during evaluate (streamed to stderr)
        const data = response.data as Record<string, unknown> | undefined;
        if (data?.logs && Array.isArray(data.logs)) {
          printConsoleLogs(data.logs as ConsoleEntry[]);
          delete data.logs;
        }

        // evaluate returns { value: string } — auto-unwrap and try JSON.parse
        if (action === 'evaluate' && data && 'value' in data) {
          const raw = data.value as string;
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return raw;
          }
        }

        return response.data;
      };
    },
  });
}

// ─── Script Runner ──────────────────────────────────────────────────

/** List all exported function names from a script module. */
function listExportedFunctions(mod: Record<string, unknown>): string[] {
  return Object.entries(mod)
    .filter(([, v]) => typeof v === 'function')
    .map(([name]) => name);
}

export async function runScript(scriptPath: string, options: ScriptOptions = {}): Promise<unknown> {
  const absPath = resolve(scriptPath);
  if (!existsSync(absPath)) {
    throw new Error(`Script not found: ${absPath}`);
  }

  // --list mode: import module and list exported functions (no daemon needed)
  if (options.list) {
    const mod = (await import(pathToFileURL(absPath).href)) as Record<string, unknown>;
    return listExportedFunctions(mod);
  }

  // Ensure daemon is running
  await ensureDaemon();

  // Connect socket (persistent for all commands in the script)
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
    throw new Error(
      `Failed to connect to daemon: ${lastConnectErr.message}\nIs the daemon running? Try: browser-cli start`,
    );
  }

  // Override console.log/warn/info/debug → stderr with prefix during script execution.
  // NOTE: console.error is NOT overridden — the internal `logger` uses it as transport.
  const origLog = console.log;
  const origWarn = console.warn;
  const origInfo = console.info;
  const origDebug = console.debug;
  console.log = (...args: unknown[]) => writeLog('log', ...args);
  console.info = (...args: unknown[]) => writeLog('info', ...args);
  console.warn = (...args: unknown[]) => writeLog('warn', ...args);
  console.debug = (...args: unknown[]) => writeLog('debug', ...args);

  try {
    const browser = createBrowserSDK(client, options);

    // Import user script as ES module
    const mod = (await import(pathToFileURL(absPath).href)) as Record<string, unknown>;

    const exportName = options.call ?? 'default';
    const fn = mod[exportName];
    if (typeof fn !== 'function') {
      const available = listExportedFunctions(mod);
      throw new Error(
        `Export "${exportName}" is not a function in ${scriptPath}\n` +
          `Available functions: ${available.join(', ') || '(none)'}\n` +
          `Hint: use --list to see all exported functions`,
      );
    }

    const args = options.scriptArgs ?? {};
    return await (
      fn as (browser: BrowserSDK, args: Record<string, string | boolean>) => Promise<unknown>
    )(browser, args);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.info = origInfo;
    console.debug = origDebug;
    client.disconnect();
  }
}
