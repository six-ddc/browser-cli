/**
 * Daemon entry point.
 * This file is the second Bun build entry — runs as a long-lived background process.
 * It starts a WebSocket server (for the extension) and a Unix socket server (for CLI clients).
 */

import { parseArgs } from 'node:util';
import { DEFAULT_WS_PORT, DEFAULT_WS_HOST } from '@browser-cli/shared';
import { WsServer } from './ws-server.js';
import { SocketServer } from './socket-server.js';
import { Bridge } from './bridge.js';
import { writeDaemonPid, cleanupPidFile } from './process.js';
import { isNonLoopback, generateAuthToken, writeAuthToken, cleanupAuthToken } from './auth.js';
import { getSocketPath, getAppDir } from '../util/paths.js';
import { logger } from '../util/logger.js';
import { loadSessionMap, saveSessionMap } from './session-store.js';

async function main() {
  const { values } = parseArgs({
    options: {
      daemon: { type: 'boolean', default: false },
      port: { type: 'string', default: String(DEFAULT_WS_PORT) },
      host: { type: 'string', default: DEFAULT_WS_HOST },
      auth: { type: 'boolean', default: false },
      token: { type: 'string' },
    },
    strict: false,
  });

  const wsPort = parseInt(String(values.port), 10);
  const wsHost = String(values.host);
  const socketPath = getSocketPath();

  logger.info(`Starting daemon (wsHost=${wsHost}, wsPort=${wsPort})`);

  // Auth decision:
  //   --token <value>  → use that exact token
  //   --auth           → generate random token
  //   non-loopback     → generate random token (existing behavior)
  //   otherwise        → no auth
  let authToken: string | null = null;
  if (values.token) {
    authToken = String(values.token);
    writeAuthToken(authToken);
    logger.info(`Using provided auth token`);
    logger.info(`Token saved to ~/.browser-cli/auth-token`);
  } else if (values.auth || isNonLoopback(wsHost)) {
    authToken = generateAuthToken();
    writeAuthToken(authToken);
    if (isNonLoopback(wsHost)) {
      logger.warn(`Non-loopback host detected — auth token required for extension connections`);
    } else {
      logger.info(`Auth enabled — token required for extension connections`);
    }
    logger.info(`Auth token: ${authToken}`);
    logger.info(`Token saved to ~/.browser-cli/auth-token`);
  } else {
    // Clean up stale token file when running without auth
    cleanupAuthToken();
  }

  // Write PID
  writeDaemonPid(process.pid);

  // Load persisted clientId→sessionId mapping
  const appDir = getAppDir();
  const sessionMap = loadSessionMap(appDir);
  logger.info(`Loaded ${sessionMap.size} persisted session mapping(s)`);

  // Create servers
  const wsServer = new WsServer({
    sessionMap,
    onSessionMapChange: (map) => {
      saveSessionMap(appDir, map);
    },
    authToken,
  });
  const bridge = new Bridge(wsServer);
  const socketServer = new SocketServer(
    (req) => bridge.handleRequest(req),
    () => ({
      connections: wsServer.allConnections,
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      wsHost,
      wsPort,
      authEnabled: authToken !== null,
    }),
  );

  // Start both servers
  await wsServer.start(wsPort, wsHost);
  await socketServer.start(socketPath);

  // Signal readiness to parent via IPC (if launched with IPC channel)
  process.send?.({ ready: true, wsHost, wsPort, authToken });

  logger.success(`Daemon ready (PID=${process.pid})`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down daemon...');
    await socketServer.stop();
    await wsServer.stop();
    cleanupPidFile();
    cleanupAuthToken();
    process.exit(0);
  };

  const onSignal = () => void shutdown();
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
  process.on('SIGHUP', onSignal);

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason instanceof Error ? reason.message : String(reason));
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err.message);
    void shutdown();
  });

  // Keep the process alive
  // Node.js will stay alive as long as the servers are listening
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  // Signal error to parent via IPC (if launched with IPC channel)
  process.send?.({ error: message });
  cleanupPidFile();
  logger.error('Daemon failed to start:', message);
  process.exit(1);
});
