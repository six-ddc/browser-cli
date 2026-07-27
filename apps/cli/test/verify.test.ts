/**
 * `verify` command group: PASS/FAIL judgement built purely on top of the
 * existing get/is query channels, plus exit-code and --json/batch parity
 * with the rest of the CLI.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerCommands } from '../src/commands/index.js';
import { logger } from '../src/util/logger.js';

const { mockSocketClient, mockDaemon } = vi.hoisted(() => ({
  mockSocketClient: {
    connect: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn(),
    disconnect: vi.fn(),
  },
  mockDaemon: {
    ensureDaemon: vi.fn().mockResolvedValue(undefined),
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
  getDaemonLogPath: vi.fn(() => '/tmp/test.log'),
  getAuthTokenPath: vi.fn(() => '/tmp/test.token'),
}));

vi.mock('../src/util/logger.js', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

class ExitCalled extends Error {
  constructor(public exitCode: number) {
    super(`process.exit(${exitCode})`);
  }
}

/**
 * Text-mode failures go through the (mocked) `logger`, not console.error —
 * pull the rendered lines back out of the mock's recorded calls.
 */
function loggedErrorLines(): string[] {
  return vi.mocked(logger.error).mock.calls.map((call) => call.map(String).join(' '));
}

async function runCli(...args: string[]): Promise<{ stdout: string[]; exitCode?: number }> {
  const stdout: string[] = [];
  const origLog = console.log;
  console.log = (...a: unknown[]) => stdout.push(a.map(String).join(' '));

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
    exitSpy.mockRestore();
  }

  return { stdout, exitCode };
}

function respondWith(data: unknown) {
  mockSocketClient.sendCommand.mockResolvedValue({ id: 'r1', success: true, data });
}

