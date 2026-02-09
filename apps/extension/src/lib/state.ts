/**
 * Connection state management using chrome.storage.local.
 */

export interface ConnectionState {
  connected: boolean;
  sessionId: string | null;
  port: number;
  lastConnected: number | null;
  lastDisconnected: number | null;
}

const DEFAULT_STATE: ConnectionState = {
  connected: false,
  sessionId: null,
  port: 9222,
  lastConnected: null,
  lastDisconnected: null,
};

const STORAGE_KEY = 'browserCliState';

export async function getState(): Promise<ConnectionState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_STATE, ...(result[STORAGE_KEY] ?? {}) };
}

export async function setState(updates: Partial<ConnectionState>): Promise<void> {
  const current = await getState();
  await chrome.storage.local.set({
    [STORAGE_KEY]: { ...current, ...updates },
  });
}

export async function getPort(): Promise<number> {
  const state = await getState();
  return state.port;
}

export async function setPort(port: number): Promise<void> {
  await setState({ port });
}
