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
  onReconnecting?: (nextRetryMs: number) => void;
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
  /** Monotonic counter to detect stale WebSocket callbacks */
  private generation = 0;

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

  get isReconnecting(): boolean {
    return this.reconnectTimer !== null;
  }

  get nextRetryMs(): number {
    return this.backoff;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.cleanup();
  }

  updatePort(port: number): void {
    this.port = port;
    this.cleanup();
    this.stopped = false;
    this.backoff = INITIAL_BACKOFF_MS;
    this.connect();
  }

  private cleanup(): void {
    // Bump generation so any pending callbacks from the old ws become no-ops
    this.generation++;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      // Remove handlers before closing to prevent stale callbacks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.sessionId = null;
  }

  private connect(): void {
    if (this.stopped) return;

    const gen = ++this.generation;
    console.log(`[browser-cli] Connecting to ws://127.0.0.1:${this.port}...`);

    try {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
    } catch (err) {
      console.error('[browser-cli] Failed to create WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (gen !== this.generation) return;
      console.log('[browser-cli] WebSocket opened, sending handshake...');
      this.backoff = INITIAL_BACKOFF_MS;
      const handshake = {
        type: 'handshake' as const,
        protocolVersion: PROTOCOL_VERSION,
        extensionId: browser.runtime.id,
      };
      this.ws?.send(JSON.stringify(handshake));
    };

    this.ws.onmessage = (event) => {
      if (gen !== this.generation) return;
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        console.log('[browser-cli] Received message:', msg.type, msg);
        this.handleMessage(msg);
      } catch (err) {
        console.error('[browser-cli] Failed to parse WS message:', err, event.data);
      }
    };

    this.ws.onclose = (event) => {
      if (gen !== this.generation) return;
      console.log('[browser-cli] WebSocket closed:', event.code, event.reason);
      const wasConnected = this.connected;
      this.connected = false;
      this.sessionId = null;
      if (wasConnected) {
        this.options.onDisconnect?.();
      }
      this.scheduleReconnect();
    };

    this.ws.onerror = (event) => {
      if (gen !== this.generation) return;
      console.error('[browser-cli] WebSocket error:', event);
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
    this.options.onReconnecting?.(this.backoff);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
  }

  /** Manually trigger reconnection (resets backoff) */
  reconnect(): void {
    this.cleanup();
    this.stopped = false;
    this.backoff = INITIAL_BACKOFF_MS;
    this.connect();
  }
}
