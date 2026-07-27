/**
 * WatchManager output formatting: text mode must stay byte-for-byte what it
 * already was (a human-readable request/response block), and NDJSON mode
 * must emit one JSON-parseable record per line. Both must render `pending`
 * (in-flight-when-stopped) records distinctly.
 */

import { describe, it, expect } from 'vitest';
import { formatRequestResponse, formatNdjsonLine } from '../src/daemon/watch-manager.js';

describe('formatRequestResponse (text format)', () => {
  it('renders a completed request/response pair', () => {
    const text = formatRequestResponse({
      url: 'https://api.example.com/users',
      method: 'GET',
      resourceType: 'xhr',
      status: 200,
      statusText: 'OK',
      responseHeaders: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      duration: 42,
    });

    expect(text).toContain('>>> GET https://api.example.com/users');
    expect(text).toContain('[xhr, 42ms]');
    expect(text).toContain('<<< 200 OK');
    expect(text).toContain('content-type: application/json');
    expect(text).toContain('"ok": true');
    expect(text).not.toContain('[PENDING]');
    expect(text).not.toContain('pending');
  });

  it('renders an errored request', () => {
    const text = formatRequestResponse({
      url: 'https://api.example.com/fail',
      method: 'POST',
      resourceType: 'xhr',
      error: 'net::ERR_CONNECTION_RESET',
      duration: 10,
    });

    expect(text).toContain('<<< ERROR: net::ERR_CONNECTION_RESET  (10ms)');
  });

  it('renders a pending (in-flight-when-stopped) request distinctly', () => {
    const text = formatRequestResponse({
      url: 'https://api.example.com/slow',
      method: 'GET',
      resourceType: 'xhr',
      duration: 5000,
      pending: true,
    });

    expect(text).toContain('[PENDING]');
    expect(text).toContain('<<< (pending — still in flight when the watch stopped)');
    // A pending record never had a status/error, so neither branch should render.
    expect(text).not.toContain('<<< 200');
    expect(text).not.toContain('<<< ERROR');
  });
});

describe('formatNdjsonLine', () => {
  it('produces exactly one JSON-parseable object per call, newline-terminated', () => {
    const record = {
      url: 'https://api.example.com/users',
      method: 'GET',
      resourceType: 'xhr',
      status: 200,
      duration: 42,
    };
    const line = formatNdjsonLine(record);

    expect(line.endsWith('\n')).toBe(true);
    expect(line.match(/\n/g)).toHaveLength(1);
    expect(JSON.parse(line)).toEqual(record);
  });

  it('round-trips a pending record with the pending flag intact', () => {
    const record = {
      url: 'https://api.example.com/slow',
      method: 'GET',
      resourceType: 'xhr',
      duration: 5000,
      pending: true,
    };
    const parsed = JSON.parse(formatNdjsonLine(record)) as typeof record;

    expect(parsed.pending).toBe(true);
  });

  it('concatenating multiple lines yields valid NDJSON (one JSON value per line)', () => {
    const records = [
      { url: 'https://a.example.com', method: 'GET', resourceType: 'xhr', status: 200 },
      { url: 'https://b.example.com', method: 'POST', resourceType: 'xhr', error: 'timeout' },
    ];
    const file = records.map(formatNdjsonLine).join('');
    const lines = file.split('\n').filter(Boolean);

    expect(lines).toHaveLength(2);
    for (const [i, line] of lines.entries()) {
      expect(JSON.parse(line)).toEqual(records[i]);
    }
  });
});
