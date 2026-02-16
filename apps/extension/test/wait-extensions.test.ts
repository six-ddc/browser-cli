/**
 * Tests for wait operation extensions: text, load state, function evaluation.
 * Also covers existing wait modes (duration, selector) for completeness.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleWait } from '../src/content-lib/wait';
import type { Command } from '@browser-cli/shared';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Duration wait ───────────────────────────────────────────────────

describe('wait duration', () => {
  it('resolves after specified duration', async () => {
    const promise = handleWait({
      action: 'wait',
      params: { duration: 500 },
    } as Command);

    vi.advanceTimersByTime(500);

    const result = await promise;
    expect(result).toEqual({ found: true });
  });

  it('waits for 0ms immediately', async () => {
    const promise = handleWait({
      action: 'wait',
      params: { duration: 0 },
    } as Command);

    vi.advanceTimersByTime(0);

    const result = await promise;
    expect(result).toEqual({ found: true });
  });
});

// ─── Selector wait ───────────────────────────────────────────────────

describe('wait selector', () => {
  it('resolves immediately if element exists', async () => {
    // Use real timers since MutationObserver + setInterval relies on real event loop
    vi.useRealTimers();
    document.body.innerHTML = '<div class="loaded">Content</div>';

    const result = await handleWait({
      action: 'wait',
      // visible: false because jsdom getBoundingClientRect() returns zero dimensions
      params: { selector: '.loaded', timeout: 5000, visible: false },
    } as Command);

    expect(result).toEqual({ found: true });
    vi.useFakeTimers();
  });

  it('throws if element not found within timeout', async () => {
    const promise = handleWait({
      action: 'wait',
      params: { selector: '.nonexistent', timeout: 1000 },
    } as Command);

    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('Timeout waiting for selector');
  });
});

// ─── Text wait ───────────────────────────────────────────────────────

describe('wait --text', () => {
  it('resolves immediately if text already exists', async () => {
    document.body.innerHTML = '<p>Loading complete</p>';

    const result = await handleWait({
      action: 'wait',
      params: { text: 'Loading complete', timeout: 5000 },
    } as Command);

    expect(result).toEqual({ found: true });
  });

  it('waits for text to appear via DOM mutation', async () => {
    document.body.innerHTML = '<p>Loading...</p>';

    const promise = handleWait({
      action: 'wait',
      params: { text: 'Done', timeout: 5000 },
    } as Command);

    // Simulate text appearing after a delay
    setTimeout(() => {
      document.body.innerHTML = '<p>Done</p>';
    }, 200);

    vi.advanceTimersByTime(300);

    const result = await promise;
    expect(result).toEqual({ found: true });
  });

  it('times out if text never appears', async () => {
    document.body.innerHTML = '<p>Loading...</p>';

    const promise = handleWait({
      action: 'wait',
      params: { text: 'Finished', timeout: 1000 },
    } as Command);

    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('Timeout waiting for text "Finished"');
  });

  it('finds partial text match', async () => {
    document.body.innerHTML = '<p>The operation has completed successfully.</p>';

    const result = await handleWait({
      action: 'wait',
      params: { text: 'completed', timeout: 5000 },
    } as Command);

    expect(result).toEqual({ found: true });
  });
});

// ─── Load state wait ─────────────────────────────────────────────────

describe('wait --load', () => {
  it('resolves for domcontentloaded when document is interactive', async () => {
    // In test environment, readyState is already 'complete' (past 'loading')
    const result = await handleWait({
      action: 'wait',
      params: { load: 'domcontentloaded', timeout: 5000 },
    } as Command);

    expect(result).toEqual({ found: true });
  });

  it('resolves for load when document is complete', async () => {
    // In test environment, readyState is 'complete'
    const result = await handleWait({
      action: 'wait',
      params: { load: 'load', timeout: 5000 },
    } as Command);

    expect(result).toEqual({ found: true });
  });

  it('resolves for networkidle after load + buffer', async () => {
    const promise = handleWait({
      action: 'wait',
      params: { load: 'networkidle', timeout: 5000 },
    } as Command);

    // networkidle waits 500ms after load
    vi.advanceTimersByTime(600);

    const result = await promise;
    expect(result).toEqual({ found: true });
  });
});

// ─── Function wait ───────────────────────────────────────────────────

describe('wait --fn', () => {
  it('times out if function never returns truthy', async () => {
    const promise = handleWait({
      action: 'wait',
      params: { fn: 'false', timeout: 1000 },
    } as Command);

    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('Timeout waiting for function');
  });

  // Note: MAIN world script injection via <script> tags doesn't work in jsdom
  // the same way as in a real browser. The function evaluation tests are limited
  // to timeout/error scenarios. Full integration testing requires a real browser.
});

// ─── URL wait ────────────────────────────────────────────────────────

describe('waitForUrl', () => {
  it('resolves immediately if URL matches', async () => {
    // Use real timers — fake timers can interfere with setInterval-based polling fallback
    vi.useRealTimers();
    // vitest jsdom sets location.href to http://localhost:3000/
    const result = await handleWait({
      action: 'waitForUrl',
      params: { pattern: 'localhost', timeout: 5000 },
    } as Command);

    expect(result).toEqual({ url: expect.stringContaining('localhost') });
    vi.useFakeTimers();
  });

  it('times out if URL never matches', async () => {
    const promise = handleWait({
      action: 'waitForUrl',
      params: { pattern: 'https://example.com', timeout: 1000 },
    } as Command);

    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('Timeout waiting for URL pattern');
  });
});

// ─── Error handling ──────────────────────────────────────────────────

describe('error handling', () => {
  it('throws when no wait mode specified', async () => {
    await expect(
      handleWait({
        action: 'wait',
        params: {},
      } as Command),
    ).rejects.toThrow('Provide selector, duration, text, load, or fn');
  });

  it('throws on unknown wait action', async () => {
    await expect(
      handleWait({
        action: 'waitForSomething' as 'wait',
        params: {},
      } as Command),
    ).rejects.toThrow('Unknown wait command');
  });
});
