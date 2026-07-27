/**
 * Action policy: precedence, glob matching, malformed-file reporting, and the
 * CLI-side refusal path (POLICY_DENIED) including the non-TTY confirm case.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserCliError } from '@browser-cli/shared';
import {
  checkAction,
  decidePolicy,
  describeCommand,
  initPolicy,
  loadPolicyFile,
  parsePolicy,
  resetPolicy,
  type ActionPolicy,
} from '../src/lib/policy.js';
import { registerCommands } from '../src/commands/index.js';
import { createProgram } from '../src/lib/program.js';
import { resetBoundaries } from '../src/lib/boundaries.js';

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

function policy(overrides: Partial<ActionPolicy> = {}): ActionPolicy {
  return { default: 'allow', allow: [], deny: [], confirm: [], ...overrides };
}

describe('parsePolicy', () => {
  it('fills in the defaults for an empty document', () => {
    expect(parsePolicy('{}', 'test')).toEqual({
      default: 'allow',
      allow: [],
      deny: [],
      confirm: [],
    });
  });

  it('keeps every rule list', () => {
    const parsed = parsePolicy(
      '{"default":"deny","allow":["navigate"],"deny":["evaluate"],"confirm":["click"]}',
      'test',
    );
    expect(parsed).toEqual({
      default: 'deny',
      allow: ['navigate'],
      deny: ['evaluate'],
      confirm: ['click'],
    });
  });

  it.each([
    ['not json at all', /not valid JSON/],
    ['[]', /must be a JSON object/],
    ['null', /must be a JSON object/],
    ['{"default":"maybe"}', /must be "allow" or "deny"/],
    ['{"deny":"evaluate"}', /must be an array of non-empty strings/],
    ['{"deny":[""]}', /must be an array of non-empty strings/],
    ['{"deny":[1]}', /must be an array of non-empty strings/],
    ['{"denied":["evaluate"]}', /unknown field\(s\): denied/],
  ])('rejects %s', (source, message) => {
    let thrown: unknown;
    try {
      parsePolicy(source, 'test');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(BrowserCliError);
    expect((thrown as BrowserCliError).code).toBe('INVALID_ARGS');
    expect((thrown as BrowserCliError).message).toMatch(message);
    expect((thrown as BrowserCliError).hint).toBeTruthy();
  });
});

describe('patterns that match no action', () => {
  function parseError(source: string): BrowserCliError {
    try {
      parsePolicy(source, 'test');
    } catch (err) {
      return err as BrowserCliError;
    }
    throw new Error(`expected ${source} to be rejected`);
  }

  // A misspelled entry in `deny` reads as protection but fails open, so it has
  // to be a hard error rather than a no-op rule.
  it('rejects a misspelled action name', () => {
    const err = parseError('{"deny":["navigat"]}');
    expect(err.code).toBe('INVALID_ARGS');
    expect(err.message).toMatch(/matches no action: "navigat"/);
    expect(err.hint).toMatch(/navigate/);
  });

  it('rejects a CLI subcommand name that is not an action name', () => {
    expect(parseError('{"deny":["eval"]}').message).toMatch(/matches no action/);
  });

  it('rejects a glob matching nothing', () => {
    const err = parseError('{"allow":["zzz*"]}');
    expect(err.message).toMatch(/matches no action: "zzz\*"/);
    expect(err.hint).toMatch(/glob/);
  });

  it('checks every rule list, not just deny', () => {
    expect(parseError('{"confirm":["nope"]}').message).toMatch(/field "confirm"/);
  });

  it('accepts real action names and globs that match something', () => {
    expect(() =>
      parsePolicy(
        '{"deny":["evaluate","cdp"],"allow":["tab*","TAB*","*"],"confirm":["navigate"]}',
        'test',
      ),
    ).not.toThrow();
  });
});

describe('loadPolicyFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'browser-cli-policy-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    resetPolicy(null);
    delete process.env.BROWSER_CLI_POLICY;
  });

  it('reads a policy off disk', () => {
    const path = join(dir, 'p.json');
    writeFileSync(path, '{"default":"deny","allow":["snapshot"]}');
    expect(loadPolicyFile(path)).toEqual({
      default: 'deny',
      allow: ['snapshot'],
      deny: [],
      confirm: [],
    });
  });

  it('reports a missing file as INVALID_ARGS with a hint', () => {
    let thrown: unknown;
    try {
      loadPolicyFile(join(dir, 'nope.json'));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(BrowserCliError);
    expect((thrown as BrowserCliError).code).toBe('INVALID_ARGS');
    expect((thrown as BrowserCliError).message).toMatch(/Failed to read policy file/);
    expect((thrown as BrowserCliError).hint).toMatch(/--policy/);
  });

  it('lets an explicit path win over the environment variable', () => {
    const explicit = join(dir, 'explicit.json');
    const fromEnv = join(dir, 'env.json');
    writeFileSync(explicit, '{"deny":["evaluate"]}');
    writeFileSync(fromEnv, '{"deny":["navigate"]}');
    process.env.BROWSER_CLI_POLICY = fromEnv;

    initPolicy(explicit);
    expect(checkAction('evaluate').decision).toBe('deny');
    expect(checkAction('navigate').decision).toBe('allow');
  });

  it('falls back to the environment variable', () => {
    const fromEnv = join(dir, 'env.json');
    writeFileSync(fromEnv, '{"deny":["navigate"]}');
    process.env.BROWSER_CLI_POLICY = fromEnv;

    initPolicy(undefined);
    expect(checkAction('navigate').decision).toBe('deny');
  });

  it('keeps the resolved policy when a later init passes no path', () => {
    const explicit = join(dir, 'explicit.json');
    writeFileSync(explicit, '{"deny":["evaluate"]}');
    initPolicy(explicit);
    initPolicy(undefined);
    expect(checkAction('evaluate').decision).toBe('deny');
  });
});

describe('decidePolicy precedence', () => {
  it('puts deny above confirm and allow', () => {
    const p = policy({ allow: ['click'], confirm: ['click'], deny: ['click'] });
    expect(decidePolicy('click', p)).toEqual({ decision: 'deny', rule: 'click' });
  });

  it('puts confirm above allow', () => {
    const p = policy({ allow: ['click'], confirm: ['click'] });
    expect(decidePolicy('click', p)).toEqual({ decision: 'confirm', rule: 'click' });
  });

  it('honours an explicit allow rule over a deny default', () => {
    const p = policy({ default: 'deny', allow: ['snapshot'] });
    expect(decidePolicy('snapshot', p)).toEqual({ decision: 'allow', rule: 'snapshot' });
  });

  it('falls through to default allow', () => {
    expect(decidePolicy('click', policy())).toEqual({ decision: 'allow' });
  });

  it('falls through to default deny with no rule attached', () => {
    expect(decidePolicy('click', policy({ default: 'deny' }))).toEqual({ decision: 'deny' });
  });

  it('cross-list globs still respect precedence', () => {
    const p = policy({ default: 'deny', allow: ['*'], deny: ['evaluate', 'cdp'] });
    expect(decidePolicy('snapshot', p).decision).toBe('allow');
    expect(decidePolicy('evaluate', p).decision).toBe('deny');
    expect(decidePolicy('cdp', p).decision).toBe('deny');
  });
});

describe('glob matching', () => {
  it.each([
    ['tab*', 'tabNew', true],
    ['tab*', 'tabClose', true],
    ['tab*', 'navigate', false],
    ['*', 'anything', true],
    ['navigate', 'navigate', true],
    ['navigate', 'navigateBack', false],
    ['get?rl', 'getUrl', true],
    ['*Set', 'cookiesSet', true],
    ['cookies*', 'cookiesGet', true],
    ['TAB*', 'tabNew', true],
  ])('pattern %s vs %s -> %s', (pattern, action, matches) => {
    const p = policy({ deny: [pattern] });
    expect(decidePolicy(action, p).decision).toBe(matches ? 'deny' : 'allow');
  });

  it('treats regex metacharacters in a pattern as literals', () => {
    const p = policy({ deny: ['get.rl'] });
    expect(decidePolicy('getUrl', p).decision).toBe('allow');
  });
});

describe('describeCommand', () => {
  it('surfaces the most identifying parameter', () => {
    expect(describeCommand('navigate', { url: 'https://example.com' })).toBe(
      'navigate url=https://example.com',
    );
    expect(describeCommand('click', { selector: '#buy' })).toBe('click selector=#buy');
  });

  it('falls back to the bare action name', () => {
    expect(describeCommand('snapshot', {})).toBe('snapshot');
    expect(describeCommand('snapshot', undefined)).toBe('snapshot');
  });

  it('collapses whitespace and truncates long values', () => {
    const summary = describeCommand('evaluate', { expression: 'a'.repeat(500) });
    expect(summary.length).toBeLessThan(140);
    expect(summary).toMatch(/…$/);
    expect(describeCommand('evaluate', { expression: 'a\n  b' })).toBe('evaluate expression=a b');
  });
});

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

describe('CLI enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketClient.connect.mockResolvedValue(undefined);
    mockSocketClient.sendCommand.mockResolvedValue({ id: 'r1', success: true, data: {} });
    mockDaemon.ensureDaemon.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetPolicy(null);
  });

  it('never reaches the daemon for a denied action', async () => {
    resetPolicy(policy({ deny: ['click'] }));
    const { exitCode } = await runCli('click', '#a');
    expect(exitCode).toBe(1);
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });

  it('reports POLICY_DENIED with a hint under --json', async () => {
    resetPolicy(policy({ deny: ['click'] }));
    const { lines, exitCode } = await runCli('--json', 'click', '#a');
    expect(exitCode).toBe(1);
    const envelope = JSON.parse(lines[0] as string) as {
      success: boolean;
      error: { code: string; message: string; hint: string };
    };
    expect(envelope.success).toBe(false);
    expect(envelope.error.code).toBe('POLICY_DENIED');
    expect(envelope.error.message).toMatch(/deny rule "click"/);
    expect(envelope.error.hint).toMatch(/allow/);
  });

  it('denies by default when the policy defaults to deny', async () => {
    resetPolicy(policy({ default: 'deny' }));
    const { lines } = await runCli('--json', 'click', '#a');
    const envelope = JSON.parse(lines[0] as string) as { error: { message: string } };
    expect(envelope.error.message).toMatch(/the policy default/);
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });

  it('lets an allowed action through', async () => {
    resetPolicy(policy({ default: 'deny', allow: ['click'] }));
    await runCli('click', '#a');
    expect(mockSocketClient.sendCommand).toHaveBeenCalledTimes(1);
  });

  it('refuses a confirm action when stdin is not a TTY', async () => {
    resetPolicy(policy({ confirm: ['click'] }));
    const { lines, exitCode } = await runCli('--json', 'click', '#a');
    expect(exitCode).toBe(1);
    const envelope = JSON.parse(lines[0] as string) as {
      error: { code: string; message: string; hint: string };
    };
    expect(envelope.error.code).toBe('POLICY_DENIED');
    expect(envelope.error.message).toMatch(/needs interactive confirmation/);
    expect(envelope.error.hint).toMatch(/TTY/);
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });
});

describe('--policy is resolved before the command runs', () => {
  let dir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocketClient.sendCommand.mockResolvedValue({ id: 'r1', success: true, data: {} });
    mockDaemon.ensureDaemon.mockResolvedValue(undefined);
    dir = mkdtempSync(join(tmpdir(), 'browser-cli-policy-'));
    resetPolicy(null);
    resetBoundaries();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    resetPolicy(null);
    resetBoundaries();
  });

  async function runProgram(...args: string[]): Promise<{ lines: string[]; exitCode?: number }> {
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

    try {
      await createProgram().parseAsync(['node', 'browser-cli', ...args]);
    } catch (err) {
      if (!(err instanceof ExitCalled)) throw err;
    } finally {
      console.log = origLog;
      console.error = origErr;
      exitSpy.mockRestore();
    }
    return { lines, exitCode };
  }

  it('fails with INVALID_ARGS before sending anything when the file is malformed', async () => {
    const path = join(dir, 'bad.json');
    writeFileSync(path, '{ not json');
    const { lines, exitCode } = await runProgram('--json', '--policy', path, 'get', 'url');
    expect(exitCode).toBe(2);
    const envelope = JSON.parse(lines[0] as string) as { error: { code: string; hint: string } };
    expect(envelope.error.code).toBe('INVALID_ARGS');
    expect(envelope.error.hint).toMatch(/default/);
    expect(mockSocketClient.sendCommand).not.toHaveBeenCalled();
  });

  it('applies a valid file to the command that follows it', async () => {
    const path = join(dir, 'good.json');
    writeFileSync(path, '{"default":"deny","allow":["getUrl"]}');
    await runProgram('--policy', path, 'get', 'url');
    expect(mockSocketClient.sendCommand).toHaveBeenCalledTimes(1);

    resetPolicy(null);
    writeFileSync(path, '{"default":"deny"}');
    const { exitCode } = await runProgram('--policy', path, 'get', 'url');
    expect(exitCode).toBe(1);
    expect(mockSocketClient.sendCommand).toHaveBeenCalledTimes(1);
  });
});
