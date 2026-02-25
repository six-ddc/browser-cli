/**
 * WebSocket client for the extension background service worker.
 * Connects to the daemon's WS server with exponential backoff reconnection.
 */

import { PROTOCOL_VERSION, schemas } from '@browser-cli/shared';
import { CONFIGURED_WS_HOST, CONFIGURED_WS_PORT } from './state';
import type {
  WsMessage,
  RequestMessage,
  ResponseMessage,
  HandshakeAckMessage,
  BrowserInfo,
} from '@browser-cli/shared';

export type MessageHandler = (msg: RequestMessage) => Promise<ResponseMessage>;

export interface WsClientOptions {
  host?: string;
  port?: number;
  /** Persistent client ID for stable session assignment across reconnections */
  clientId?: string;
  /** Auth token for non-loopback daemon connections */
  token?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onHandshake?: (ack: HandshakeAckMessage) => void;
  onReconnecting?: (nextRetryMs: number) => void;
  /** Called when daemon rejects connection due to invalid/missing auth token */
  onAuthFailed?: () => void;
  messageHandler?: MessageHandler;
}

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;
/** Minimum delay (ms) to use chrome.alarms (Chrome enforces 1-minute minimum) */
const ALARM_THRESHOLD_MS = 60_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;
const MAX_PENDING_EVENTS = 50;
const HEARTBEAT_ALARM_NAME = 'browser-cli-heartbeat';

export class WsClient {
  private ws: WebSocket | null = null;
  private host: string;
  private port: number;
  private token: string;
  private backoff = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private sessionId: string | null = null;
  private options: WsClientOptions;
  private stopped = false;
  /** Monotonic counter to detect stale WebSocket callbacks */
  private generation = 0;
  /** Timestamp of last message received (for heartbeat timeout) */
  private lastMessageTime = 0;
  /** Queued events while disconnected */
  private pendingEvents: string[] = [];

