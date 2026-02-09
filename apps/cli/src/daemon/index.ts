/**
 * Daemon entry point.
 * This file is the second tsup entry — runs as a long-lived background process.
 * It starts a WebSocket server (for the extension) and a Unix socket server (for CLI clients).
 */

import { parseArgs } from 'node:util';
import { DEFAULT_WS_PORT, DEFAULT_SESSION } from '@browser-cli/shared';
import { WsServer } from './ws-server.js';
import { SocketServer } from './socket-server.js';
import { Bridge } from './bridge.js';
import { writeDaemonPid, cleanupPidFile } from './process.js';
import { getSocketPath } from '../util/paths.js';
import { logger } from '../util/logger.js';

async function main() {
  const { values } = parseArgs({
    options: {
      daemon: { type: 'boolean', default: false },
      session: { type: 'string', default: DEFAULT_SESSION },
      port: { type: 'string', default: String(DEFAULT_WS_PORT) },
    },
    strict: false,
  });

  const session = String(values.session ?? DEFAULT_SESSION);
  const wsPort = parseInt(String(values.port ?? DEFAULT_WS_PORT), 10);
  const socketPath = getSocketPath(session);

  logger.info(`Starting daemon (session=${session}, wsPort=${wsPort})`);

  // Write PID
  writeDaemonPid(process.pid, session);

  // Create servers
  const wsServer = new WsServer();
  const bridge = new Bridge(wsServer);
  const socketServer = new SocketServer(
    (req) => bridge.handleRequest(req),
    () => ({
      connected: wsServer.isConnected,
      extensionId: wsServer.extensionInfo?.extensionId ?? null,
      sessionId: wsServer.extensionInfo?.sessionId ?? null,
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
    }),
  );

  // Start both servers
  await wsServer.start(wsPort);
  await socketServer.start(socketPath);

  logger.success(`Daemon ready (PID=${process.pid})`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down daemon...');
    await socketServer.stop();
    await wsServer.stop();
    cleanupPidFile(session);
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Keep the process alive
  // Node.js will stay alive as long as the servers are listening
}

main().catch((err) => {
  logger.error('Daemon failed to start:', err.message);
  process.exit(1);
});
