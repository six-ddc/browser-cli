/**
 * Persists the clientId → sessionId mapping to disk so that
 * the same browser instance gets the same session ID across daemon restarts.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SESSIONS_FILE = 'sessions.json';

/** Load the clientId→sessionId map from ~/.browser-cli/sessions.json */
export function loadSessionMap(appDir: string): Map<string, string> {
  try {
    const raw = readFileSync(join(appDir, SESSIONS_FILE), 'utf-8');
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const map = new Map<string, string>();
      for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
        if (typeof v === 'string') {
          map.set(k, v);
        }
      }
      return map;
    }
  } catch {
    // Missing or corrupt file — start fresh
  }
  return new Map();
}

/** Save the clientId→sessionId map to ~/.browser-cli/sessions.json */
export function saveSessionMap(appDir: string, map: Map<string, string>): void {
  const obj = Object.fromEntries(map);
  writeFileSync(join(appDir, SESSIONS_FILE), JSON.stringify(obj, null, 2) + '\n');
}