  constructor(options: WsClientOptions = {}) {
    this.host = options.host ?? CONFIGURED_WS_HOST;
    this.port = options.port ?? CONFIGURED_WS_PORT;
    this.token = options.token ?? '';
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

  updateHost(host: string): void {
    this.host = host;
    this.cleanup();
    this.stopped = false;
    this.backoff = INITIAL_BACKOFF_MS;
    this.connect();
  }

  updateToken(token: string): void {
    this.token = token;
    // Reconnect to re-authenticate with new token
    if (this.connected || this.isReconnecting) {
      this.cleanup();
      this.stopped = false;
      this.backoff = INITIAL_BACKOFF_MS;
      this.connect();
    }
  }

  updatePort(port: number): void {
    this.port = port;
    this.cleanup();
    this.stopped = false;
    this.backoff = INITIAL_BACKOFF_MS;
    this.connect();
  }

  /** Called by alarm handler when 'browser-cli-reconnect' fires */
  onAlarmFired(): void {
    if (!this.stopped && !this.connected) {
      this.connect();
    }
  }

  /** Check if the connection has gone stale (no messages within timeout) */
  checkHeartbeat(): void {
    if (!this.connected || !this.ws || this.lastMessageTime === 0) return;
    if (Date.now() - this.lastMessageTime > HEARTBEAT_TIMEOUT_MS) {
      console.log('[browser-cli] Heartbeat timeout — reconnecting');
      this.cleanup();
      this.options.onDisconnect?.();
      this.scheduleReconnect();
    }
  }

  private cleanup(): void {
    // Bump generation so any pending callbacks from the old ws become no-ops
    this.generation++;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Clear heartbeat alarm — no longer needed when disconnected
    void browser.alarms.clear(HEARTBEAT_ALARM_NAME);
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
    console.log(`[browser-cli] Connecting to ws://${this.host}:${this.port}...`);

    try {
      this.ws = new WebSocket(`ws://${this.host}:${this.port}`);
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
        browser: parseBrowserInfo(navigator.userAgent),
        ...(this.options.clientId ? { clientId: this.options.clientId } : {}),
        ...(this.token ? { token: this.token } : {}),
      };
      this.ws?.send(JSON.stringify(handshake));
    };

    this.ws.onmessage = (event) => {
      if (gen !== this.generation) return;
      this.lastMessageTime = Date.now();
      try {
        const parsed: unknown = JSON.parse(event.data as string);
        const result = schemas.wsMessageSchema.safeParse(parsed);
        if (!result.success) {
          console.error(
            '[browser-cli] Invalid WS message (schema validation failed):',
            result.error,
            parsed,
          );
          return;
        }
        const msg = result.data as WsMessage;
        console.log('[browser-cli] Received message:', msg.type, msg);
        void this.handleMessage(msg);
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
      // Auth failure — don't auto-reconnect, notify caller
      if (event.code === 4401) {
        console.warn('[browser-cli] Auth failed — not reconnecting. Set a valid token.');
        this.stopped = true;
        this.options.onAuthFailed?.();
        return;
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
        this.options.onHandshake?.(msg);
        this.flushPendingEvents();
        // Create periodic heartbeat alarm so checkHeartbeat() survives SW suspension
        void browser.alarms.create(HEARTBEAT_ALARM_NAME, { periodInMinutes: 1 });
        break;
      }
      case 'ping': {
        const pong = { type: 'pong' as const, timestamp: msg.timestamp };
        this.ws?.send(JSON.stringify(pong));
        break;
      }
      case 'request': {
        if (this.options.messageHandler) {
          const response = await this.options.messageHandler(msg);
          if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(response));
          } else {
            console.warn(`[browser-cli] Dropping response for #${response.id} — WebSocket closed`);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  /** Send an event to the daemon (queues if disconnected) */
  sendEvent(event: string, data: unknown, tabId?: number): void {
    const msg = JSON.stringify({
      type: 'event' as const,
      event,
      data,
      tabId,
      timestamp: Date.now(),
    });

    if (!this.connected || !this.ws) {
      if (this.pendingEvents.length < MAX_PENDING_EVENTS) {
        this.pendingEvents.push(msg);
      }
      return;
    }
    this.ws.send(msg);
  }

  /** Flush queued events after reconnection */
  private flushPendingEvents(): void {
    if (!this.connected || !this.ws || this.pendingEvents.length === 0) return;
    const events = this.pendingEvents.splice(0);
    for (const msg of events) {
      this.ws.send(msg);
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;

    // Add ±20% jitter to prevent thundering herd
    const jitter = 1 + (Math.random() * 0.4 - 0.2);
    const delay = Math.round(this.backoff * jitter);

    this.options.onReconnecting?.(delay);

    // Always use setTimeout for immediate reconnection
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);

    // For long delays, also set a chrome.alarm as belt-and-suspenders
    // (setTimeout may not fire if SW is suspended)
    if (delay >= ALARM_THRESHOLD_MS) {
      void browser.alarms.create('browser-cli-reconnect', { delayInMinutes: delay / 60000 });
    }

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

/** Parse browser name and version from a User-Agent string */
function parseBrowserInfo(ua: string): BrowserInfo {
  let name = 'Unknown';
  let version = '';

  // Order matters: check more specific browsers before generic ones
  if (ua.includes('Edg/')) {
    name = 'Edge';
    version = ua.match(/Edg\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    name = 'Opera';
    version = ua.match(/(?:OPR|Opera)\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Brave')) {
    name = 'Brave';
    version = ua.match(/Brave\/([\d.]+)/)?.[1] ?? ua.match(/Chrome\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Vivaldi/')) {
    name = 'Vivaldi';
    version = ua.match(/Vivaldi\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Firefox/')) {
    name = 'Firefox';
    version = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    name = 'Safari';
    version = ua.match(/Version\/([\d.]+)/)?.[1] ?? '';
  } else if (ua.includes('Chrome/')) {
    name = 'Chrome';
    version = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? '';
  }

  return { name, version, userAgent: ua };
}
