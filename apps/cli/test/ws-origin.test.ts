import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { verifyWsOrigin } from '../src/daemon/auth.js';
import { WsServer } from '../src/daemon/ws-server.js';

describe('verifyWsOrigin', () => {
  it('allows extension origins', () => {
    for (const origin of [
      'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      'moz-extension://11111111-2222-3333-4444-555555555555',
      'safari-web-extension://ABCDEF',
    ]) {
      expect(verifyWsOrigin(origin)).toEqual({ allowed: true, reason: 'extension-origin' });
    }
  });

  it('allows a missing Origin header (non-browser client)', () => {
    expect(verifyWsOrigin(undefined)).toEqual({ allowed: true, reason: 'no-origin' });
    expect(verifyWsOrigin('')).toEqual({ allowed: true, reason: 'no-origin' });
  });

  it('rejects web page origins', () => {
    for (const origin of [
      'https://evil.example',
      'http://localhost:3000',
      'http://127.0.0.1:9222',
      'file://',
      'ws://127.0.0.1:9222',
    ]) {
      expect(verifyWsOrigin(origin)).toMatchObject({ allowed: false, reason: 'web-origin' });
    }
  });

  it('rejects a null origin from a sandboxed frame', () => {
    expect(verifyWsOrigin('null')).toMatchObject({ allowed: false, reason: 'web-origin' });
  });

  it('rejects an origin that only looks like an extension scheme', () => {
    expect(verifyWsOrigin('https://chrome-extension.evil.example')).toMatchObject({
      allowed: false,
      reason: 'web-origin',
    });
  });
});

describe('WsServer handshake origin enforcement', () => {
  let server: WsServer | null = null;
  const port = 19870;

  afterEach(async () => {
    await server?.stop();
    server = null;
  });

  /** Resolve to 'open' or the HTTP status the handshake was rejected with. */
  function connect(origin?: string): Promise<'open' | number> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {});
      const timer = setTimeout(() => reject(new Error('handshake timed out')), 5000);
      ws.on('open', () => {
        clearTimeout(timer);
        ws.close();
        resolve('open');
      });
      ws.on('unexpected-response', (_req, res) => {
        clearTimeout(timer);
        resolve(res.statusCode ?? 0);
      });
      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  it('rejects a forged https origin with 403', async () => {
    server = new WsServer();
    await server.start(port, '127.0.0.1');
    await expect(connect('https://evil.example')).resolves.toBe(403);
    expect(server.isConnected).toBe(false);
  });

  it('rejects a page served from loopback itself', async () => {
    server = new WsServer();
    await server.start(port, '127.0.0.1');
    await expect(connect('http://127.0.0.1:8080')).resolves.toBe(403);
  });

  it('accepts a chrome-extension origin', async () => {
    server = new WsServer();
    await server.start(port, '127.0.0.1');
    await expect(connect('chrome-extension://abcdefghijklmnopabcdefghijklmnop')).resolves.toBe(
      'open',
    );
  });

  it('accepts a client that sends no Origin header', async () => {
    server = new WsServer();
    await server.start(port, '127.0.0.1');
    await expect(connect()).resolves.toBe('open');
  });
});
