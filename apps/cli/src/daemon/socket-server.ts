import { createServer, Server, Socket } from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';
import { schemas, ErrorCode } from '@browser-cli/shared';
import type { DaemonRequest, DaemonResponse } from '@browser-cli/shared';
import { logger } from '../util/logger.js';

export type RequestHandler = (req: DaemonRequest) => Promise<DaemonResponse>;
export type StatusHandler = () => Record<string, unknown>;

/**
 * Unix socket / TCP server that accepts CLI client connections.
 * Protocol: NDJSON (newline-delimited JSON) over Unix socket.
 */
export class SocketServer {
  private server: Server | null = null;
  private handler: RequestHandler;
  private statusHandler: StatusHandler | null = null;

  constructor(handler: RequestHandler, statusHandler?: StatusHandler) {
    this.handler = handler;
    this.statusHandler = statusHandler ?? null;
  }

  start(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up stale socket file
      if (!socketPath.startsWith('\\\\.\\pipe\\') && existsSync(socketPath)) {
        try {
          unlinkSync(socketPath);
        } catch {
          // ignore
        }
      }

      this.server = createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('listening', () => {
        logger.info(`Socket server listening on ${socketPath}`);
        resolve();
      });

      this.server.on('error', (err) => {
        logger.error('Socket server error:', err.message);
        reject(err);
      });

      this.server.listen(socketPath);
    });
  }

  private handleConnection(socket: Socket) {
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();
      // Process complete lines (NDJSON)
      const lines = buffer.split('\n');
      buffer = lines.pop()!; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        this.processLine(socket, line);
      }
    });

    socket.on('error', (err) => {
      logger.debug('Client socket error:', err.message);
    });
  }

  private async processLine(socket: Socket, line: string) {
    try {
      const raw = JSON.parse(line);

      // Internal _status command bypasses schema validation
      if (raw.command?.action === '_status' && this.statusHandler) {
        const response: DaemonResponse = {
          id: raw.id ?? 'status',
          success: true,
          data: this.statusHandler(),
        };
        socket.write(JSON.stringify(response) + '\n');
        return;
      }

      const req = schemas.daemonRequestSchema.parse(raw) as DaemonRequest;
      const response = await this.handler(req);
      socket.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const errorResponse: DaemonResponse = {
        id: 'unknown',
        success: false,
        error: {
          code: ErrorCode.PROTOCOL_ERROR,
          message: (err as Error).message,
        },
      };
      try {
        // Try to extract the id from the raw message
        const raw = JSON.parse(line);
        if (raw.id) errorResponse.id = raw.id;
      } catch {
        // ignore parse error
      }
      socket.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }
}
