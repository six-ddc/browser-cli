/**
 * Exit-code classes and the `fail` helper: an agent should be able to branch
 * on the exit status alone, and --json must carry the same error either way.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerCommands } from '../src/commands/index.js';

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

describe('exit codes from daemon errors', () => {
  it.each([
    ['ELEMENT_NOT_FOUND', 3],
    ['STALE_REF', 3],
    ['TAB_NOT_FOUND', 3],
    ['TIMEOUT', 4],
    ['EXTENSION_NOT_CONNECTED', 5],
    ['CONTENT_SCRIPT_NOT_READY', 5],
    ['INVALID_ARGS', 2],
    ['ELEMENT_OCCLUDED', 1],
    ['UNKNOWN', 1],
  ])('exits %s with code %i', async (code, expected) => {
    failWith(code);
    const { exitCode } = await runCli('click', '#a');
    expect(exitCode).toBe(expected);
  });

  it('uses the same exit code under --json', async () => {
    failWith('ELEMENT_NOT_FOUND');
    const { exitCode, lines } = await runCli('--json', 'click', '#a');
    expect(exitCode).toBe(3);
    expect(JSON.parse(lines[0]).error.code).toBe('ELEMENT_NOT_FOUND');
  });

  it('exits 0 on success', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({ id: 'r1', success: true, data: {} });
    const { exitCode } = await runCli('--json', 'click', '#a');
    expect(exitCode).toBe(0);
  });

  it('reports an unreachable daemon as not-connected', async () => {
    mockDaemon.ensureDaemon.mockRejectedValue(new Error('spawn failed'));
    const { exitCode } = await runCli('click', '#a');
    expect(exitCode).toBe(5);
  });
});

describe('local validation errors', () => {
  it('exits 2 and prints nothing on stdout in text mode', async () => {
    const { exitCode, lines } = await runCli('snapshot', '--depth', 'abc');
    expect(exitCode).toBe(2);
    expect(lines).toEqual([]);
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });

  it('emits the standard error envelope under --json', async () => {
    const { exitCode, lines } = await runCli('--json', 'snapshot', '--depth', 'abc');
    expect(exitCode).toBe(2);
    const json = JSON.parse(lines.join('\n'));
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_ARGS');
    expect(json.error.message).toContain('--depth');
    expect(json.error.hint).toBeTruthy();
  });

  it('rejects malformed form fill data before contacting the daemon', async () => {
    const { exitCode, lines } = await runCli('--json', 'form', 'fill', '--data', '{not json');
    expect(exitCode).toBe(2);
    expect(JSON.parse(lines.join('\n')).error.code).toBe('INVALID_ARGS');
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON --arg on eval', async () => {
    const { exitCode } = await runCli('eval', '(a) => a', '--arg', 'bare');
    expect(exitCode).toBe(2);
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });
});

describe('--json envelope', () => {
  it('does not leak the internal correlation id', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'internal-uuid-1234',
      success: true,
      data: { url: 'https://a.test' },
    });
    const { lines } = await runCli('--json', 'get', 'url');
    const json = JSON.parse(lines.join('\n'));
    expect(json).toEqual({ success: true, data: { url: 'https://a.test' } });
    expect(lines.join('\n')).not.toContain('internal-uuid-1234');
  });

  it('carries a page-side stack through to the error envelope', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({
      id: 'r1',
      success: false,
      error: { code: 'UNKNOWN', message: 'boom', stack: 'Error: boom\n  at page:1:1' },
    });
    const { lines } = await runCli('--json', 'eval', '1+1');
    expect(JSON.parse(lines.join('\n')).error.stack).toContain('at page:1:1');
  });
});

describe('eval --arg', () => {
  it('sends repeated --arg values as parsed JSON, in order', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({ id: 'r1', success: true, data: { value: 3 } });
    await runCli('eval', '(a, b) => a + b', '--arg', '1', '--arg', '2');

    const [command] = mockSocketClient.sendCommand.mock.calls[0] as [
      { params: { expression: string; args?: unknown[] } },
    ];
    expect(command.params.expression).toBe('(a, b) => a + b');
    expect(command.params.args).toEqual([1, 2]);
  });

  it('parses object and string args', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({ id: 'r1', success: true, data: { value: 1 } });
    await runCli('eval', '(s, o) => 1', '--arg', '"#title"', '--arg', '{"k":1}');

    const [command] = mockSocketClient.sendCommand.mock.calls[0] as [
      { params: { args?: unknown[] } },
    ];
    expect(command.params.args).toEqual(['#title', { k: 1 }]);
  });

  it('omits args entirely when none are given', async () => {
    mockSocketClient.sendCommand.mockResolvedValue({ id: 'r1', success: true, data: { value: 1 } });
    await runCli('eval', '1+1');

    const [command] = mockSocketClient.sendCommand.mock.calls[0] as [
      { params: { args?: unknown[] } },
    ];
    expect(command.params.args).toBeUndefined();
  });
});
