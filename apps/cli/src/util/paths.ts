import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { APP_DIR_NAME, DEFAULT_SESSION } from '@browser-cli/shared';

/** Get the app directory (~/.browser-cli/) */
export function getAppDir(): string {
  const dir = join(homedir(), APP_DIR_NAME);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Get PID file path for a session */
export function getPidPath(session: string = DEFAULT_SESSION): string {
  return join(getAppDir(), `${session}.pid`);
}

/** Get socket file path for a session */
export function getSocketPath(session: string = DEFAULT_SESSION): string {
  // On Windows, use a named pipe pattern; on Unix, use socket file
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\browser-cli-${session}`;
  }
  return join(getAppDir(), `${session}.sock`);
}

/** Get the WS port for a session (default 9222) */
export function getWsPort(session: string = DEFAULT_SESSION): number {
  // For non-default sessions, offset the port
  if (session === DEFAULT_SESSION) return 9222;
  // Simple hash for session name → port offset
  let hash = 0;
  for (const ch of session) {
    hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  }
  return 9222 + (Math.abs(hash) % 1000) + 1;
}
