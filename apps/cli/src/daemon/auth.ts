import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { getAuthTokenPath } from '../util/paths.js';

/** Hosts that are considered loopback (no auth required) */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/** Check if a host requires auth token (non-loopback) */
export function isNonLoopback(host: string): boolean {
  return !LOOPBACK_HOSTS.has(host);
}

/**
 * Origin schemes a browser sets when the connection comes from an extension's
 * own context. Everything else that carries an Origin header is a web page.
 */
const EXTENSION_ORIGIN_SCHEMES = new Set([
  'chrome-extension:',
  'moz-extension:',
  'safari-web-extension:',
  'extension:',
]);

export type OriginVerdict =
  | { allowed: true; reason: 'extension-origin' | 'no-origin' }
  | { allowed: false; reason: 'web-origin'; origin: string };

/**
 * Decide whether a WebSocket handshake may proceed, based on its Origin header.
 *
 * A page at https://evil.example can open `ws://127.0.0.1:9222` — binding to
 * loopback does not stop it, because the browser itself is the one connecting.
 * The Origin header is the only thing that distinguishes that from the
 * extension, and a page cannot forge it.
 *
 * No Origin header at all means a non-browser client (the extension's tests,
 * a script); those are gated by the auth token instead, at handshake time.
 */
export function verifyWsOrigin(origin: string | undefined): OriginVerdict {
  if (origin === undefined || origin === '') return { allowed: true, reason: 'no-origin' };

  let scheme: string;
  try {
    scheme = new URL(origin).protocol;
  } catch {
    return { allowed: false, reason: 'web-origin', origin };
  }

  if (EXTENSION_ORIGIN_SCHEMES.has(scheme)) return { allowed: true, reason: 'extension-origin' };
  return { allowed: false, reason: 'web-origin', origin };
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
