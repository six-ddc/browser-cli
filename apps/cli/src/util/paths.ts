import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { APP_DIR_NAME, DEFAULT_WS_PORT } from '@browser-cli/shared';

/** Get the app directory (~/.browser-cli/ or $BROWSER_CLI_DIR) */
export function getAppDir(): string {
  const dir = process.env.BROWSER_CLI_DIR || join(homedir(), APP_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Get PID file path */
export function getPidPath(): string {
  return join(getAppDir(), 'daemon.pid');
}

/** Get socket file path */
export function getSocketPath(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\browser-cli-daemon';
  }
  return join(getAppDir(), 'daemon.sock');
}

/** Get the WS port */
export function getWsPort(): number {
  return DEFAULT_WS_PORT;
}
