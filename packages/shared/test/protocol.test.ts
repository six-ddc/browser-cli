import { describe, it, expect } from 'vitest';
import { isElementRef, parseElementRef, createElementRef } from '../src/protocol/element-ref.js';
import {
  PROTOCOL_VERSION,
  DEFAULT_WS_PORT,
  HEARTBEAT_INTERVAL_MS,
} from '../src/protocol/constants.js';
import { ErrorCode, createError } from '../src/protocol/errors.js';
import {
  commandSchema,
  requestMessageSchema,
  responseMessageSchema,
  handshakeMessageSchema,
  handshakeAckMessageSchema,
  pingMessageSchema,
  pongMessageSchema,
  wsMessageSchema,
  daemonRequestSchema,
  daemonResponseSchema,
} from '../src/protocol/schemas.js';
import { serializeSnapshot } from '../src/snapshot/types.js';
import type { SnapshotNode } from '../src/snapshot/types.js';

describe('element-ref', () => {
  it('validates element refs', () => {
    expect(isElementRef('@e1')).toBe(true);
    expect(isElementRef('@e42')).toBe(true);
    expect(isElementRef('@e0')).toBe(true);
    expect(isElementRef('e1')).toBe(false);
    expect(isElementRef('@1')).toBe(false);
    expect(isElementRef('@eabc')).toBe(false);
    expect(isElementRef('')).toBe(false);
  });

  it('parses element refs', () => {
    expect(parseElementRef('@e1')).toBe(1);
    expect(parseElementRef('@e42')).toBe(42);
    expect(parseElementRef('invalid')).toBe(null);
  });

  it('creates element refs', () => {
    expect(createElementRef(1)).toBe('@e1');
    expect(createElementRef(99)).toBe('@e99');
  });
});

describe('constants', () => {
  it('has expected values', () => {
    expect(PROTOCOL_VERSION).toBe('1.0.0');
    expect(DEFAULT_WS_PORT).toBe(9222);
    expect(HEARTBEAT_INTERVAL_MS).toBe(5000);
  });
});

describe('errors', () => {
  it('creates errors', () => {
    const err = createError(ErrorCode.ELEMENT_NOT_FOUND, 'not found');
    expect(err.code).toBe('ELEMENT_NOT_FOUND');
    expect(err.message).toBe('not found');
    expect(err.details).toBeUndefined();
  });

  it('creates errors with details', () => {
    const err = createError(ErrorCode.TIMEOUT, 'timed out', undefined, { ms: 5000 });
    expect(err.details).toEqual({ ms: 5000 });
  });

  it('creates errors with hint', () => {
    const err = createError(ErrorCode.TIMEOUT, 'timed out', 'Try increasing the timeout');
    expect(err.hint).toBe('Try increasing the timeout');
    expect(err.details).toBeUndefined();
  });
});

