/**
 * WebSocket client for the extension background service worker.
 * Connects to the daemon's WS server with exponential backoff reconnection.
 */

import {
  DEFAULT_WS_PORT,
  PROTOCOL_VERSION,
} from '@browser-cli/shared';
import type {
  WsMessage,
  RequestMessage,
  ResponseMessage,
  HandshakeAckMessage,
  PingMessage,
} from '@browser-cli/shared';

export type MessageHandler = (msg: RequestMessage) => Promise<ResponseMessage>;

export interface WsClientOptions {
  port?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onHandshake?: (ack: HandshakeAckMessage) => void;
  messageHandler?: MessageHandler;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export class WsClient {
  private ws: WebSocket | null = null;
  private port: number;
  private backoff = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private sessionId: string | null = null;
  private options: WsClientOptions;
  private stopped = false;

  constructor(options: WsClientOptions = {}) {
    this.port = options.port ?? DEFAULT_WS_PORT;
    this.options = options;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  updatePort(port: number): void {
    this.port = port;
    // Reconnect with new port
    this.stop();
    this.stopped = false;
    this.connect();
  }

  private connect(): void {
    if (this.stopped) return;

    try {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.backoff = INITIAL_BACKOFF_MS;
      // Send handshake
      const handshake = {
        type: 'handshake' as const,
        protocolVersion: PROTOCOL_VERSION,
        extensionId: browser.runtime.id,
      };
      this.ws?.send(JSON.stringify(handshake));
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        this.handleMessage(msg);
      } catch {
        console.error('[browser-cli] Failed to parse WS message');
      }
    };

    this.ws.onclose = () => {
      const wasConnected = this.connected;
      this.connected = false;
      this.sessionId = null;
      if (wasConnected) {
        this.options.onDisconnect?.();
      }
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private async handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case 'handshake_ack': {
        this.connected = true;
        this.sessionId = msg.sessionId;
        this.options.onConnect?.();
        this.options.onHandshake?.(msg as HandshakeAckMessage);
        break;
      }
      case 'ping': {
        const pong = { type: 'pong' as const, timestamp: (msg as PingMessage).timestamp };
        this.ws?.send(JSON.stringify(pong));
        break;
      }
      case 'request': {
        if (this.options.messageHandler) {
          const response = await this.options.messageHandler(msg as RequestMessage);
          this.ws?.send(JSON.stringify(response));
        }
        break;
      }
      default:
        break;
    }
  }

  /** Send an event to the daemon */
  sendEvent(event: string, data: unknown, tabId?: number): void {
    if (!this.connected || !this.ws) return;
    const msg = {
      type: 'event' as const,
      event,
      data,
      tabId,
      timestamp: Date.now(),
    };
    this.ws.send(JSON.stringify(msg));
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
  }
}
