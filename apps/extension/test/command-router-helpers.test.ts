/**
 * Tests for exported helper functions in command-router:
 * getFallbackErrorCode and cookieToInfo.
 */

import { describe, it, expect } from 'vitest';
import { getFallbackErrorCode, cookieToInfo } from '../src/lib/command-router';
import { ErrorCode } from '@browser-cli/shared';

type CookieInput = Parameters<typeof cookieToInfo>[0];

// ─── getFallbackErrorCode ────────────────────────────────────────────

describe('getFallbackErrorCode', () => {
  it('navigate -> NAVIGATION_FAILED', () => {
    expect(getFallbackErrorCode('navigate')).toBe(ErrorCode.NAVIGATION_FAILED);
  });

  it('goBack -> NAVIGATION_FAILED', () => {
    expect(getFallbackErrorCode('goBack')).toBe(ErrorCode.NAVIGATION_FAILED);
  });

  it('goForward -> NAVIGATION_FAILED', () => {
    expect(getFallbackErrorCode('goForward')).toBe(ErrorCode.NAVIGATION_FAILED);
  });

  it('reload -> NAVIGATION_FAILED', () => {
    expect(getFallbackErrorCode('reload')).toBe(ErrorCode.NAVIGATION_FAILED);
  });

  it('tabNew -> TAB_NOT_FOUND', () => {
    expect(getFallbackErrorCode('tabNew')).toBe(ErrorCode.TAB_NOT_FOUND);
  });

  it('tabList -> TAB_NOT_FOUND', () => {
    expect(getFallbackErrorCode('tabList')).toBe(ErrorCode.TAB_NOT_FOUND);
  });

  it('tabSwitch -> TAB_NOT_FOUND', () => {
    expect(getFallbackErrorCode('tabSwitch')).toBe(ErrorCode.TAB_NOT_FOUND);
  });

  it('tabClose -> TAB_NOT_FOUND', () => {
    expect(getFallbackErrorCode('tabClose')).toBe(ErrorCode.TAB_NOT_FOUND);
  });

  it('screenshot -> SCREENSHOT_FAILED', () => {
    expect(getFallbackErrorCode('screenshot')).toBe(ErrorCode.SCREENSHOT_FAILED);
  });

  it('windowNew -> UNKNOWN', () => {
    expect(getFallbackErrorCode('windowNew')).toBe(ErrorCode.UNKNOWN);
  });

  it('unknownAction -> UNKNOWN', () => {
    expect(getFallbackErrorCode('unknownAction')).toBe(ErrorCode.UNKNOWN);
  });
});

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
