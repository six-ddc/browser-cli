import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { APP_DIR_NAME, DEFAULT_WS_HOST, DEFAULT_WS_PORT } from '@browser-cli/shared';

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

/** Get auth token file path */
export function getAuthTokenPath(): string {
  return join(getAppDir(), 'auth-token');
}

/** Get daemon log file path */
export function getDaemonLogPath(): string {
  return join(getAppDir(), 'daemon.log');
}

/**
 * Endpoint the daemon of this app dir listens on.
 *
 * Recorded when a daemon starts and deliberately kept after it stops: commands
 * that auto-start a daemon (`batch`, `repl`, `script`, `mcp`, `doctor --fix`)
 * pass no port, and without this they would silently bring the daemon back up
 * on the default port — stranding an extension that was told to connect
 * elsewhere. `BROWSER_CLI_WS_PORT` / `BROWSER_CLI_WS_HOST` win over the file.
 */
function getEndpointPath(): string {
  return join(getAppDir(), 'daemon.endpoint.json');
}

interface DaemonEndpoint {
  wsHost: string;
  wsPort: number;
}

function readDaemonEndpoint(): Partial<DaemonEndpoint> {
  try {
    const raw = JSON.parse(readFileSync(getEndpointPath(), 'utf-8')) as Partial<DaemonEndpoint>;
    return {
      wsHost: typeof raw.wsHost === 'string' ? raw.wsHost : undefined,
      wsPort: typeof raw.wsPort === 'number' ? raw.wsPort : undefined,
    };
  } catch {
    return {};
  }
}

export function writeDaemonEndpoint(endpoint: DaemonEndpoint): void {
  try {
    writeFileSync(getEndpointPath(), JSON.stringify(endpoint));
  } catch {
    // Endpoint memory is an optimisation; never fail a daemon start over it.
  }
}

/** Get the WS host */
export function getWsHost(): string {
  const fromEnv = process.env.BROWSER_CLI_WS_HOST;
  if (fromEnv) return fromEnv;
  return readDaemonEndpoint().wsHost ?? DEFAULT_WS_HOST;
}

/** Get the WS port */
export function getWsPort(): number {
  const fromEnv = parseInt(process.env.BROWSER_CLI_WS_PORT ?? '', 10);
  if (!isNaN(fromEnv)) return fromEnv;
  return readDaemonEndpoint().wsPort ?? DEFAULT_WS_PORT;
}
