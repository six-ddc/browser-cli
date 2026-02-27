import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock daemon/socket dependencies so we can test --list and --call logic in isolation
vi.mock('../src/daemon/process.js', () => ({
  ensureDaemon: vi.fn(),
}));
vi.mock('../src/client/socket-client.js', () => ({
  SocketClient: class MockSocketClient {
    connect = vi.fn();
    disconnect = vi.fn();
    sendCommand = vi.fn().mockResolvedValue({ success: true, data: 'mock-result' });
  },
}));
vi.mock('../src/util/paths.js', () => ({
  getSocketPath: vi.fn().mockReturnValue('/tmp/mock.sock'),
}));
vi.mock('../src/util/logger.js', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { runScript } from '../src/lib/script-runner.js';

let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'browser-cli-test-'));
});

afterAll(() => {
  // Clean up temp dir (best-effort)
  try {
    rmSync(tempDir, { recursive: true });
  } catch {
    /* ignore */
  }
});

function writeTempScript(name: string, content: string): string {
  const path = join(tempDir, name);
  writeFileSync(path, content, 'utf-8');
  return path;
}

describe('script --list', () => {
  it('lists all exported functions', async () => {
    const scriptPath = writeTempScript(
      'list-test.mjs',
      `
      export async function foo(browser) {}
      export async function bar(browser) {}
      export default async function(browser) {}
    `,
    );

    const result = await runScript(scriptPath, { list: true });
    expect(result).toEqual(expect.arrayContaining(['foo', 'bar', 'default']));
  });

  it('excludes non-function exports', async () => {
    const scriptPath = writeTempScript(
      'list-non-fn.mjs',
      `
      export const MY_CONST = 42;
      export async function doSomething(browser) {}
    `,
    );

    const result = await runScript(scriptPath, { list: true });
    expect(result).toEqual(['doSomething']);
  });

  it('returns empty array for no function exports', async () => {
    const scriptPath = writeTempScript(
      'list-empty.mjs',
      `
      export const VERSION = '1.0';
    `,
    );

    const result = await runScript(scriptPath, { list: true });
    expect(result).toEqual([]);
  });
});

describe('script --call', () => {
  it('calls the named export function', async () => {
    const scriptPath = writeTempScript(
      'call-test.mjs',
      `
      export async function greet(browser, args) {
        return 'hello ' + (args.name || 'world');
      }
      export default async function(browser) {
        return 'default';
      }
    `,
    );

    const result = await runScript(scriptPath, {
      call: 'greet',
      scriptArgs: { name: 'test' },
    });
    expect(result).toBe('hello test');
  });

  it('calls default export when --call is not specified', async () => {
    const scriptPath = writeTempScript(
      'call-default.mjs',
      `
      export async function other(browser) { return 'other'; }
      export default async function(browser) { return 'default-result'; }
    `,
    );

    const result = await runScript(scriptPath, {});
    expect(result).toBe('default-result');
  });

  it('throws when named export does not exist', async () => {
    const scriptPath = writeTempScript(
      'call-missing.mjs',
      `
      export async function existing(browser) {}
    `,
    );

    await expect(runScript(scriptPath, { call: 'nonExistent' })).rejects.toThrow(
      /Export "nonExistent" is not a function/,
    );
  });

  it('throws when named export is not a function', async () => {
    const scriptPath = writeTempScript(
      'call-non-fn.mjs',
      `
      export const notAFunction = 42;
      export async function realFn(browser) {}
    `,
    );

    await expect(runScript(scriptPath, { call: 'notAFunction' })).rejects.toThrow(
      /Export "notAFunction" is not a function/,
    );
  });

  it('error message includes available functions', async () => {
    const scriptPath = writeTempScript(
      'call-hint.mjs',
      `
      export async function alpha(browser) {}
      export async function beta(browser) {}
    `,
    );

    await expect(runScript(scriptPath, { call: 'missing' })).rejects.toThrow(/alpha, beta/);
  });
});
