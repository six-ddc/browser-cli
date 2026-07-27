/**
 * Console + page-error retrieval.
 *
 * Capture itself is installed eagerly at document_start by the MAIN-world
 * `console.content.ts` entrypoint (see console-patch.ts). This module only
 * needs to (a) fall back to injecting the patcher for pages/browsers where
 * the MAIN-world content script didn't run (Firefox, or a page that loaded
 * before the extension), and (b) read entries back out.
 */

import {
  BrowserCliError,
  type Command,
  type ConsoleEntry,
  type ConsoleLevel,
} from '@browser-cli/shared';
import { installConsoleCapture } from './console-patch';

async function isPatched(): Promise<boolean> {
  const response: { result?: unknown } | undefined = await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: '!!window.__browserCliConsolePatched',
  });
  return Boolean(response?.result);
}

/**
 * Ensure the console patcher is installed in the page's MAIN world.
 * No-op if the MAIN-world content script already installed it.
 *
 * A strict page CSP can block both the MAIN-world content script and this
 * fallback injection. Verify rather than assume: without the patch the buffer
 * is simply empty, which would read as "the page logged nothing".
 */
async function ensurePatched(): Promise<void> {
  if (await isPatched()) return;

  await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: `(${installConsoleCapture.toString()})()`,
  });

  if (await isPatched()) return;

  // No fallback exists. Uncaught page errors are not observable from the
  // isolated world either — 'error'/'unhandledrejection' raised by page scripts
  // are dispatched in the page's world and do not cross the isolation boundary
  // (verified against a CSP page that throws). Say so instead of returning an
  // empty buffer that reads as "the page logged nothing".
  throw new BrowserCliError(
    'CSP_BLOCKED',
    "This page's Content-Security-Policy blocked console capture, so neither console output nor page errors were recorded here.",
    "Capture needs to run in the page's own world, which this page forbids; there is no workaround on this page. Reproduce the behaviour on a page without a strict script-src policy, or read the errors from DevTools directly.",
  );
}

interface RawEntry {
  level?: unknown;
  args?: unknown;
  timestamp?: unknown;
  stack?: unknown;
  source?: unknown;
}

function coerceEntries(raw: unknown): ConsoleEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: ConsoleEntry[] = [];
  for (const rawItem of raw as unknown[]) {
    if (typeof rawItem !== 'object' || rawItem === null) continue;
    const item = rawItem as RawEntry;
    const level = item.level;
    const timestamp = item.timestamp;
    if (typeof level !== 'string' || typeof timestamp !== 'number') continue;
    entries.push({
      level: level as ConsoleLevel,
      args: Array.isArray(item.args) ? item.args : [],
      timestamp,
      stack: typeof item.stack === 'string' ? item.stack : undefined,
      source: typeof item.source === 'string' ? item.source : undefined,
    });
  }
  return entries;
}

/**
 * Read console entries from the MAIN world via background script.
 * Falls back to the legacy `__browserCliConsoleEntries` array (no read
 * function, no dropped counter) if present, and to an empty result
 * otherwise — never throws on a malformed/old buffer shape.
 */
async function readEntries(
  level: string | undefined,
  limit: number | undefined,
  clear: boolean | undefined,
): Promise<{ entries: ConsoleEntry[]; dropped: number }> {
  const expr = `(function() {
    if (typeof window.__browserCliConsoleRead === 'function') {
      return window.__browserCliConsoleRead(${level ? JSON.stringify(level) : 'undefined'}, ${
        typeof limit === 'number' ? String(limit) : 'undefined'
      }, ${clear ? 'true' : 'false'});
    }
    var entries = window.__browserCliConsoleEntries || [];
    if (${clear ? 'true' : 'false'}) window.__browserCliConsoleEntries = [];
    return { entries: entries, dropped: 0 };
  })()`;

  const response: { result?: string } | undefined = await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: `JSON.stringify(${expr})`,
  });

  let parsed: { entries?: unknown; dropped?: unknown } = {};
  try {
    parsed = JSON.parse(response?.result ?? '{}') as { entries?: unknown; dropped?: unknown };
  } catch {
    parsed = {};
  }

  return {
    entries: coerceEntries(parsed.entries),
    dropped: typeof parsed.dropped === 'number' ? parsed.dropped : 0,
  };
}

export async function handleConsole(command: Command): Promise<unknown> {
  await ensurePatched();

  switch (command.action) {
    case 'getConsole': {
      const { level, limit, clear } = command.params;
      const { entries, dropped } = await readEntries(level, limit, clear);
      return dropped > 0 ? { entries, dropped } : { entries };
    }
    case 'getErrors': {
      const { limit, clear } = command.params;
      // 'errors' surfaces both console.error() calls and uncaught
      // window.onerror/unhandledrejection (pageerror) entries. Read the
      // full buffer (unfiltered) first, then filter/clear client-side so a
      // single clear only clears the buffer once.
      const { entries } = await readEntries(undefined, undefined, false);
      let errors = entries
        .filter((e) => e.level === 'error' || e.level === 'pageerror')
        .sort((a, b) => a.timestamp - b.timestamp);
      if (typeof limit === 'number' && limit >= 0) {
        errors = errors.slice(Math.max(0, errors.length - limit));
      }
      if (clear) {
        await readEntries(undefined, undefined, true);
      }
      return { errors };
    }
    default:
      throw new Error(`Unknown console command: ${(command as { action: string }).action}`);
  }
}