function failWith(code: string, message = 'nope', hint = 'try something else') {
  mockSocketClient.sendCommand.mockResolvedValue({
    id: 'r1',
    success: false,
    error: { code, message, hint },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSocketClient.connect.mockResolvedValue(undefined);
  mockDaemon.ensureDaemon.mockResolvedValue(undefined);
});

describe('verify text', () => {
  it('PASSes when the body text contains the substring', async () => {
    respondWith({ text: 'Welcome to the Dashboard' });
    const { stdout, exitCode } = await runCli('verify', 'text', 'Dashboard');
    expect(exitCode).toBeUndefined();
    expect(stdout).toEqual(['PASS: page contains text "Dashboard"']);
  });

  it('FAILs with exit 1 and prints expected/actual', async () => {
    respondWith({ text: 'Nothing here' });
    const { stdout, exitCode } = await runCli('verify', 'text', 'Dashboard');
    expect(exitCode).toBe(1);
    expect(stdout).toEqual([]);
    const lines = loggedErrorLines();
    expect(lines.some((l) => l.includes('FAIL: page contains text "Dashboard"'))).toBe(true);
    expect(lines.some((l) => l.includes('expected') && l.includes('Dashboard'))).toBe(true);
    expect(lines.some((l) => l.includes('actual') && l.includes('Nothing here'))).toBe(true);
  });
});

describe('verify visible', () => {
  it('PASSes when isVisible reports true', async () => {
    respondWith({ visible: true });
    const { exitCode } = await runCli('verify', 'visible', '#modal');
    expect(exitCode).toBeUndefined();
  });

  it('FAILs with exit 1 when the element is hidden', async () => {
    respondWith({ visible: false });
    const { exitCode } = await runCli('verify', 'visible', '#modal');
    expect(exitCode).toBe(1);
  });

  it('FAILs with exit 1 (not exit 3) when the element does not exist', async () => {
    // isVisible never throws ELEMENT_NOT_FOUND on the wire — a missing
    // element resolves to { visible: false }, so this is a plain FAIL.
    respondWith({ visible: false });
    const { exitCode } = await runCli('verify', 'visible', '#does-not-exist');
    expect(exitCode).toBe(1);
    expect(loggedErrorLines().some((l) => l.includes('FAIL'))).toBe(true);
  });
});

describe('verify value', () => {
  it('PASSes on an exact value match', async () => {
    respondWith({ value: 'hello@example.com' });
    const { exitCode } = await runCli('verify', 'value', '#email', 'hello@example.com');
    expect(exitCode).toBeUndefined();
  });

  it('FAILs with exit 1 on a mismatch', async () => {
    respondWith({ value: 'wrong@example.com' });
    const { exitCode } = await runCli('verify', 'value', '#email', 'hello@example.com');
    expect(exitCode).toBe(1);
    expect(loggedErrorLines().some((l) => l.includes('wrong@example.com'))).toBe(true);
  });

  it('propagates a real error (element missing) with its own exit class, not 1', async () => {
    failWith('ELEMENT_NOT_FOUND', 'no such element');
    const { exitCode } = await runCli('verify', 'value', '#missing', 'x');
    expect(exitCode).toBe(3);
  });
});

describe('verify count', () => {
  it('PASSes when the count matches', async () => {
    respondWith({ count: 3 });
    const { exitCode } = await runCli('verify', 'count', '.item', '3');
    expect(exitCode).toBeUndefined();
  });

  it('FAILs with exit 1 on a mismatch', async () => {
    respondWith({ count: 5 });
    const { exitCode } = await runCli('verify', 'count', '.item', '3');
    expect(exitCode).toBe(1);
    expect(loggedErrorLines().some((l) => l.includes('5'))).toBe(true);
  });

  it('PASSes with expected 0 when nothing matches (no throw from count)', async () => {
    respondWith({ count: 0 });
    const { exitCode } = await runCli('verify', 'count', '.does-not-exist', '0');
    expect(exitCode).toBeUndefined();
  });

  it('rejects a non-integer n before contacting the daemon', async () => {
    const { exitCode } = await runCli('verify', 'count', '.item', 'abc');
    expect(exitCode).toBe(2);
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });
});

describe('verify url', () => {
  it('PASSes on a glob match', async () => {
    respondWith({ url: 'https://example.com/app/dashboard' });
    const { exitCode } = await runCli('verify', 'url', '**/dashboard');
    expect(exitCode).toBeUndefined();
  });

  it('FAILs with exit 1 when the pattern does not match', async () => {
    respondWith({ url: 'https://example.com/app/login' });
    const { exitCode } = await runCli('verify', 'url', '**/dashboard');
    expect(exitCode).toBe(1);
    expect(loggedErrorLines().some((l) => l.includes('https://example.com/app/login'))).toBe(true);
  });
});

describe('verify title', () => {
  it('PASSes on a glob match', async () => {
    respondWith({ title: 'Acme — Dashboard' });
    const { exitCode } = await runCli('verify', 'title', '*Dashboard*');
    expect(exitCode).toBeUndefined();
  });

  it('FAILs with exit 1 when the pattern does not match', async () => {
    respondWith({ title: 'Acme — Login' });
    const { exitCode } = await runCli('verify', 'title', '*Dashboard*');
    expect(exitCode).toBe(1);
  });
});

describe('verify --json', () => {
  it('emits the standard success envelope with pass:true', async () => {
    respondWith({ count: 2 });
    const { stdout, exitCode } = await runCli('--json', 'verify', 'count', '.item', '2');
    expect(exitCode).toBe(0);
    const json = JSON.parse(stdout.join('\n')) as {
      success: boolean;
      data: { pass: boolean; expected: number; actual: number };
    };
    expect(json).toEqual({ success: true, data: { pass: true, expected: 2, actual: 2 } });
  });

  it('emits the standard error envelope with code ASSERTION_FAILED on FAIL', async () => {
    respondWith({ count: 5 });
    const { stdout, exitCode } = await runCli('--json', 'verify', 'count', '.item', '2');
    expect(exitCode).toBe(1);
    const json = JSON.parse(stdout.join('\n')) as {
      success: boolean;
      error: { code: string; message: string; hint?: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('ASSERTION_FAILED');
    expect(json.error.message).toContain('2');
    expect(json.error.message).toContain('5');
    expect(json.error.hint).toBeTruthy();
  });

  it('still emits a real underlying error under --json (not an assertion failure)', async () => {
    failWith('ELEMENT_NOT_FOUND', 'no such element');
    const { exitCode } = await runCli('--json', 'verify', 'value', '#missing', 'x');
    expect(exitCode).toBe(3);
  });
});

describe('verify inside batch mode', () => {
  it('never calls process.exit — FAIL surfaces as a thrown BrowserCliError instead', async () => {
    const { BatchRunner } = await import('../src/lib/batch-runner.js');
    respondWith({ count: 5 });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit must not be called in batch mode');
    }) as never);

    const runner = new BatchRunner();
    await runner.connect();
    const result = await runner.run('verify count .item 2', 1);
    exitSpy.mockRestore();

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ASSERTION_FAILED');
    expect(result.error?.message).toContain('2');
    expect(result.error?.message).toContain('5');
  });

  it('PASS keeps the batch running and reports success', async () => {
    const { BatchRunner } = await import('../src/lib/batch-runner.js');
    respondWith({ count: 2 });

    const runner = new BatchRunner();
    await runner.connect();
    const result = await runner.run('verify count .item 2', 1);

    expect(result.success).toBe(true);
    expect(result.output).toContain('PASS');
    expect(result.data).toEqual({ pass: true, expected: 2, actual: 2 });
  });
});
