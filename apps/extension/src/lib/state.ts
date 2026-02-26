/**
 * Connection state management using browser.storage.local.
 * Uses a serial queue to prevent concurrent read-modify-write races.
 */

import { DEFAULT_WS_HOST, DEFAULT_WS_URL } from '@browser-cli/shared';

/**
 * WS URL configured at build time via VITE_WS_URL env var.
 * Backward compat: if VITE_WS_URL is not set but VITE_WS_PORT is,
 * construct ws://127.0.0.1:${VITE_WS_PORT} (used by E2E tests).
 */
export const CONFIGURED_WS_URL: string = (() => {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) return envUrl;
  const envPort = import.meta.env.VITE_WS_PORT as string | undefined;
  if (envPort) return `ws://${DEFAULT_WS_HOST}:${envPort}`;
  return DEFAULT_WS_URL;
})();

export interface ConnectionState {
  enabled: boolean;
  connected: boolean;
  sessionId: string | null;
  url: string;
  lastConnected: number | null;
  lastDisconnected: number | null;
  reconnecting: boolean;
  nextRetryIn: number | null;
  authFailed: boolean;
}

const DEFAULT_STATE: ConnectionState = {
  enabled: true,
  connected: false,
  sessionId: null,
  url: CONFIGURED_WS_URL,
  lastConnected: null,
  lastDisconnected: null,
  reconnecting: false,
  nextRetryIn: null,
  authFailed: false,
};

const STORAGE_KEY = 'browserCliState';

/** Validate stored state has the expected shape */
export function isValidState(raw: unknown): raw is ConnectionState {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.enabled === 'boolean' &&
    typeof obj.connected === 'boolean' &&
    (typeof obj.sessionId === 'string' || obj.sessionId === null) &&
    typeof obj.url === 'string' &&
    (typeof obj.lastConnected === 'number' || obj.lastConnected === null) &&
    (typeof obj.lastDisconnected === 'number' || obj.lastDisconnected === null) &&
    typeof obj.reconnecting === 'boolean' &&
    (typeof obj.nextRetryIn === 'number' || obj.nextRetryIn === null) &&
    typeof obj.authFailed === 'boolean'
  );
}

/** Serial queue: each setState waits for the previous one to finish */
let pending: Promise<void> = Promise.resolve();

export async function getState(): Promise<ConnectionState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw) return { ...DEFAULT_STATE };

  if (!isValidState(raw)) {
    // Migrate legacy state missing fields
    const obj = raw as Record<string, unknown>;
    if (typeof obj.connected === 'boolean') {
      // Migrate old host+port fields to url
      if (typeof obj.host === 'string' && typeof obj.port === 'number' && !obj.url) {
        obj.url = `ws://${obj.host}:${obj.port}`;
        delete obj.host;
        delete obj.port;
        console.log('[browser-cli] Migrated host+port → url:', obj.url);
      }
      const migrated = { ...DEFAULT_STATE, ...obj };
      if (obj.enabled === undefined) migrated.enabled = true;
      if (obj.url === undefined) migrated.url = CONFIGURED_WS_URL;
      if (obj.authFailed === undefined) migrated.authFailed = false;
      if (isValidState(migrated)) {
        console.log('[browser-cli] Migrated stored state (added missing fields)');
        await browser.storage.local.set({ [STORAGE_KEY]: migrated });
        return migrated;
      }
    }
    console.warn('[browser-cli] Invalid stored state, using defaults:', raw);
    return { ...DEFAULT_STATE };
  }
  return raw;
}

export function setState(updates: Partial<ConnectionState>): Promise<void> {
  pending = pending.then(async () => {
    const current = await getState();
    const newState = { ...current, ...updates };
    console.log('[browser-cli] setState:', updates, '→ new state:', newState);
    await browser.storage.local.set({
      [STORAGE_KEY]: newState,
    });
  });
  return pending;
}

export async function getUrl(): Promise<string> {
  const state = await getState();
  return state.url;
}

export async function setUrl(url: string): Promise<void> {
  await setState({ url });
}

export async function getEnabled(): Promise<boolean> {
  const state = await getState();
  return state.enabled;
}

// ─── Auth Token (stored separately from connection state) ─────────

const TOKEN_KEY = 'browserCliAuthToken';

export async function getToken(): Promise<string> {
  const result = await browser.storage.local.get(TOKEN_KEY);
  return typeof result[TOKEN_KEY] === 'string' ? result[TOKEN_KEY] : '';
}

export async function setToken(token: string): Promise<void> {
  await browser.storage.local.set({ [TOKEN_KEY]: token });
}
