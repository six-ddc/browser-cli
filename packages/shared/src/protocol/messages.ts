/**
 * Wire protocol messages between CLI ↔ Daemon ↔ Extension.
 */

import type { ActionResultMap, ActionType, Command } from './actions.js';
import type { ProtocolError } from './errors.js';

// ─── CLI ↔ Daemon (NDJSON over Unix socket) ─────────────────────────

/** CLI sends this to the daemon */
export interface DaemonRequest {
  id: string;
  command: Command;
  /** Target tab (optional — daemon can default to active tab) */
  tabId?: number;
  /** Target browser session (optional — daemon routes to default if omitted) */
  sessionId?: string;
}

/** Daemon replies to CLI */
export interface DaemonResponse<A extends ActionType = ActionType> {
  id: string;
  success: boolean;
  data?: ActionResultMap[A];
  error?: ProtocolError;
}

// ─── Daemon ↔ Extension (WebSocket / JSON) ──────────────────────────

/** Daemon → Extension: execute a command */
export interface RequestMessage {
  id: string;
  type: 'request';
  command: Command;
  tabId?: number;
}

/** Extension → Daemon: command result */
export interface ResponseMessage {
  id: string;
  type: 'response';
  success: boolean;
  data?: unknown;
  error?: ProtocolError;
}

/** Extension → Daemon: push event (console, error, dialog, etc.) */
export interface EventMessage {
  type: 'event';
  event: string;
  data: unknown;
  tabId?: number;
  timestamp: number;
}

/** Browser identity sent during handshake */
export interface BrowserInfo {
  name: string;
  version: string;
  userAgent: string;
}

/** Extension → Daemon: initial handshake */
export interface HandshakeMessage {
  type: 'handshake';
  protocolVersion: string;
  extensionId: string;
  browser?: BrowserInfo;
}

/** Daemon → Extension: handshake acknowledgement */
export interface HandshakeAckMessage {
  type: 'handshake_ack';
  protocolVersion: string;
  sessionId: string;
}

/** Heartbeat ping (daemon → extension) */
export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

/** Heartbeat pong (extension → daemon) */
export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

/** All possible WebSocket messages */
export type WsMessage =
  | RequestMessage
  | ResponseMessage
  | EventMessage
  | HandshakeMessage
  | HandshakeAckMessage
  | PingMessage
  | PongMessage;
