import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import {
  PROTOCOL_VERSION,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
} from '@browser-cli/shared';
import type {
  RequestMessage,
  ResponseMessage,
  EventMessage,
  HandshakeMessage,
  PongMessage,
  WsMessage,
} from '@browser-cli/shared';
import { logger } from '../util/logger.js';

export interface ExtensionConnection {
  ws: WebSocket;
  extensionId: string;
  sessionId: string;
  alive: boolean;
  lastPong: number;
}

export interface PendingRequest {
  resolve: (msg: ResponseMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const MAX_STORED_EVENTS = 1000;

export class WsServer {
  private wss: WebSocketServer | null = null;
  private connection: ExtensionConnection | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<string, PendingRequest>();
  private events: EventMessage[] = [];

  get isConnected(): boolean {
    return this.connection !== null && this.connection.ws.readyState === WebSocket.OPEN;
  }

  get extensionInfo(): { extensionId: string; sessionId: string } | null {
    return this.connection
      ? { extensionId: this.connection.extensionId, sessionId: this.connection.sessionId }
      : null;
  }

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({ port, host: '127.0.0.1' });

      this.wss.on('listening', () => {
        logger.info(`WebSocket server listening on ws://127.0.0.1:${port}`);
        this.startHeartbeat();
        resolve();
      });

      this.wss.on('error', (err) => {
        logger.error('WebSocket server error:', err.message);
        reject(err);
      });

      this.wss.on('connection', (ws) => {
        logger.info('Extension connecting...');

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString()) as WsMessage;
            this.handleMessage(ws, msg);
          } catch (e) {
            logger.error('Invalid message from extension:', (e as Error).message);
          }
        });

        ws.on('close', () => {
          if (this.connection?.ws === ws) {
            logger.warn('Extension disconnected');
            this.connection = null;
            // Reject all pending requests
            for (const [id, req] of this.pending) {
              req.reject(new Error('Extension disconnected'));
              clearTimeout(req.timer);
              this.pending.delete(id);
            }
          }
        });

        ws.on('error', (err) => {
          logger.error('Extension WebSocket error:', err.message);
        });
      });
    });
  }

  private handleMessage(ws: WebSocket, msg: WsMessage) {
    switch (msg.type) {
      case 'handshake':
        this.handleHandshake(ws, msg as HandshakeMessage);
        break;
      case 'pong':
        this.handlePong(msg as PongMessage);
        break;
      case 'response':
        this.handleResponse(msg as ResponseMessage);
        break;
      case 'event':
        logger.debug(`Event from extension: ${msg.event}`);
        this.storeEvent(msg as EventMessage);
        break;
      default:
        logger.warn('Unexpected message type from extension:', (msg as { type: string }).type);
    }
  }

  private handleHandshake(ws: WebSocket, msg: HandshakeMessage) {
    if (msg.protocolVersion !== PROTOCOL_VERSION) {
      logger.warn(
        `Protocol version mismatch: extension=${msg.protocolVersion}, daemon=${PROTOCOL_VERSION}`,
      );
    }

    const sessionId = randomUUID();
    this.connection = {
      ws,
      extensionId: msg.extensionId,
      sessionId,
      alive: true,
      lastPong: Date.now(),
    };

    const ack = {
      type: 'handshake_ack' as const,
      protocolVersion: PROTOCOL_VERSION,
      sessionId,
    };
    ws.send(JSON.stringify(ack));
    logger.success(`Extension connected (id=${msg.extensionId}, session=${sessionId})`);
  }

  private handlePong(msg: PongMessage) {
    if (this.connection) {
      this.connection.alive = true;
      this.connection.lastPong = msg.timestamp;
    }
  }

  private handleResponse(msg: ResponseMessage) {
    const pending = this.pending.get(msg.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(msg.id);
      pending.resolve(msg);
    } else {
      logger.warn(`Received response for unknown request: ${msg.id}`);
    }
  }

  private storeEvent(msg: EventMessage) {
    this.events.push(msg);
    if (this.events.length > MAX_STORED_EVENTS) {
      this.events.splice(0, this.events.length - MAX_STORED_EVENTS);
    }
  }

  getEvents(filter?: { event?: string; tabId?: number }): EventMessage[] {
    if (!filter) return [...this.events];
    return this.events.filter((e) => {
      if (filter.event && e.event !== filter.event) return false;
      if (filter.tabId !== undefined && e.tabId !== filter.tabId) return false;
      return true;
    });
  }

  clearEvents(): void {
    this.events = [];
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (!this.connection) return;

      if (!this.connection.alive) {
        const elapsed = Date.now() - this.connection.lastPong;
        if (elapsed > HEARTBEAT_TIMEOUT_MS) {
          logger.warn('Extension heartbeat timeout, disconnecting');
          this.connection.ws.terminate();
          this.connection = null;
          return;
        }
      }

      this.connection.alive = false;
      const ping = { type: 'ping', timestamp: Date.now() };
      this.connection.ws.send(JSON.stringify(ping));
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Send a command to the extension and wait for a response */
  sendRequest(msg: RequestMessage, timeoutMs: number = 30_000): Promise<ResponseMessage> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.connection) {
        reject(new Error('Extension not connected'));
        return;
      }

      const timer = setTimeout(() => {
        this.pending.delete(msg.id);
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(msg.id, { resolve, reject, timer });
      this.connection.ws.send(JSON.stringify(msg));
    });
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Reject all pending
    for (const [id, req] of this.pending) {
      req.reject(new Error('Server shutting down'));
      clearTimeout(req.timer);
      this.pending.delete(id);
    }

    if (this.connection) {
      this.connection.ws.close();
      this.connection = null;
    }

    return new Promise<void>((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
        this.wss = null;
      } else {
        resolve();
      }
    });
  }
}
