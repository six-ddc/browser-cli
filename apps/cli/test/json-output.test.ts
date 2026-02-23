/**
 * JSON Output Mode Tests
 *
 * Tests that --json flag produces clean JSON output (no extra text),
 * works for all command types, and exits with correct codes.
 *
 * Unlike agentbrowser-compat.test.ts which mocks sendCommand entirely,
 * these tests mock the underlying dependencies (SocketClient, daemon
 * process functions) to test the real sendCommand JSON path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerCommands } from '../src/commands/index.js';

// ─── Mock infrastructure ────────────────────────────────────────────
// vi.mock is hoisted above variable declarations, so we use vi.hoisted
// to create mock objects that are available when the factories run.

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
  SocketClient: vi.fn(function () { return mockSocketClient; }),
}));

vi.mock('../src/daemon/process.js', () => mockDaemon);

vi.mock('../src/util/paths.js', () => ({
  getSocketPath: vi.fn(() => '/tmp/test.sock'),
  getWsPort: vi.fn(() => 9222),
  getPidPath: vi.fn(() => '/tmp/test.pid'),
}));

vi.mock('../src/util/logger.js', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ─── Test helpers ───────────────────────────────────────────────────

/** Sentinel error thrown by mocked process.exit */
class ExitCalled extends Error {
  constructor(public exitCode: number) {
    super(`process.exit(${exitCode})`);
  }
}

/**
 * Run the CLI with given args, capturing stdout and exit code.
 * process.exit is mocked to throw instead of terminating.
 */
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

  const program = new Command()
    .name('browser-cli')
    .option('--json', 'JSON output')
    .exitOverride();

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

// ─── Setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSocketClient.connect.mockResolvedValue(undefined);
});

// ─── Daemon-routed commands (via sendCommand) ───────────────────────

describe('--json: daemon-routed commands', () => {
  it('navigate --json outputs only JSON, no text', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r1', success: true,
      data: { url: 'https://example.com', title: 'Example' },
    });

    const { lines, exitCode } = await runCli('--json', 'navigate', 'https://example.com');

    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.success).toBe(true);
    expect(json.data.url).toBe('https://example.com');
    expect(json.data.title).toBe('Example');
  });

  it('click --json outputs only JSON, no "Clicked" text', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r2', success: true, data: {},
    });

    const { lines, exitCode } = await runCli('--json', 'click', '#btn');

    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('Clicked');
    JSON.parse(lines[0]); // valid JSON
  });

  it('snapshot --json outputs only JSON, no refCount text', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r3', success: true,
      data: { snapshot: '<tree>', refCount: 5 },
    });

    const { lines, exitCode } = await runCli('--json', 'snapshot');

    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.data.snapshot).toBe('<tree>');
  });

  it('eval --json outputs only JSON, no value text', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r4', success: true,
      data: { value: 'hello world' },
    });

    const { lines, exitCode } = await runCli('--json', 'eval', '1+1');

    expect(exitCode).toBe(0);
    // Only 1 line = JSON only, no separate "hello world" text line
    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.data.value).toBe('hello world');
  });

  it('error response exits with code 1', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r5', success: false,
      error: { code: 'ELEMENT_NOT_FOUND', message: 'not found', hint: 'check selector' },
    });

    const { lines, exitCode } = await runCli('--json', 'click', '#missing');

    expect(exitCode).toBe(1);
    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('ELEMENT_NOT_FOUND');
  });

  it('--json after subcommand args also works', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r6', success: true,
      data: { url: 'https://example.com', title: 'Example' },
    });

    const { lines, exitCode } = await runCli('navigate', 'https://example.com', '--json');

    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(1);
    JSON.parse(lines[0]); // valid JSON
  });

  it('without --json outputs human-readable text', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r7', success: true,
      data: { url: 'https://example.com', title: 'Example' },
    });

    const { lines, exitCode } = await runCli('navigate', 'https://example.com');

    expect(exitCode).toBeUndefined(); // no process.exit in normal mode
    expect(lines.join('\n')).toContain('Example');
    expect(lines.join('\n')).toContain('https://example.com');
  });
});

// ─── Lifecycle commands ─────────────────────────────────────────────

describe('--json: lifecycle commands', () => {
  it('status --json outputs structured JSON when daemon running', async () => {
    mockDaemon.getDaemonPid.mockReturnValue(12345);
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 's1', success: true,
      data: { connected: true, extensionId: 'ext-abc', sessionId: 'sess-1', uptime: 300 },
    });

    const { lines } = await runCli('--json', 'status');

    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.daemon).toBe(true);
    expect(json.pid).toBe(12345);
    expect(json.wsPort).toBe(9222);
    expect(json.extension.connected).toBe(true);
    expect(json.extension.extensionId).toBe('ext-abc');
  });

  it('status --json when daemon not running', async () => {
    mockDaemon.getDaemonPid.mockReturnValue(null);

    const { lines } = await runCli('--json', 'status');

    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.daemon).toBe(false);
  });

  it('start --json outputs structured JSON', async () => {
    mockDaemon.startDaemon.mockReturnValue(99999);

    const { lines } = await runCli('--json', 'start');

    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.success).toBe(true);
    expect(json.pid).toBe(99999);
  });

  it('stop --json outputs structured JSON', async () => {
    mockDaemon.stopDaemon.mockReturnValue(true);

    const { lines } = await runCli('--json', 'stop');

    expect(lines).toHaveLength(1);
    const json = JSON.parse(lines[0]);
    expect(json.success).toBe(true);
    expect(json.stopped).toBe(true);
  });
});
