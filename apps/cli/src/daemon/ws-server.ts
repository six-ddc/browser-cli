import { WebSocketServer, WebSocket } from 'ws';
import {
  PROTOCOL_VERSION,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  generateFriendlyId,
  schemas,
} from '@browser-cli/shared';
import type {
  RequestMessage,
  ResponseMessage,
  EventMessage,
  HandshakeMessage,
  PongMessage,
  WsMessage,
  BrowserInfo,
} from '@browser-cli/shared';
import { logger } from '../util/logger.js';

export interface ExtensionConnection {
  ws: WebSocket;
  extensionId: string;
  sessionId: string;
  browser?: BrowserInfo;
  alive: boolean;
  lastPong: number;
}

export interface PendingRequest {
  resolve: (msg: ResponseMessage) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  sessionId: string;
}

const MAX_STORED_EVENTS = 1000;

export class WsServer {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, ExtensionConnection>();
  private defaultSessionId: string | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<string, PendingRequest>();
  private events: EventMessage[] = [];

  get isConnected(): boolean {
    return this.connections.size > 0;
  }

  /** Info for the default connection (backward compat) */
  get extensionInfo(): { extensionId: string; sessionId: string; browser?: BrowserInfo } | null {
    const conn = this.getDefaultConnection();
    return conn
      ? { extensionId: conn.extensionId, sessionId: conn.sessionId, browser: conn.browser }
      : null;
  }

  /** All active connections for status display */
  get allConnections(): Array<{ extensionId: string; sessionId: string; browser?: BrowserInfo }> {
    return Array.from(this.connections.values()).map((c) => ({
      extensionId: c.extensionId,
      sessionId: c.sessionId,
      browser: c.browser,
    }));
  }

  /** Get a specific connection by sessionId, or the default */
  getConnection(sessionId?: string): ExtensionConnection | null {
    if (sessionId) {
      return this.connections.get(sessionId) ?? null;
    }
    return this.getDefaultConnection();
  }

  private getDefaultConnection(): ExtensionConnection | null {
    if (this.defaultSessionId) {
      return this.connections.get(this.defaultSessionId) ?? null;
    }
    return null;
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

        ws.on('message', (raw: { toString(): string }) => {
          try {
            const parsed = schemas.wsMessageSchema.safeParse(JSON.parse(raw.toString()));
            if (!parsed.success) {
              logger.warn('Invalid WS message schema:', parsed.error.message);
              return;
            }
            this.handleMessage(ws, parsed.data as WsMessage);
          } catch (e) {
            logger.error('Invalid message from extension:', (e as Error).message);
          }
        });

        ws.on('close', () => {
          // Find which connection owns this ws
          let closedSessionId: string | null = null;
          for (const [sid, conn] of this.connections) {
            if (conn.ws === ws) {
              closedSessionId = sid;
              break;
            }
          }

          if (closedSessionId) {
            logger.warn(`Extension disconnected (session=${closedSessionId})`);
            this.connections.delete(closedSessionId);

            // Reject pending requests for this session only
            for (const [id, req] of this.pending) {
              if (req.sessionId === closedSessionId) {
                req.reject(new Error('Extension disconnected'));
                clearTimeout(req.timer);
                this.pending.delete(id);
              }
            }

            // Update default if needed
            if (this.defaultSessionId === closedSessionId) {
              const remaining = this.connections.keys().next();
              this.defaultSessionId = remaining.done ? null : remaining.value;
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
        this.handleHandshake(ws, msg);
        break;
      case 'pong':
        this.handlePong(ws, msg);
        break;
      case 'response':
        this.handleResponse(msg);
        break;
      case 'event':
        logger.debug(`Event from extension: ${msg.event}`);
        this.storeEvent(msg);
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

    const sessionId = generateFriendlyId();
    this.connections.set(sessionId, {
      ws,
      extensionId: msg.extensionId,
      sessionId,
      browser: msg.browser,
      alive: true,
      lastPong: Date.now(),
    });
    this.defaultSessionId = sessionId;

    const ack = {
      type: 'handshake_ack' as const,
      protocolVersion: PROTOCOL_VERSION,
      sessionId,
    };
    ws.send(JSON.stringify(ack));

    const browserStr = msg.browser ? `, browser=${msg.browser.name} ${msg.browser.version}` : '';
    logger.success(
      `Extension connected (id=${msg.extensionId}, session=${sessionId}${browserStr})`,
    );
  }

  private handlePong(ws: WebSocket, msg: PongMessage) {
    // Find the connection that sent this pong
    for (const conn of this.connections.values()) {
      if (conn.ws === ws) {
        conn.alive = true;
        conn.lastPong = msg.timestamp;
        break;
      }
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
      for (const [sid, conn] of this.connections) {
        if (!conn.alive) {
          const elapsed = Date.now() - conn.lastPong;
          if (elapsed > HEARTBEAT_TIMEOUT_MS) {
            logger.warn(`Extension heartbeat timeout (session=${sid}), disconnecting`);
            conn.ws.terminate();
            // ws 'close' handler will clean up the map
            continue;
          }
        }

        conn.alive = false;
        const ping = { type: 'ping', timestamp: Date.now() };
        conn.ws.send(JSON.stringify(ping));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Send a command to the extension and wait for a response */
  sendRequest(
    msg: RequestMessage,
    timeoutMs: number = 30_000,
    sessionId?: string,
  ): Promise<ResponseMessage> {
    return new Promise((resolve, reject) => {
      const conn = this.getConnection(sessionId);

      if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
        if (sessionId) {
          const available = Array.from(this.connections.keys()).join(', ');
          reject(
            new Error(
              `Browser session '${sessionId}' not found.${available ? ` Connected: ${available}` : ' No browsers connected.'}`,
            ),
          );
        } else {
          reject(new Error('Extension not connected'));
        }
        return;
      }

      const resolvedSessionId = sessionId ?? conn.sessionId;

      const timer = setTimeout(() => {
        this.pending.delete(msg.id);
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(msg.id, { resolve, reject, timer, sessionId: resolvedSessionId });
      conn.ws.send(JSON.stringify(msg));
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

    for (const conn of this.connections.values()) {
      conn.ws.close();
    }
    this.connections.clear();
    this.defaultSessionId = null;

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
