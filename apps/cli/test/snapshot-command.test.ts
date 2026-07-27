/**
 * Snapshot CLI tests: baseline save/diff interaction and option plumbing.
 * Mocks the socket layer so the real command action runs against fixed data.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerCommands } from '../src/commands/index.js';

const { mockSocketClient, mockDaemon } = vi.hoisted(() => ({
  mockSocketClient: {
    connect: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn(),
    disconnect: vi.fn(),
  },
  mockDaemon: {
    ensureDaemon: vi.fn(),
    getDaemonPid: vi.fn(),
    startDaemon: vi.fn(),
    stopDaemon: vi.fn(),
  },
}));

vi.mock('../src/client/socket-client.js', () => ({
  SocketClient: vi.fn(function () {
    return mockSocketClient;
  }),
}));

vi.mock('../src/daemon/process.js', () => mockDaemon);

vi.mock('../src/util/paths.js', () => ({
  getSocketPath: vi.fn(() => '/tmp/test.sock'),
  getWsHost: vi.fn(() => '127.0.0.1'),
  getWsPort: vi.fn(() => 9222),
  getPidPath: vi.fn(() => '/tmp/test.pid'),
}));

vi.mock('../src/util/logger.js', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

class ExitCalled extends Error {
  constructor(public exitCode: number) {
    super(`process.exit(${exitCode})`);
  }
}

async function runCli(...args: string[]): Promise<{ lines: string[]; exitCode?: number }> {
  const lines: string[] = [];
  const origLog = console.log;
  const origErr = console.error;
  console.log = (...a: unknown[]) => lines.push(a.map(String).join(' '));
  console.error = () => {};

  let exitCode: number | undefined;
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCode = code ?? 0;
    throw new ExitCalled(exitCode);
  }) as never);

  const program = new Command().name('browser-cli').option('--json', 'JSON output').exitOverride();
  registerCommands(program);

  try {
    await program.parseAsync(['node', 'browser-cli', ...args]);
  } catch (err) {
    if (!(err instanceof ExitCalled)) throw err;
  } finally {
    console.log = origLog;
    console.error = origErr;
    exitSpy.mockRestore();
  }

  return { lines, exitCode };
}

const SNAPSHOT_V2 = 'page "Demo"\n  button "Save" [@e1]\n  link "Docs" [@e2]';
const BASELINE_V1 = 'page "Demo"\n  button "Save"\n';

const dir = mkdtempSync(join(tmpdir(), 'bcli-snapshot-'));

function respondWith(snapshot: string, refCount = 2) {
  mockSocketClient.sendCommand.mockResolvedValue({
    id: 'r1',
    success: true,
    data: { snapshot, refCount },
  });
}

function lastParams(): Record<string, unknown> {
  const call = mockSocketClient.sendCommand.mock.calls.at(-1);
  return (call?.[0] as { params: Record<string, unknown> }).params;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSocketClient.connect.mockResolvedValue(undefined);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('snapshot --save', () => {
  it('writes a refs-stripped baseline in text mode', async () => {
    respondWith(SNAPSHOT_V2);
    const path = join(dir, 'text.txt');

    const { lines } = await runCli('snapshot', '--save', path);

    expect(lines[0]).toBe(SNAPSHOT_V2);
    expect(readFileSync(path, 'utf-8')).toBe('page "Demo"\n  button "Save"\n  link "Docs"\n');
  });

  it('still writes the baseline under --json and reports the path', async () => {
    respondWith(SNAPSHOT_V2);
    const path = join(dir, 'json.txt');

    const { lines } = await runCli('--json', 'snapshot', '--save', path);

    expect(readFileSync(path, 'utf-8')).toBe('page "Demo"\n  button "Save"\n  link "Docs"\n');
    const json = JSON.parse(lines[0]);
    expect(json.success).toBe(true);
    expect(json.data.snapshot).toBe(SNAPSHOT_V2);
    expect(json.data.saved).toBe(path);
  });
});

describe('snapshot --base with --save', () => {
  it('diffs against the old baseline and then refreshes it', async () => {
    respondWith(SNAPSHOT_V2);
    const path = join(dir, 'combined.txt');
    writeFileSync(path, BASELINE_V1);

    const { lines, exitCode } = await runCli('snapshot', '--base', path, '--save', path);

    expect(exitCode).toBeUndefined();
    const diff = lines.join('\n');
    expect(diff).toContain('+');
    expect(diff).toContain('link "Docs"');
    // Baseline now holds the new tree, so a repeat diff would be clean
    expect(readFileSync(path, 'utf-8')).toBe('page "Demo"\n  button "Save"\n  link "Docs"\n');
  });

  it('reports the refreshed baseline path in --json diff output', async () => {
    respondWith(SNAPSHOT_V2);
    const path = join(dir, 'combined-json.txt');
    writeFileSync(path, BASELINE_V1);

    const { lines } = await runCli('--json', 'snapshot', '--base', path, '--save', path);

    const json = JSON.parse(lines[0]);
    expect(json.summary.added).toBe(1);
    expect(json.saved).toBe(path);
    expect(readFileSync(path, 'utf-8')).toContain('link "Docs"');
  });
});

describe('snapshot option plumbing', () => {
  it('sends depth 0 rather than dropping it', async () => {
    respondWith(SNAPSHOT_V2);
    await runCli('snapshot', '-d', '0');
    expect(lastParams().depth).toBe(0);
  });

  it('sends --max-chars as maxChars', async () => {
    respondWith(SNAPSHOT_V2);
    await runCli('snapshot', '--max-chars', '5000');
    expect(lastParams().maxChars).toBe(5000);
  });

  it('rejects a non-numeric --max-chars', async () => {
    respondWith(SNAPSHOT_V2);
    const { exitCode } = await runCli('snapshot', '--max-chars', 'abc');
    expect(exitCode).toBe(2);
  });
});
