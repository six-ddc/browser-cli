/**
 * localStorage/sessionStorage access from content script.
 */

import type { Command } from '@browser-cli/shared';

export async function handleStorage(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'storageGet': {
      const { key, area } = command.params as {
        key?: string;
        area?: 'local' | 'session';
      };
      const storage = area === 'session' ? sessionStorage : localStorage;

      if (key) {
        const value = storage.getItem(key);
        return { entries: value !== null ? { [key]: value } : {} };
      }

      const entries: Record<string, string> = {};
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k) entries[k] = storage.getItem(k) ?? '';
      }
      return { entries };
    }
    case 'storageSet': {
      const { key, value, area } = command.params as {
        key: string;
        value: string;
        area?: 'local' | 'session';
      };
      const storage = area === 'session' ? sessionStorage : localStorage;
      try {
        storage.setItem(key, value);
      } catch (err) {
        if ((err as DOMException).name === 'QuotaExceededError') {
          throw new Error(
            `Storage quota exceeded when setting key "${key}" (${area ?? 'local'}Storage). ` +
            `Hint: Clear unused entries with "storage clear ${area ?? 'local'}" before adding new data.`,
          );
        }
        throw err;
      }
      return { set: true };
    }
    case 'storageClear': {
      const { area } = command.params as { area?: 'local' | 'session' };
      const storage = area === 'session' ? sessionStorage : localStorage;
      storage.clear();
      return { cleared: true };
    }
    default:
      throw new Error(`Unknown storage command: ${(command as { action: string }).action}`);
  }
}
