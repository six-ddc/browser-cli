/**
 * Connection state management using browser.storage.local.
 * Uses a serial queue to prevent concurrent read-modify-write races.
 */

import { DEFAULT_WS_PORT } from '@browser-cli/shared';

/**
 * WS port configured at build time via VITE_WS_PORT env var.
 * Defaults to DEFAULT_WS_PORT (9222). E2E builds override this.
 */
export const CONFIGURED_WS_PORT: number =
  Number(import.meta.env.VITE_WS_PORT) || DEFAULT_WS_PORT;

export interface ConnectionState {
  connected: boolean;
  sessionId: string | null;
  port: number;
  lastConnected: number | null;
  lastDisconnected: number | null;
  reconnecting: boolean;
  nextRetryIn: number | null;
}

const DEFAULT_STATE: ConnectionState = {
  connected: false,
  sessionId: null,
  port: CONFIGURED_WS_PORT,
  lastConnected: null,
  lastDisconnected: null,
  reconnecting: false,
  nextRetryIn: null,
};

const STORAGE_KEY = 'browserCliState';

/** Validate stored state has the expected shape */
export function isValidState(raw: unknown): raw is ConnectionState {
  if (typeof raw !== 'object' || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.connected === 'boolean' &&
    (typeof obj.sessionId === 'string' || obj.sessionId === null) &&
    typeof obj.port === 'number' &&
    (typeof obj.lastConnected === 'number' || obj.lastConnected === null) &&
    (typeof obj.lastDisconnected === 'number' || obj.lastDisconnected === null) &&
    typeof obj.reconnecting === 'boolean' &&
    (typeof obj.nextRetryIn === 'number' || obj.nextRetryIn === null)
  );
}

/** Serial queue: each setState waits for the previous one to finish */
let pending: Promise<void> = Promise.resolve();

export async function getState(): Promise<ConnectionState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw) return { ...DEFAULT_STATE };

  if (!isValidState(raw)) {
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

export async function getPort(): Promise<number> {
  const state = await getState();
  return state.port;
}

export async function setPort(port: number): Promise<void> {
  await setState({ port });
}
