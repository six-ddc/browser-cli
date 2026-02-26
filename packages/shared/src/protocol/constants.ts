/** Default WebSocket host for daemon ↔ extension communication */
export const DEFAULT_WS_HOST = '127.0.0.1';

/** Default WebSocket port for daemon ↔ extension communication */
export const DEFAULT_WS_PORT = 9222;

/** Default WebSocket URL for extension → daemon connection */
export const DEFAULT_WS_URL = `ws://${DEFAULT_WS_HOST}:${DEFAULT_WS_PORT}`;

/** Protocol version for handshake compatibility */
export const PROTOCOL_VERSION = '1.0.0';

/** Heartbeat interval in milliseconds (daemon sends ping) */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** Heartbeat timeout — disconnect if no pong within this window */
export const HEARTBEAT_TIMEOUT_MS = 15_000;

/** Default timeout for CLI commands waiting for a response */
export const COMMAND_TIMEOUT_MS = 30_000;

/** App directory name under home */
export const APP_DIR_NAME = '.browser-cli';
