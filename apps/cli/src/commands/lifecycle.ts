import { Command } from 'commander';
import { DEFAULT_WS_PORT } from '@browser-cli/shared';
import {
  startDaemon,
  stopDaemon,
  getDaemonPid,
} from '../daemon/process.js';
import { getSocketPath, getWsPort } from '../util/paths.js';
import { logger } from '../util/logger.js';
import { getRootOpts } from './shared.js';

export const startCommand = new Command('start')
  .description('Start the browser-cli daemon')
  .option('--port <port>', 'WebSocket server port', String(DEFAULT_WS_PORT))
  .action((opts: { port: string }, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);
    const wsPort = parseInt(opts.port, 10);
    try {
      const pid = startDaemon(rootOpts.session, wsPort);
      if (rootOpts.json) {
        console.log(JSON.stringify({ success: true, pid }));
      } else {
        logger.success(`Daemon started (PID ${pid})`);
      }
    } catch (err) {
      if (rootOpts.json) {
        console.log(JSON.stringify({ success: false, error: (err as Error).message }));
        process.exit(1);
      }
      logger.error(`Failed to start daemon: ${(err as Error).message}`);
      process.exit(1);
    }
  });

export const stopCommand = new Command('stop')
  .description('Stop the browser-cli daemon')
  .action((_opts: unknown, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);
    const stopped = stopDaemon(rootOpts.session);
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
    const session = rootOpts.session;
    const pid = getDaemonPid(session);

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
      socket: getSocketPath(session),
      wsPort: getWsPort(session),
    };

    if (!rootOpts.json) {
      console.log(`Daemon: running (PID ${pid})`);
      console.log(`Socket: ${getSocketPath(session)}`);
      console.log(`WebSocket port: ${getWsPort(session)}`);
    }

    // Query daemon for extension connection status
    try {
      const { SocketClient } = await import('../client/socket-client.js');
      const client = new SocketClient();
      await client.connect(getSocketPath(session));

      if (!rootOpts.json) console.log('Socket: connectable');
      status.socketConnectable = true;

      // Send internal _status command (bypasses schema validation)
      const response = await client.sendCommand(
        { action: '_status' as 'getUrl', params: {} } as never,
        { timeout: 5000 },
      );

      if (response.success && response.data) {
        const data = response.data as {
          connected: boolean;
          extensionId: string | null;
          sessionId: string | null;
          uptime: number;
        };
        status.extension = data;

        if (!rootOpts.json) {
          console.log(`Extension: ${data.connected ? 'connected' : 'not connected'}`);
          if (data.connected && data.extensionId) {
            console.log(`Extension ID: ${data.extensionId}`);
          }
          if (data.sessionId) {
            console.log(`Session ID: ${data.sessionId}`);
          }
          console.log(`Daemon uptime: ${data.uptime}s`);
        }
      }

      client.disconnect();
    } catch {
      status.socketConnectable = false;
      if (!rootOpts.json) console.log('Socket: not connectable');
    }

    if (rootOpts.json) {
      console.log(JSON.stringify(status, null, 2));
    }
  });
