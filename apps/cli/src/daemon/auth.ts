import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { getAuthTokenPath } from '../util/paths.js';

/** Hosts that are considered loopback (no auth required) */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Check if a host requires auth token (non-loopback) */
export function isNonLoopback(host: string): boolean {
  return !LOOPBACK_HOSTS.has(host);
}

/** Generate a random auth token (32 bytes, hex-encoded) */
export function generateAuthToken(): string {
  return randomBytes(32).toString('hex');
}

/** Write auth token to disk */
export function writeAuthToken(token: string): void {
  writeFileSync(getAuthTokenPath(), token, { mode: 0o600 });
}

/** Read auth token from disk, or null if not present */
export function readAuthToken(): string | null {
  const path = getAuthTokenPath();
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf-8').trim();
  } catch {
    return null;
  }
}

/** Remove auth token file */
export function cleanupAuthToken(): void {
  const path = getAuthTokenPath();
  try {
    if (existsSync(path)) unlinkSync(path);
  } catch {
    // ignore
  }
}
