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
import type { ActionParamsMap, ActionResultMap, ActionType } from '@browser-cli/shared';
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
        return response.data;
      };
    },
  });
}

// ─── Script Runner ──────────────────────────────────────────────────

export async function runScript(scriptPath: string, options: ScriptOptions = {}): Promise<unknown> {
  const absPath = resolve(scriptPath);
  if (!existsSync(absPath)) {
    throw new Error(`Script not found: ${absPath}`);
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

  try {
    const browser = createBrowserSDK(client, options);

    // Import user script as ES module
    const mod = (await import(pathToFileURL(absPath).href)) as { default?: unknown };
    if (typeof mod.default !== 'function') {
      throw new Error(
        'Script must export a default function: export default async function(browser, args) { ... }',
      );
    }

    const args = options.scriptArgs ?? {};
    return await (
      mod.default as (
        browser: BrowserSDK,
        args: Record<string, string | boolean>,
      ) => Promise<unknown>
    )(browser, args);
  } finally {
    client.disconnect();
  }
}
