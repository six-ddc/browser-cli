/**
 * RequestLog: per-tab ring buffer built on webRequest observation events.
 * These tests drive the module through a fake `browser.webRequest` so no
 * real extension APIs are required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
// Imported dynamically alongside the module under test in beforeEach (below),
// since vi.resetModules() also reloads @browser-cli/shared — a statically
// imported BrowserCliError here would be a different class instance than the
// one request-log.ts actually throws.
import type { BrowserCliError as BrowserCliErrorType } from '@browser-cli/shared';
import type * as RequestLogModule from '../src/lib/request-log';

type Listener = (details: Record<string, unknown>) => void;

function createMockWebRequest() {
  const listeners: Record<string, Listener[]> = {
    onBeforeRequest: [],
    onCompleted: [],
    onErrorOccurred: [],
  };
  const makeEvent = (name: keyof typeof listeners) => ({
    addListener: (fn: Listener) => listeners[name].push(fn),
  });
  return {
    onBeforeRequest: makeEvent('onBeforeRequest'),
    onCompleted: makeEvent('onCompleted'),
    onErrorOccurred: makeEvent('onErrorOccurred'),
    fire(name: keyof typeof listeners, details: Record<string, unknown>) {
      for (const fn of listeners[name]) fn(details);
    },
  };
}

let mockWebRequest: ReturnType<typeof createMockWebRequest>;
let requestLog: typeof RequestLogModule;
let BrowserCliError: typeof BrowserCliErrorType;

const TAB_A = 1;
const TAB_B = 2;

function beforeRequest(id: string, tabId: number, url: string, timestamp = 1000) {
  mockWebRequest.fire('onBeforeRequest', {
    requestId: id,
    tabId,
    url,
    method: 'GET',
    type: 'xmlhttprequest',
    frameId: 0,
    initiator: 'https://example.com',
    timeStamp: timestamp,
  });
}

function completed(id: string, statusCode = 200, timestamp = 1050) {
  mockWebRequest.fire('onCompleted', {
    requestId: id,
    statusCode,
    statusLine: 'HTTP/1.1 200 OK',
    ip: '1.2.3.4',
    fromCache: false,
    timeStamp: timestamp,
  });
}

function errored(id: string, error = 'net::ERR_FAILED', timestamp = 1050) {
  mockWebRequest.fire('onErrorOccurred', {
    requestId: id,
    error,
    fromCache: false,
    timeStamp: timestamp,
  });
}

beforeEach(async () => {
  vi.resetModules();
  mockWebRequest = createMockWebRequest();
  vi.stubGlobal('browser', { webRequest: mockWebRequest });
  requestLog = await import('../src/lib/request-log');
  ({ BrowserCliError } = await import('@browser-cli/shared'));
  requestLog.initRequestLog();
});

describe('request-log', () => {
  it('records a completed request with status and duration', () => {
    beforeRequest('r1', TAB_A, 'https://api.example.com/users', 1000);
    completed('r1', 200, 1120);

    const { requests, total } = requestLog.getRequests({}, TAB_A);
    expect(total).toBe(1);
    expect(requests[0]).toMatchObject({
      id: 'r1',
      method: 'GET',
      url: 'https://api.example.com/users',
      status: 200,
      duration: 120,
    });
  });

  it('records a failed request with an error and no status', () => {
    beforeRequest('r2', TAB_A, 'https://api.example.com/fail');
    errored('r2', 'net::ERR_CONNECTION_RESET');

    const { requests } = requestLog.getRequests({}, TAB_A);
    expect(requests[0].error).toBe('net::ERR_CONNECTION_RESET');
    expect(requests[0].status).toBeUndefined();
  });

  it('ignores requests not tied to a tab', () => {
    beforeRequest('r3', -1, 'https://internal.example.com/thing');
    const { requests } = requestLog.getRequests({ all: true }, TAB_A);
    expect(requests).toHaveLength(0);
  });

  it('filters by tab id', () => {
    beforeRequest('a1', TAB_A, 'https://a.example.com');
    beforeRequest('b1', TAB_B, 'https://b.example.com');

    expect(requestLog.getRequests({}, TAB_A).requests.map((r) => r.id)).toEqual(['a1']);
    expect(requestLog.getRequests({}, TAB_B).requests.map((r) => r.id)).toEqual(['b1']);
  });

  it('includes every tab when all:true', () => {
    beforeRequest('a1', TAB_A, 'https://a.example.com');
    beforeRequest('b1', TAB_B, 'https://b.example.com');

    const { requests, total } = requestLog.getRequests({ all: true }, TAB_A);
    expect(total).toBe(2);
    expect(requests.map((r) => r.id).sort()).toEqual(['a1', 'b1']);
  });

  it('filters by url substring, case-insensitively', () => {
    beforeRequest('u1', TAB_A, 'https://api.example.com/USERS/1');
    beforeRequest('u2', TAB_A, 'https://api.example.com/orders/1');

    const { requests } = requestLog.getRequests({ filter: 'users' }, TAB_A);
    expect(requests.map((r) => r.id)).toEqual(['u1']);
  });

  it('defaults to the latest 50 requests and honors a custom limit', () => {
    for (let i = 0; i < 60; i++) {
      beforeRequest(`req-${i}`, TAB_A, `https://example.com/${i}`, i);
    }

    const defaultResult = requestLog.getRequests({}, TAB_A);
    expect(defaultResult.total).toBe(60);
    expect(defaultResult.requests).toHaveLength(50);
    // "latest" means the most recently added, i.e. the tail of the buffer
    expect(defaultResult.requests[defaultResult.requests.length - 1].id).toBe('req-59');
    expect(defaultResult.requests[0].id).toBe('req-10');

    const limited = requestLog.getRequests({ limit: 5 }, TAB_A);
    expect(limited.requests).toHaveLength(5);
    expect(limited.requests.map((r) => r.id)).toEqual([
      'req-55',
      'req-56',
      'req-57',
      'req-58',
      'req-59',
    ]);
  });

  it('caps the per-tab ring buffer at 500 entries, evicting the oldest', () => {
    for (let i = 0; i < 520; i++) {
      beforeRequest(`req-${i}`, TAB_A, `https://example.com/${i}`, i);
    }

    const { total } = requestLog.getRequests({ all: true, limit: 1000 }, TAB_A);
    expect(total).toBe(500);

    // The oldest 20 entries (req-0..req-19) should have been evicted.
    expect(() => requestLog.getRequest('req-0')).toThrow(BrowserCliError);
    expect(() => requestLog.getRequest('req-19')).toThrow(BrowserCliError);
    expect(requestLog.getRequest('req-20')).toBeTruthy();
  });

  it('clears the buffer for a single tab and reports the count removed', () => {
    beforeRequest('a1', TAB_A, 'https://a.example.com');
    beforeRequest('a2', TAB_A, 'https://a.example.com/2');
    beforeRequest('b1', TAB_B, 'https://b.example.com');

    const result = requestLog.getRequests({ clear: true }, TAB_A);
    expect(result.cleared).toBe(2);
    expect(requestLog.getRequests({}, TAB_A).total).toBe(0);
    // Other tabs are untouched.
    expect(requestLog.getRequests({}, TAB_B).total).toBe(1);
  });

  it('clears every tab when all:true', () => {
    beforeRequest('a1', TAB_A, 'https://a.example.com');
    beforeRequest('b1', TAB_B, 'https://b.example.com');

    const result = requestLog.getRequests({ clear: true, all: true }, TAB_A);
    expect(result.cleared).toBe(2);
    expect(requestLog.getRequests({ all: true }, TAB_A).total).toBe(0);
  });

  it('getRequest returns full detail including statusLine/ip/frameId/initiator', () => {
    beforeRequest('d1', TAB_A, 'https://api.example.com/detail');
    completed('d1');

    const { request } = requestLog.getRequest('d1');
    expect(request).toMatchObject({
      id: 'd1',
      statusLine: 'HTTP/1.1 200 OK',
      ip: '1.2.3.4',
      frameId: 0,
      initiator: 'https://example.com',
    });
  });

  it('throws a BrowserCliError with a hint when the id is unknown', () => {
    let caught: unknown;
    try {
      requestLog.getRequest('does-not-exist');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BrowserCliError);
    expect((caught as BrowserCliErrorType).code).toBe('INVALID_ARGS');
    expect((caught as BrowserCliErrorType).hint).toMatch(/network requests/);
  });

  it('clearTabRequests drops a tab entirely (e.g. on tab close)', () => {
    beforeRequest('a1', TAB_A, 'https://a.example.com');
    requestLog.clearTabRequests(TAB_A);
    expect(requestLog.getRequests({}, TAB_A).total).toBe(0);
    expect(() => requestLog.getRequest('a1')).toThrow(BrowserCliError);
  });
});
