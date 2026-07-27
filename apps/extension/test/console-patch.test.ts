/**
 * Tests for console-patch: installConsoleCapture patches console methods,
 * captures window.onerror / unhandledrejection as pageerror entries, and
 * exposes window.__browserCliConsoleRead for retrieval.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { installConsoleCapture } from '../src/content-lib/console-patch';

function read(level?: string, limit?: number, clear?: boolean) {
  const fn = window.__browserCliConsoleRead;
  if (!fn) throw new Error('__browserCliConsoleRead not installed');
  return fn(level, limit, clear);
}

describe('installConsoleCapture', () => {
  beforeEach(() => {
    // Reset patch state between tests — installConsoleCapture is idempotent
    // by design, so simulate a fresh page by clearing the patched flag and
    // restoring original console methods is not straightforward; instead we
    // rely on `clear: true` reads and re-invoke install (no-op if patched).
    delete (window as unknown as Record<string, unknown>).__browserCliConsolePatched;
    delete (window as unknown as Record<string, unknown>).__browserCliConsoleEntries;
    delete (window as unknown as Record<string, unknown>).__browserCliConsoleRead;
    installConsoleCapture();
    // Start each test with an empty buffer.
    read(undefined, undefined, true);
  });

  it('is idempotent: repeated install does not double-patch', () => {
    const patchedLog = console.log;
    installConsoleCapture();
    installConsoleCapture();
    expect(console.log).toBe(patchedLog);

    console.log('once');
    const { entries } = read();
    expect(entries.filter((e) => (e as { args: unknown[] }).args[0] === 'once')).toHaveLength(1);
  });

  it('keeps only the most recent 1000 entries and reports dropped count', () => {
    for (let i = 0; i < 1005; i++) {
      console.log(`msg-${i}`);
    }
    const { entries, dropped } = read();
    expect(entries).toHaveLength(1000);
    expect(dropped).toBe(5);
    const firstArgs = (entries[0] as { args: unknown[] }).args;
    expect(firstArgs[0]).toBe('msg-5');
    const lastArgs = (entries[999] as { args: unknown[] }).args;
    expect(lastArgs[0]).toBe('msg-1004');
  });

  it('serializes Error arguments preserving message and stack', () => {
    console.error(new Error('boom'));
    const { entries } = read('error');
    expect(entries).toHaveLength(1);
    const arg = (entries[0] as { args: unknown[] }).args[0] as {
      __error: boolean;
      message: string;
      stack?: string;
    };
    expect(arg.__error).toBe(true);
    expect(arg.message).toBe('boom');
    expect(arg.stack).toBeTruthy();
  });

  it('captures window error events as pageerror entries with stack/source', () => {
    const err = new Error('uncaught-boom');
    const event = new ErrorEvent('error', {
      message: 'uncaught-boom',
      filename: 'test.js',
      lineno: 12,
      colno: 34,
      error: err,
    });
    window.dispatchEvent(event);

    const { entries } = read('pageerror');
    expect(entries).toHaveLength(1);
    const entry = entries[0] as { args: unknown[]; stack?: string; source?: string };
    expect(entry.args[0]).toBe('uncaught-boom');
    expect(entry.stack).toBe(err.stack);
    expect(entry.source).toBe('test.js:12:34');
  });

  it('captures unhandledrejection events as pageerror entries', () => {
    const rejectionError = new Error('rejected-boom');
    const event = new Event('unhandledrejection');
    Object.defineProperty(event, 'reason', { value: rejectionError });
    window.dispatchEvent(event);

    const { entries } = read('pageerror');
    expect(entries).toHaveLength(1);
    const entry = entries[0] as { args: unknown[]; stack?: string };
    expect(entry.args[0] as string).toContain('rejected-boom');
    expect(entry.stack).toBe(rejectionError.stack);
  });

  it('filters by level in __browserCliConsoleRead', () => {
    console.log('a-log');
    console.warn('a-warn');
    console.error('an-error');

    expect(read('log').entries).toHaveLength(1);
    expect(read('warn').entries).toHaveLength(1);
    expect(read('error').entries).toHaveLength(1);
  });

  it('limit returns only the most recent n entries', () => {
    console.log('first');
    console.log('second');
    console.log('third');

    const { entries } = read(undefined, 2);
    expect(entries).toHaveLength(2);
    expect((entries[0] as { args: unknown[] }).args[0]).toBe('second');
    expect((entries[1] as { args: unknown[] }).args[0]).toBe('third');
  });

  it('clear empties the buffer and resets dropped count', () => {
    console.log('to-be-cleared');
    expect(read().entries).toHaveLength(1);

    const result = read(undefined, undefined, true);
    expect(result.entries).toHaveLength(1); // read() returns the pre-clear snapshot

    expect(read().entries).toHaveLength(0);
    expect(read().dropped).toBe(0);
  });
});
