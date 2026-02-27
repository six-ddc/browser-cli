import { Command } from 'commander';
import { DEFAULT_WS_PORT, DEFAULT_WS_HOST } from '@browser-cli/shared';
import { startDaemon, stopDaemon, getDaemonPid } from '../daemon/process.js';
import { getSocketPath, getWsPort, getWsHost, getAuthTokenPath } from '../util/paths.js';
import { logger } from '../util/logger.js';
import { getRootOpts } from './shared.js';

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

    // Query daemon for live status (host, port, connections, uptime)
    try {
      const { SocketClient } = await import('../client/socket-client.js');
      const client = new SocketClient();
      await client.connect(getSocketPath());

      if (!rootOpts.json) console.log('Socket: connectable');
      status.socketConnectable = true;

      // Send internal _status command (bypasses schema validation)
      const response = await client.sendCommand(
        { action: '_status' as 'getUrl', params: {} } as never,
        { timeout: 5000 },
      );

      if (response.success && response.data) {
        const data = response.data as unknown as {
          connections: Array<{
            extensionId: string;
            sessionId: string;
            browser?: { name: string; version: string; userAgent: string };
          }>;
          uptime: number;
          wsHost?: string;
          wsPort?: number;
          authEnabled?: boolean;
        };
        status.extension = data;

        if (data.wsHost) status.wsHost = data.wsHost;
        if (data.wsPort) status.wsPort = data.wsPort;
        if (data.authEnabled !== undefined) {
          status.authEnabled = data.authEnabled;
          if (data.authEnabled) status.authTokenFile = getAuthTokenPath();
        }

        if (!rootOpts.json) {
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
              console.log(parts.join(' | '));
            }
          }
          console.log(`Uptime: ${data.uptime}s`);
        }
      }

      client.disconnect();
    } catch {
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
