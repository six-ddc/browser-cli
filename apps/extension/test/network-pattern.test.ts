/**
 * `network watch --pattern` and `network route <pattern>` must agree:
 * both are unanchored substring globs.
 */

import { describe, it, expect } from 'vitest';
import { matchesPattern } from '../src/lib/network-watcher';

describe('matchesPattern', () => {
  it('matches an unanchored path glob against a full URL', () => {
    expect(matchesPattern('https://example.com/api/users', '/api/*')).toBe(true);
    expect(matchesPattern('https://example.com/api/', '/api/*')).toBe(true);
  });

  it('matches a bare substring with no wildcard', () => {
    expect(matchesPattern('https://example.com/api/users', '/api/')).toBe(true);
  });

  it('does not match an unrelated URL', () => {
    expect(matchesPattern('https://example.com/static/app.js', '/api/*')).toBe(false);
  });

  it('still supports fully qualified patterns', () => {
    expect(matchesPattern('https://example.com/api/users', 'https://example.com/*')).toBe(true);
  });

  it('treats a missing pattern as match-all', () => {
    expect(matchesPattern('https://example.com/anything')).toBe(true);
  });

  it('escapes regex metacharacters outside the wildcard', () => {
    expect(matchesPattern('https://example.com/a.b', '/a.b')).toBe(true);
    expect(matchesPattern('https://example.com/axb', '/a.b')).toBe(false);
  });

  it('is case-insensitive, like route matching', () => {
    expect(matchesPattern('https://EXAMPLE.com/API/users', '/api/*')).toBe(true);
  });
});
