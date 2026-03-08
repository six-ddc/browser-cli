import { Command } from 'commander';
import { DEFAULT_WS_PORT, DEFAULT_WS_HOST } from '@browser-cli/shared';
import type { BrowserInfo } from '@browser-cli/shared';
import { startDaemon, stopDaemon, getDaemonPid } from '../daemon/process.js';
import { getSocketPath, getWsPort, getWsHost, getAuthTokenPath } from '../util/paths.js';
import { logger } from '../util/logger.js';
import { getRootOpts } from './shared.js';

// ── Shared types & helpers ────────────────────────────────────────────

interface SessionConnection {
  extensionId: string;
  sessionId: string;
  browser?: BrowserInfo;
  connectedAt: number;
}

interface StatusData {
  connections: SessionConnection[];
  uptime: number;
  wsHost?: string;
  wsPort?: number;
  authEnabled?: boolean;
}

/** Query live daemon status via the internal _status command */
async function queryDaemonStatus(): Promise<StatusData | null> {
  const pid = getDaemonPid();
  if (!pid) return null;

  try {
    const { SocketClient } = await import('../client/socket-client.js');
    const client = new SocketClient();
    await client.connect(getSocketPath());
    const response = await client.sendCommand(
      { action: '_status' as 'getUrl', params: {} } as never,
      { timeout: 5000 },
    );
    client.disconnect();
    if (response.success && response.data) {
      return response.data as unknown as StatusData;
    }
  } catch {
    // Daemon not connectable
  }
  return null;
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (timestamp == null) return 'unknown';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

// ── Commands ──────────────────────────────────────────────────────────

export const startCommand = new Command('start')
  .description('Start the browser-cli daemon')
  .option('--port <port>', 'WebSocket server port', String(DEFAULT_WS_PORT))
  .option('--host <host>', 'WebSocket server host', DEFAULT_WS_HOST)
  .option('--auth', 'Require auth token for extension connections')
  .option('--token <value>', 'Use a specific auth token (implies --auth)')
  .action(
    async (opts: { port: string; host: string; auth?: boolean; token?: string }, cmd: Command) => {
      const rootOpts = getRootOpts(cmd);
      const wsPort = parseInt(opts.port, 10);
      const wsHost = opts.host;
      try {
        const { pid, info } = await startDaemon(wsPort, wsHost, {
          auth: opts.auth,
          token: opts.token,
        });
        if (rootOpts.json) {
          console.log(JSON.stringify({ success: true, pid, ...info }));
        } else {
          logger.success(`Daemon started (PID ${pid})`);
          if (info.authToken) {
            logger.warn(`Auth token required for extension connections`);
            logger.info(`Auth token: ${info.authToken}`);
            logger.info(`Token saved to ~/.browser-cli/auth-token`);
          }
        }
      } catch (err) {
        if (rootOpts.json) {
          console.log(JSON.stringify({ success: false, error: (err as Error).message }));
          process.exit(1);
        }
        logger.error(`Failed to start daemon: ${(err as Error).message}`);
        process.exit(1);
      }
    },
  );

export const stopCommand = new Command('stop')
  .description('Stop the browser-cli daemon')
  .action(async (_opts: unknown, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);
    const stopped = await stopDaemon();
    if (rootOpts.json) {
      console.log(JSON.stringify({ success: true, stopped }));
      return;
    }
    if (stopped) {
      logger.success('Daemon stopped');
    } else {
      logger.warn('Daemon is not running');
    }
  });

