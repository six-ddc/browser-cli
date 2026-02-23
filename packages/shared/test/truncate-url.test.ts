import { describe, it, expect } from 'vitest';
import { truncateUrl } from '../src/util/url.js';

const E = '\u2026'; // ellipsis

describe('truncateUrl', () => {
  // ─── No truncation needed ───────────────────────────────────────
  it('returns short URL unchanged', () => {
    expect(truncateUrl('https://example.com')).toBe('https://example.com');
  });

  it('returns URL without query unchanged', () => {
    expect(truncateUrl('https://example.com/path/to/page')).toBe(
      'https://example.com/path/to/page',
    );
  });

  it('returns short query unchanged', () => {
    expect(truncateUrl('https://example.com?a=1')).toBe('https://example.com?a=1');
  });

  // ─── Query string truncation ───────────────────────────────────
  it('truncates long query string, keeping first maxQueryLength chars', () => {
    // query = "?foo=bar&baz=qux&long=value" (27 chars) > 20
    // kept  = "?foo=bar&baz=qux&lon" (20 chars)
    const url = 'https://example.com?foo=bar&baz=qux&long=value';
    const result = truncateUrl(url, { maxQueryLength: 20 });
    expect(result).toBe(`https://example.com?foo=bar&baz=qux&lon${E}`);
  });

  it('uses default maxQueryLength of 50', () => {
    // query "?a=" + 47 chars = 50 chars → exact, no truncation
    const exact = 'https://x.com?a=' + '1'.repeat(47);
    expect(truncateUrl(exact)).toBe(exact);

    // query "?a=" + 48 chars = 51 chars → truncated, keep first 50
    const long = 'https://x.com?a=' + '1'.repeat(48);
    expect(truncateUrl(long)).toBe(`https://x.com?${'a=' + '1'.repeat(47)}${E}`);
  });

  it('preserves hash fragment when truncating query', () => {
    const url = 'https://example.com?foo=bar&baz=qux&long=value#section';
    const result = truncateUrl(url, { maxQueryLength: 10 });
    // query = "?foo=bar&baz=qux&long=value" (27 chars), kept = "?foo=bar&b" (10 chars)
    expect(result).toBe(`https://example.com?foo=bar&b${E}#section`);
  });

  it('does not truncate query at exact maxQueryLength', () => {
    const url = 'https://example.com?foo=bar'; // query = "?foo=bar" = 8 chars
    expect(truncateUrl(url, { maxQueryLength: 8 })).toBe(url);
  });

  // ─── Total length truncation ───────────────────────────────────
  it('truncates total URL to maxLength', () => {
    const url = 'https://example.com/very/long/path/that/goes/on';
    const result = truncateUrl(url, { maxLength: 30 });
    expect(result).toBe(`https://example.com/very/long/${E}`);
    expect(result.length).toBe(31); // 30 + ellipsis
  });

  it('does not truncate URL at exact maxLength', () => {
    const url = 'https://example.com'; // 19 chars
    expect(truncateUrl(url, { maxLength: 19 })).toBe(url);
  });

  // ─── Combined truncation ──────────────────────────────────────
  it('applies both query and total length truncation', () => {
    const url = 'https://example.com/long/path?foo=bar&baz=qux&x=y';
    const result = truncateUrl(url, { maxQueryLength: 10, maxLength: 40 });
    expect(result.length).toBeLessThanOrEqual(41); // maxLength + ellipsis
    expect(result).toContain(E);
  });

  // ─── Edge cases ────────────────────────────────────────────────
  it('handles URL with only query (no path)', () => {
    const url = 'https://example.com?very_long_query_param=very_long_value';
    const result = truncateUrl(url, { maxQueryLength: 15 });
    // query = "?very_long_query_param=very_long_value" (38 chars), kept = "?very_long_quer" (15 chars)
    expect(result).toBe(`https://example.com?very_long_quer${E}`);
  });

  it('handles URL with hash but no query', () => {
    const url = 'https://example.com/page#section';
    expect(truncateUrl(url)).toBe(url);
  });

  it('handles relative URL', () => {
    const url = '/path?foo=bar&baz=qux&long=value';
    const result = truncateUrl(url, { maxQueryLength: 10 });
    // query = "?foo=bar&baz=qux&long=value" (27 chars), kept = "?foo=bar&b" (10 chars)
    expect(result).toBe(`/path?foo=bar&b${E}`);
  });
});
