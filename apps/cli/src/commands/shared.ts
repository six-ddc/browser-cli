/**
 * Shared utilities for CLI commands.
 * Handles connecting to daemon, sending commands, and formatting output.
 */

import { Command } from 'commander';
import type { Command as BrowserCommand } from '@browser-cli/shared';
import { SocketClient } from '../client/socket-client.js';
import { ensureDaemon } from '../daemon/process.js';
import { getSocketPath } from '../util/paths.js';
import { logger } from '../util/logger.js';

/** Get root program options */
export function getRootOpts(cmd: Command): { session?: string; json?: boolean } {
  // Walk up to root
  let root = cmd;
  while (root.parent) root = root.parent;
  return root.opts();
}

/**
 * Send a command to the daemon and return the result data.
 * Handles daemon auto-start, connection, error display.
 */
export async function sendCommand(
  cmd: Command,
  command: BrowserCommand,
  options?: { tabId?: number },
): Promise<Record<string, unknown> | null> {
  const rootOpts = getRootOpts(cmd);
  const session = rootOpts.session;

  // Ensure daemon is running
  try {
    ensureDaemon(session);
  } catch (err) {
    logger.error(`Failed to start daemon: ${(err as Error).message}`);
    process.exit(1);
  }

  // Connect to daemon
  const client = new SocketClient();
  try {
    await client.connect(getSocketPath(session));
  } catch (err) {
    logger.error(
      `Failed to connect to daemon: ${(err as Error).message}\nIs the daemon running? Try: browser-cli start`,
    );
    process.exit(1);
  }

  try {
    const response = await client.sendCommand(command, { tabId: options?.tabId });

    if (rootOpts.json) {
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

    return (response.data as Record<string, unknown>) ?? {};
  } finally {
    client.disconnect();
  }
}