export const statusCommand = new Command('status')
  .description('Show daemon and extension connection status')
  .action(async (_opts: unknown, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);
    const pid = getDaemonPid();

    if (!pid) {
      if (rootOpts.json) {
        console.log(JSON.stringify({ daemon: false }));
        return;
      }
      console.log('Daemon: not running');
      return;
    }

    const status: Record<string, unknown> = {
      daemon: true,
      pid,
      socket: getSocketPath(),
    };

    if (!rootOpts.json) {
      console.log(`Daemon: running (PID ${pid})`);
      console.log(`Socket: ${getSocketPath()}`);
    }

    const data = await queryDaemonStatus();
    if (data) {
      status.socketConnectable = true;
      status.extension = data;

      if (data.wsHost) status.wsHost = data.wsHost;
      if (data.wsPort) status.wsPort = data.wsPort;
      if (data.authEnabled !== undefined) {
        status.authEnabled = data.authEnabled;
        if (data.authEnabled) status.authTokenFile = getAuthTokenPath();
      }

      if (!rootOpts.json) {
        console.log('Socket: connectable');
        if (data.wsHost) console.log(`WebSocket host: ${data.wsHost}`);
        if (data.wsPort) console.log(`WebSocket port: ${data.wsPort}`);
        if (data.authEnabled) console.log(`Auth token: ${getAuthTokenPath()}`);
        if (data.connections.length === 0) {
          console.log('Extension: not connected');
        } else {
          console.log(`Browsers connected: ${data.connections.length}`);
          for (const conn of data.connections) {
            const parts = [`  ${conn.sessionId}`];
            if (conn.browser) parts.push(`${conn.browser.name} ${conn.browser.version}`);
            parts.push(`ext=${conn.extensionId}`);
            parts.push(formatRelativeTime(conn.connectedAt));
            console.log(parts.join(' | '));
          }
        }
        console.log(`Uptime: ${data.uptime}s`);
      }
    } else {
      status.socketConnectable = false;
      if (!rootOpts.json) {
        // Fallback to static values when daemon is not connectable
        console.log(`WebSocket host: ${getWsHost()}`);
        console.log(`WebSocket port: ${getWsPort()}`);
        console.log('Socket: not connectable');
      }
    }

    if (rootOpts.json) {
      console.log(JSON.stringify(status, null, 2));
    }
  });

export const listCommand = new Command('list')
  .description('List connected browser sessions')
  .action(async (_opts: unknown, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);
    const data = await queryDaemonStatus();

    if (!data) {
      if (rootOpts.json) {
        console.log(JSON.stringify({ sessions: [], daemon: false }));
        return;
      }
      console.log('Daemon is not running. Start with: browser-cli start');
      return;
    }

    const sessions = data.connections;

    if (rootOpts.json) {
      console.log(
        JSON.stringify(
          {
            sessions: sessions.map((s) => ({
              sessionId: s.sessionId,
              browser: s.browser ? { name: s.browser.name, version: s.browser.version } : null,
              status: 'connected',
              connectedAt: s.connectedAt,
              extensionId: s.extensionId,
            })),
            daemon: true,
            uptime: data.uptime,
          },
          null,
          2,
        ),
      );
      return;
    }

    if (sessions.length === 0) {
      console.log('No browsers connected.');
      console.log('Install the browser extension and open a browser to connect.');
      return;
    }

    // Table-style output
    const header = {
      session: 'SESSION',
      browser: 'BROWSER',
      connected: 'CONNECTED',
    };

    const rows = sessions.map((s) => ({
      session: s.sessionId,
      browser: s.browser ? `${s.browser.name} ${s.browser.version}` : '(unknown)',
      connected: formatRelativeTime(s.connectedAt),
    }));

    // Calculate column widths
    const colWidths = {
      session: Math.max(header.session.length, ...rows.map((r) => r.session.length)),
      browser: Math.max(header.browser.length, ...rows.map((r) => r.browser.length)),
      connected: Math.max(header.connected.length, ...rows.map((r) => r.connected.length)),
    };

    const sep = '  ';
    const formatRow = (r: typeof header) =>
      [r.session.padEnd(colWidths.session), r.browser.padEnd(colWidths.browser), r.connected].join(
        sep,
      );

    console.log(formatRow(header));
    for (const row of rows) {
      console.log(formatRow(row));
    }
    console.log(`\n${sessions.length} session(s) connected (uptime: ${data.uptime}s)`);
  });
