/**
 * Tests for browser config handlers: setGeo, setMedia.
 * These inject scripts into the MAIN world via <script> element.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleBrowserConfig } from '../src/content-lib/browser-config';
import type { Command } from '@browser-cli/shared';

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─── setGeo ──────────────────────────────────────────────────────────

describe('setGeo', () => {
  it('returns { set: true }', async () => {
    const result = await handleBrowserConfig({
      action: 'setGeo',
      params: { latitude: 37.7749, longitude: -122.4194 },
    } as Command);

    expect(result).toEqual({ set: true });
  });

  it('returns { set: true } with custom accuracy', async () => {
    const result = await handleBrowserConfig({
      action: 'setGeo',
      params: { latitude: 51.5074, longitude: -0.1278, accuracy: 50 },
    } as Command);

    expect(result).toEqual({ set: true });
  });

  it('injects a script element into documentElement', async () => {
    const originalAppendChild = document.documentElement.appendChild.bind(document.documentElement);
    let injectedScript: string | null = null;

    document.documentElement.appendChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) {
        injectedScript = node.textContent;
      }
      return originalAppendChild(node);
    };

    await handleBrowserConfig({
      action: 'setGeo',
      params: { latitude: 40.7128, longitude: -74.006, accuracy: 10 },
    } as Command);

    // Restore
    document.documentElement.appendChild = originalAppendChild;

    expect(injectedScript).not.toBeNull();
    expect(injectedScript).toContain('40.7128');
    expect(injectedScript).toContain('-74.006');
    expect(injectedScript).toContain('10');
    expect(injectedScript).toContain('navigator.geolocation.getCurrentPosition');
    expect(injectedScript).toContain('navigator.geolocation.watchPosition');
  });

  it('uses default accuracy of 100 when not specified', async () => {
    const originalAppendChild = document.documentElement.appendChild.bind(document.documentElement);
    let injectedScript: string | null = null;

    document.documentElement.appendChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) {
        injectedScript = node.textContent;
      }
      return originalAppendChild(node);
    };

    await handleBrowserConfig({
      action: 'setGeo',
      params: { latitude: 0, longitude: 0 },
    } as Command);

    document.documentElement.appendChild = originalAppendChild;

    expect(injectedScript).toContain('accuracy: 100');
  });
});

// ─── setMedia ────────────────────────────────────────────────────────

describe('setMedia', () => {
  it('returns { set: true } for dark mode', async () => {
    const result = await handleBrowserConfig({
      action: 'setMedia',
      params: { colorScheme: 'dark' },
    } as Command);

    expect(result).toEqual({ set: true });
  });

  it('returns { set: true } for light mode', async () => {
    const result = await handleBrowserConfig({
      action: 'setMedia',
      params: { colorScheme: 'light' },
    } as Command);

    expect(result).toEqual({ set: true });
  });

  it('injects script that overrides matchMedia for dark scheme', async () => {
    const originalAppendChild = document.documentElement.appendChild.bind(document.documentElement);
    let injectedScript: string | null = null;

    document.documentElement.appendChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) {
        injectedScript = node.textContent;
      }
      return originalAppendChild(node);
    };

    await handleBrowserConfig({
      action: 'setMedia',
      params: { colorScheme: 'dark' },
    } as Command);

    document.documentElement.appendChild = originalAppendChild;

    expect(injectedScript).not.toBeNull();
    expect(injectedScript).toContain('window.matchMedia');
    expect(injectedScript).toContain('prefers-color-scheme: dark');
    expect(injectedScript).toContain('prefers-color-scheme: light');
    // Dark mode: dark query matches (true), light query does not (false)
    expect(injectedScript).toContain('matches: true');
    expect(injectedScript).toContain('matches: false');
  });

  it('injects script that overrides matchMedia for light scheme', async () => {
    const originalAppendChild = document.documentElement.appendChild.bind(document.documentElement);
    let injectedScript: string | null = null;

    document.documentElement.appendChild = function <T extends Node>(node: T): T {
      if (node instanceof HTMLScriptElement) {
        injectedScript = node.textContent;
      }
      return originalAppendChild(node);
    };

    await handleBrowserConfig({
      action: 'setMedia',
      params: { colorScheme: 'light' },
    } as Command);

    document.documentElement.appendChild = originalAppendChild;

    expect(injectedScript).not.toBeNull();
    // Light mode: dark query does NOT match, light query matches
    // The script contains both true and false for the two queries
    expect(injectedScript).toContain('window.matchMedia');
  });

  it('cleans up injected script element', async () => {
    const scriptsBefore = document.querySelectorAll('script').length;

    await handleBrowserConfig({
      action: 'setMedia',
      params: { colorScheme: 'dark' },
    } as Command);

    const scriptsAfter = document.querySelectorAll('script').length;
    // Script should be removed after injection
    expect(scriptsAfter).toBe(scriptsBefore);
  });
});

// ─── Error handling ──────────────────────────────────────────────────

describe('error handling', () => {
  it('throws on unknown browser config command', async () => {
    await expect(
      handleBrowserConfig({
        action: 'setUnknown' as 'setGeo',
        params: { latitude: 0, longitude: 0 },
      } as Command),
    ).rejects.toThrow('Unknown browser config command');
  });
});
