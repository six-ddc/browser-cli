/**
 * Connection state management using browser.storage.local.
 * Uses a serial queue to prevent concurrent read-modify-write races.
 */

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
  port: 9222,
  lastConnected: null,
  lastDisconnected: null,
  reconnecting: false,
  nextRetryIn: null,
};

const STORAGE_KEY = 'browserCliState';

/** Serial queue: each setState waits for the previous one to finish */
let pending: Promise<void> = Promise.resolve();

export async function getState(): Promise<ConnectionState> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_STATE, ...(result[STORAGE_KEY] ?? {}) };
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