describe('schemas - command', () => {
  it('validates navigate command', () => {
    const cmd = { action: 'navigate', params: { url: 'https://example.com' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates click command', () => {
    const cmd = { action: 'click', params: { selector: '@e1' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates fill command', () => {
    const cmd = { action: 'fill', params: { selector: 'input', value: 'hello' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates snapshot command', () => {
    const cmd = { action: 'snapshot', params: {} };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates snapshot with options', () => {
    const cmd = { action: 'snapshot', params: { interactive: true, depth: 5 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates tab commands', () => {
    expect(commandSchema.parse({ action: 'tabList', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'tabNew', params: { url: 'https://x.com' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'tabSwitch', params: { tabId: 1 } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'tabClose', params: {} })).toBeTruthy();
  });

  // ─── Drag ──────────────────────────────────────────────────────────
  it('validates drag command', () => {
    const cmd = { action: 'drag', params: { source: '#a', target: '#b' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('rejects drag without source', () => {
    expect(() => commandSchema.parse({ action: 'drag', params: { target: '#b' } })).toThrow();
  });

  it('rejects drag without target', () => {
    expect(() => commandSchema.parse({ action: 'drag', params: { source: '#a' } })).toThrow();
  });

  // ─── Keydown / Keyup ──────────────────────────────────────────────
  it('validates keydown command', () => {
    const cmd = { action: 'keydown', params: { key: 'Shift' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates keydown with optional selector', () => {
    const cmd = { action: 'keydown', params: { key: 'a', selector: '#input' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates keyup command', () => {
    const cmd = { action: 'keyup', params: { key: 'Control' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('rejects keydown without key', () => {
    expect(() => commandSchema.parse({ action: 'keydown', params: {} })).toThrow();
  });

  // ─── Mouse ────────────────────────────────────────────────────────
  it('validates mouseMove command', () => {
    const cmd = { action: 'mouseMove', params: { x: 100, y: 200 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('rejects mouseMove without coordinates', () => {
    expect(() => commandSchema.parse({ action: 'mouseMove', params: { x: 100 } })).toThrow();
    expect(() => commandSchema.parse({ action: 'mouseMove', params: { y: 200 } })).toThrow();
  });

  it('validates mouseDown with optional button', () => {
    expect(commandSchema.parse({ action: 'mouseDown', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'mouseDown', params: { button: 'right' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'mouseDown', params: { button: 'middle' } })).toBeTruthy();
  });

  it('rejects mouseDown with invalid button', () => {
    expect(() => commandSchema.parse({ action: 'mouseDown', params: { button: 'extra' } })).toThrow();
  });

  it('validates mouseUp with optional button', () => {
    expect(commandSchema.parse({ action: 'mouseUp', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'mouseUp', params: { button: 'left' } })).toBeTruthy();
  });

  it('validates mouseWheel command', () => {
    const cmd = { action: 'mouseWheel', params: { deltaY: 100 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates mouseWheel with deltaX', () => {
    const cmd = { action: 'mouseWheel', params: { deltaY: 100, deltaX: 50 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('rejects mouseWheel without deltaY', () => {
    expect(() => commandSchema.parse({ action: 'mouseWheel', params: {} })).toThrow();
  });

  // ─── Wait extensions ──────────────────────────────────────────────
  it('validates wait with text', () => {
    const cmd = { action: 'wait', params: { text: 'Loading...' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates wait with load state', () => {
    expect(commandSchema.parse({ action: 'wait', params: { load: 'load' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'wait', params: { load: 'domcontentloaded' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'wait', params: { load: 'networkidle' } })).toBeTruthy();
  });

  it('rejects wait with invalid load state', () => {
    expect(() => commandSchema.parse({ action: 'wait', params: { load: 'invalid' } })).toThrow();
  });

  it('validates wait with fn', () => {
    const cmd = { action: 'wait', params: { fn: 'window.ready === true' } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates wait with duration', () => {
    const cmd = { action: 'wait', params: { duration: 1000 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates wait with selector (optional now)', () => {
    expect(commandSchema.parse({ action: 'wait', params: { selector: '.loaded' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'wait', params: {} })).toBeTruthy();
  });

  // ─── Window management ────────────────────────────────────────────
  it('validates window commands', () => {
    expect(commandSchema.parse({ action: 'windowNew', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'windowNew', params: { url: 'https://x.com' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'windowList', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'windowClose', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'windowClose', params: { windowId: 42 } })).toBeTruthy();
  });

  // ─── Browser config ───────────────────────────────────────────────
  it('validates setViewport command', () => {
    const cmd = { action: 'setViewport', params: { width: 1920, height: 1080 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('rejects setViewport without dimensions', () => {
    expect(() => commandSchema.parse({ action: 'setViewport', params: { width: 1920 } })).toThrow();
    expect(() => commandSchema.parse({ action: 'setViewport', params: { height: 1080 } })).toThrow();
  });

  it('validates setGeo command', () => {
    const cmd = { action: 'setGeo', params: { latitude: 37.7749, longitude: -122.4194 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates setGeo with accuracy', () => {
    const cmd = { action: 'setGeo', params: { latitude: 0, longitude: 0, accuracy: 50 } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('rejects setGeo without coordinates', () => {
    expect(() => commandSchema.parse({ action: 'setGeo', params: { latitude: 0 } })).toThrow();
  });

  it('validates setMedia command', () => {
    expect(commandSchema.parse({ action: 'setMedia', params: { colorScheme: 'dark' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'setMedia', params: { colorScheme: 'light' } })).toBeTruthy();
  });

  it('rejects setMedia with invalid colorScheme', () => {
    expect(() => commandSchema.parse({ action: 'setMedia', params: { colorScheme: 'auto' } })).toThrow();
  });

  it('validates setHeaders command', () => {
    const cmd = { action: 'setHeaders', params: { headers: { 'X-Custom': 'value', 'Authorization': 'Bearer token' } } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('validates setHeaders with empty headers', () => {
    const cmd = { action: 'setHeaders', params: { headers: {} } };
    expect(commandSchema.parse(cmd)).toEqual(cmd);
  });

  it('rejects setHeaders without headers field', () => {
    expect(() => commandSchema.parse({ action: 'setHeaders', params: {} })).toThrow();
  });

  // ─── Frame commands ───────────────────────────────────────────────
  it('validates frame commands', () => {
    expect(commandSchema.parse({ action: 'switchFrame', params: { selector: 'iframe' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'switchFrame', params: { main: true } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'listFrames', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'getCurrentFrame', params: {} })).toBeTruthy();
  });

  // ─── Network commands ─────────────────────────────────────────────
  it('validates network commands', () => {
    expect(commandSchema.parse({ action: 'route', params: { pattern: '*.png', action: 'block' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'route', params: { pattern: '*/api/*', action: 'redirect', redirectUrl: 'https://mock.com' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'unroute', params: { routeId: 1 } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'getRequests', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'getRoutes', params: {} })).toBeTruthy();
    expect(commandSchema.parse({ action: 'clearRequests', params: {} })).toBeTruthy();
  });

  // ─── Upload command ───────────────────────────────────────────────
  it('validates upload command', () => {
    expect(commandSchema.parse({ action: 'upload', params: { selector: '#file', files: 'data:text/plain;base64,aGVsbG8=' } })).toBeTruthy();
    expect(commandSchema.parse({ action: 'upload', params: { selector: '#file', files: ['file1.txt', 'file2.txt'] } })).toBeTruthy();
  });

  // ─── Existing validations ─────────────────────────────────────────
  it('rejects invalid command', () => {
    expect(() => commandSchema.parse({ action: 'unknown', params: {} })).toThrow();
  });

  it('rejects missing params', () => {
    expect(() => commandSchema.parse({ action: 'navigate', params: {} })).toThrow();
  });
});

describe('schemas - messages', () => {
  it('validates request message', () => {
    const msg = {
      id: 'uuid-1',
      type: 'request',
      command: { action: 'navigate', params: { url: 'https://example.com' } },
    };
    expect(requestMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates response message (success)', () => {
    const msg = {
      id: 'uuid-1',
      type: 'response',
      success: true,
      data: { url: 'https://example.com', title: 'Example' },
    };
    expect(responseMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates response message (error)', () => {
    const msg = {
      id: 'uuid-1',
      type: 'response',
      success: false,
      error: { code: 'ELEMENT_NOT_FOUND', message: 'not found' },
    };
    expect(responseMessageSchema.parse(msg)).toEqual(msg);
  });

  it('validates handshake messages', () => {
    const hs = { type: 'handshake', protocolVersion: '1.0.0', extensionId: 'abc' };
    expect(handshakeMessageSchema.parse(hs)).toEqual(hs);

    const ack = { type: 'handshake_ack', protocolVersion: '1.0.0', sessionId: 'def' };
    expect(handshakeAckMessageSchema.parse(ack)).toEqual(ack);
  });

  it('validates ping/pong', () => {
    expect(pingMessageSchema.parse({ type: 'ping', timestamp: 1234 })).toBeTruthy();
    expect(pongMessageSchema.parse({ type: 'pong', timestamp: 1234 })).toBeTruthy();
  });

  it('validates ws message union', () => {
    const req = {
      id: 'uuid-1',
      type: 'request',
      command: { action: 'getUrl', params: {} },
    };
    expect(wsMessageSchema.parse(req)).toEqual(req);

    const ping = { type: 'ping', timestamp: Date.now() };
    expect(wsMessageSchema.parse(ping)).toEqual(ping);
  });
});

describe('schemas - daemon', () => {
  it('validates daemon request', () => {
    const req = {
      id: 'uuid-1',
      command: { action: 'click', params: { selector: '#btn' } },
    };
    expect(daemonRequestSchema.parse(req)).toEqual(req);
  });

  it('validates daemon request with tabId', () => {
    const req = {
      id: 'uuid-1',
      command: { action: 'navigate', params: { url: 'https://x.com' } },
      tabId: 5,
    };
    expect(daemonRequestSchema.parse(req)).toEqual(req);
  });

  it('validates daemon response', () => {
    const res = { id: 'uuid-1', success: true, data: { title: 'Hello' } };
    expect(daemonResponseSchema.parse(res)).toEqual(res);
  });
});

describe('snapshot serialization', () => {
  it('serializes a simple tree', () => {
    const nodes: SnapshotNode[] = [
      {
        role: 'page',
        name: 'Example Domain',
        children: [
          {
            role: 'heading',
            name: 'Example Domain',
            ref: '@e1',
            level: 1,
            children: [],
          },
          {
            role: 'paragraph',
            name: 'This domain is for examples.',
            children: [],
          },
          {
            role: 'link',
            name: 'More information...',
            ref: '@e2',
            url: 'https://www.iana.org/domains/example',
            children: [],
          },
        ],
      },
    ];

    const output = serializeSnapshot(nodes);
    expect(output).toContain('page "Example Domain"');
    expect(output).toContain('heading "Example Domain"');
    expect(output).toContain('[@e1]');
    expect(output).toContain('[@e2]');
    expect(output).toContain('level=1');
    expect(output).toContain('link "More information..."');
  });

  it('handles compact mode', () => {
    const nodes: SnapshotNode[] = [
      {
        role: 'page',
        name: 'Test',
        children: [{ role: 'button', name: 'Click', ref: '@e1', children: [] }],
      },
    ];
    const normal = serializeSnapshot(nodes);
    const compact = serializeSnapshot(nodes, { compact: true });
    // Compact uses 2-space indent, normal uses 4-space
    expect(compact.includes('  button')).toBe(true);
    expect(normal.includes('    button')).toBe(true);
  });
});
