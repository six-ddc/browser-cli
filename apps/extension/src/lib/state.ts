/**
 * Connection state management using browser.storage.local.
 * Uses a serial queue to prevent concurrent read-modify-write races.
 */

import { DEFAULT_WS_HOST, DEFAULT_WS_PORT } from '@browser-cli/shared';

/**
 * WS host configured at build time via VITE_WS_HOST env var.
 * Defaults to DEFAULT_WS_HOST (127.0.0.1). E2E builds override this.
 */
export const CONFIGURED_WS_HOST: string =
  (import.meta.env.VITE_WS_HOST as string) || DEFAULT_WS_HOST;

/**
 * WS port configured at build time via VITE_WS_PORT env var.
 * Defaults to DEFAULT_WS_PORT (9222). E2E builds override this.
 */
export const CONFIGURED_WS_PORT: number = Number(import.meta.env.VITE_WS_PORT) || DEFAULT_WS_PORT;

export interface ConnectionState {
  enabled: boolean;
  connected: boolean;
  sessionId: string | null;
  host: string;
  port: number;
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
  host: CONFIGURED_WS_HOST,
  port: CONFIGURED_WS_PORT,
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
    typeof obj.host === 'string' &&
    typeof obj.port === 'number' &&
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
      const migrated = { ...DEFAULT_STATE, ...obj };
      if (obj.enabled === undefined) migrated.enabled = true;
      if (obj.host === undefined) migrated.host = CONFIGURED_WS_HOST;
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

export async function getHost(): Promise<string> {
  const state = await getState();
  return state.host;
}

export async function setHost(host: string): Promise<void> {
  await setState({ host });
}

export async function getPort(): Promise<number> {
  const state = await getState();
  return state.port;
}

export async function setPort(port: number): Promise<void> {
  await setState({ port });
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
