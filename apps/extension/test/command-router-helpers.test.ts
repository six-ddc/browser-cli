/**
 * Tests for exported helper functions in command-router:
 * cookieToInfo.
 */

import { describe, it, expect } from 'vitest';
import { cookieToInfo } from '../src/lib/command-router';

type CookieInput = Parameters<typeof cookieToInfo>[0];

// ─── cookieToInfo ────────────────────────────────────────────────────

describe('cookieToInfo', () => {
  it('maps all fields from a full cookie object', () => {
    const cookie = {
      name: 'session',
      value: 'abc123',
      domain: '.example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax' as const,
      expirationDate: 1700000000,
      hostOnly: false,
      session: false,
      storeId: '0',
    };

    const result = cookieToInfo(cookie as CookieInput);
    expect(result).toEqual({
      name: 'session',
      value: 'abc123',
      domain: '.example.com',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      expirationDate: 1700000000,
    });
  });

  it('handles missing expirationDate (session cookie)', () => {
    const cookie = {
      name: 'temp',
      value: 'xyz',
      domain: 'example.com',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'no_restriction' as const,
      hostOnly: true,
      session: true,
      storeId: '0',
    };

    const result = cookieToInfo(cookie as CookieInput);
    expect(result.expirationDate).toBeUndefined();
    expect(result.name).toBe('temp');
    expect(result.value).toBe('xyz');
  });

  it('preserves sameSite values', () => {
    const base = {
      name: 'c',
      value: 'v',
      domain: 'd',
      path: '/',
      secure: false,
      httpOnly: false,
      hostOnly: false,
      session: true,
      storeId: '0',
    };

    for (const sameSite of ['no_restriction', 'lax', 'strict'] as const) {
      const result = cookieToInfo({ ...base, sameSite } as CookieInput);
      expect(result.sameSite).toBe(sameSite);
    }
  });
});
