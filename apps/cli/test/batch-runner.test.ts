/**
 * Batch/repl executor: line parsing, and running many command lines over one
 * connection without state leaking between them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { splitArgs, parseBatchInput, BatchRunner } = await import('../src/lib/batch-runner.js');

beforeEach(() => {
  vi.clearAllMocks();
  mockSocketClient.connect.mockResolvedValue(undefined);
});

describe('splitArgs', () => {
  it('splits on whitespace', () => {
    expect(splitArgs('click #login')).toEqual(['click', '#login']);
  });

  it('keeps double-quoted arguments together', () => {
    expect(splitArgs('fill "#user name" hello world')).toEqual([
      'fill',
      '#user name',
      'hello',
      'world',
    ]);
  });

  it('treats single quotes as literal', () => {
    expect(splitArgs(`eval 'a => a["x"]'`)).toEqual(['eval', 'a => a["x"]']);
  });

  it('honours backslash escapes outside quotes', () => {
    expect(splitArgs('click a\\ b')).toEqual(['click', 'a b']);
  });

  it('unescapes only shell-significant characters inside double quotes', () => {
    expect(splitArgs('type "say \\"hi\\""')).toEqual(['type', 'say "hi"']);
    expect(splitArgs('type "a\\nb"')).toEqual(['type', 'a\\nb']);
  });

  it('preserves an explicitly empty argument', () => {
    expect(splitArgs('fill #user ""')).toEqual(['fill', '#user', '']);
  });

  it('collapses runs of whitespace', () => {
    expect(splitArgs('  click    #a  ')).toEqual(['click', '#a']);
  });

  it('rejects an unbalanced quote', () => {
    expect(() => splitArgs('fill "#user')).toThrow(/Unbalanced/);
  });
});

describe('parseBatchInput', () => {
  it('drops blank lines and # comments but keeps original line numbers', () => {
    const input = ['# setup', '', 'navigate https://a.test', '   ', '  # note', 'click #go'].join(
      '\n',
    );
    expect(parseBatchInput(input)).toEqual([
      { line: 3, text: 'navigate https://a.test' },
      { line: 6, text: 'click #go' },
    ]);
  });

  it('returns nothing for input that is all comments', () => {
    expect(parseBatchInput('# a\n\n# b')).toEqual([]);
  });
});

/** Queue one daemon response per command, in order. */
function respondWith(...responses: Array<{ success: boolean; data?: unknown; error?: unknown }>) {
  let i = 0;
  mockSocketClient.sendCommand.mockImplementation(() => {
    const r = responses[Math.min(i++, responses.length - 1)];
    return Promise.resolve({ id: `r${i}`, ...r });
  });
}

describe('BatchRunner', () => {
  it('reuses a single connection across lines', async () => {
    respondWith({ success: true, data: { clicked: true } });
    const runner = new BatchRunner();
    await runner.connect();
    await runner.run('click #a', 1);
    await runner.run('click #b', 2);

    expect(mockSocketClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSocketClient.sendCommand).toHaveBeenCalledTimes(2);
  });

  it('captures command stdout as the line output instead of printing it', async () => {
    respondWith({ success: true, data: { url: 'https://a.test', title: 'A' } });
    const runner = new BatchRunner();
    await runner.connect();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = await runner.run('get url', 1);
    logSpy.mockRestore();

    expect(result.success).toBe(true);
    expect(result.output).toContain('https://a.test');
    expect(result.data).toEqual({ url: 'https://a.test', title: 'A' });
  });

  it('reports a daemon failure with its structured error and keeps going', async () => {
    respondWith(
      {
        success: false,
        error: { code: 'ELEMENT_NOT_FOUND', message: 'no such element', hint: 'run snapshot -i' },
      },
      { success: true, data: { clicked: true } },
    );
    const runner = new BatchRunner();
    await runner.connect();

    const first = await runner.run('click #missing', 1);
    expect(first.success).toBe(false);
    expect(first.error?.code).toBe('ELEMENT_NOT_FOUND');
    expect(first.error?.hint).toBe('run snapshot -i');
    expect(first.line).toBe(1);

    const second = await runner.run('click #present', 2);
    expect(second.success).toBe(true);
  });

  it('never lets a command exit the process', async () => {
    respondWith({ success: false, error: { code: 'TIMEOUT', message: 'timed out' } });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit must not be called in batch mode');
    }) as never);

    const runner = new BatchRunner();
    await runner.connect();
    const result = await runner.run('click #a', 1);

    expect(exitSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TIMEOUT');
    exitSpy.mockRestore();
  });

  it('rejects an unknown command as INVALID_ARGS without contacting the daemon', async () => {
    const runner = new BatchRunner();
    await runner.connect();
    const result = await runner.run('definitelynotacommand', 1);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_ARGS');
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });

  it('rejects daemon lifecycle and nested batch commands', async () => {
    const runner = new BatchRunner();
    await runner.connect();
    for (const cmd of ['batch', 'repl', 'start', 'stop']) {
      const result = await runner.run(cmd, 1);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ARGS');
    }
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });

  it('reports an unbalanced quote as INVALID_ARGS', async () => {
    const runner = new BatchRunner();
    await runner.connect();
    const result = await runner.run('fill "#user', 1);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_ARGS');
    expect(result.error?.message).toMatch(/Unbalanced/);
  });

  it('does not leak option values from one line into the next', async () => {
    respondWith({ success: true, data: { clicked: true } });
    const runner = new BatchRunner();
    await runner.connect();

    await runner.run('click #a --first', 1);
    await runner.run('click #b', 2);

    const calls = mockSocketClient.sendCommand.mock.calls;
    expect((calls[0][0] as { params: { position?: unknown } }).params.position).toEqual({
      type: 'first',
    });
    expect((calls[1][0] as { params: { position?: unknown } }).params.position).toBeUndefined();
  });

  it('applies the run-wide tab and session to every command', async () => {
    respondWith({ success: true, data: { clicked: true } });
    const runner = new BatchRunner({ tabId: 7, sessionId: 'sess-1' });
    await runner.connect();
    await runner.run('click #a', 1);

    const [, options] = mockSocketClient.sendCommand.mock.calls[0] as [
      unknown,
      { tabId?: number; sessionId?: string },
    ];
    expect(options.tabId).toBe(7);
    expect(options.sessionId).toBe('sess-1');
  });
});
