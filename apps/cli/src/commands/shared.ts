/**
 * Shared utilities for CLI commands.
 * Handles connecting to daemon, sending commands, and formatting output.
 */

import type { Command } from 'commander';
import type { ActionResultMap, ActionType, Command as BrowserCommand } from '@browser-cli/shared';
import { SocketClient } from '../client/socket-client.js';
import { ensureDaemon } from '../daemon/process.js';
import { getSocketPath } from '../util/paths.js';
import { logger } from '../util/logger.js';

/** Get root program options */
export function getRootOpts(cmd: Command): { browser?: string; json?: boolean } {
  // Walk up to root
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts();
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

  // Ensure daemon is running
  try {
    ensureDaemon();
  } catch (err) {
    logger.error(`Failed to start daemon: ${(err as Error).message}`);
    process.exit(1);
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
    logger.error(
      `Failed to connect to daemon: ${lastConnectErr.message}\nIs the daemon running? Try: browser-cli start`,
    );
    process.exit(1);
  }

  try {
    const response = await client.sendCommand(command, {
      tabId: options?.tabId,
      sessionId: rootOpts.browser,
    });

    if (rootOpts.json && !options?.skipJson) {
      console.log(JSON.stringify(response, null, 2));
      client.disconnect();
      process.exit(response.success ? 0 : 1);
    }

    if (!response.success) {
      const errMsg = response.error?.message || 'Unknown error';
      const errCode = response.error?.code || 'UNKNOWN';
      const hint = response.error?.hint;
      logger.error(`[${errCode}] ${errMsg}${hint ? ` Hint: ${hint}` : ''}`);
      process.exit(1);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- data may be undefined at runtime even on success
    return (response.data as ActionResultMap[A]) ?? ({} as ActionResultMap[A]);
  } finally {
    client.disconnect();
  }
}
