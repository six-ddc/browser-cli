import { test as base, expect as baseExpect } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_WS_PORT, E2E_DIR } from '../helpers/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../../apps/cli/bin/cli.js');

// Strip ANSI escape codes from CLI output
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');
const CLI_ENV = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', BROWSER_CLI_DIR: E2E_DIR };

interface LifecycleResult {
  stdout: string;
  stderr: string;
  output: string; // combined stdout + stderr
  exitCode: number;
}

/**
 * Lifecycle-specific bcli helper.
 * Uses the same BROWSER_CLI_DIR (inherited from global-setup) for isolation.
 * Uses spawnSync to capture both stdout and stderr.
 */
function lifecycleBcli(...args: string[]): LifecycleResult {
  const result = spawnSync('node', [CLI_BIN, ...args], {
    encoding: 'utf-8',
    timeout: 15_000,
    env: CLI_ENV,
  });
  const stdout = stripAnsi((result.stdout ?? '').trim());
  const stderr = stripAnsi((result.stderr ?? '').trim());
  return {
    stdout,
    stderr,
    output: `${stdout}\n${stderr}`.trim(),
    exitCode: result.status ?? 1,
  };
}

/** Ensure the daemon is stopped */
function ensureStopped() {
  try {
    execFileSync('node', [CLI_BIN, 'stop'], {
      encoding: 'utf-8',
      timeout: 10_000,
      env: CLI_ENV,
    });
  } catch {
    // Already stopped — ignore
  }
}

// Use a separate test describe that doesn't require the main bcli fixture
const test = base;
const expect = baseExpect;

test.describe('start command', () => {
  test.afterEach(() => {
    ensureStopped();
  });

  test('start launches daemon', () => {
    ensureStopped();
    const r = lifecycleBcli('start', '--port', String(E2E_WS_PORT));
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('Daemon started');
  });

  test('--json start returns valid JSON with pid', () => {
    ensureStopped();
    const r = lifecycleBcli('--json', 'start', '--port', String(E2E_WS_PORT));
    expect(r.exitCode).toBe(0);
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.pid).toBeGreaterThan(0);
  });

  test('start when already running handles gracefully', () => {
    ensureStopped();
    lifecycleBcli('start', '--port', String(E2E_WS_PORT));

    // Starting again should succeed (already running) or report it's already running
    const r = lifecycleBcli('start', '--port', String(E2E_WS_PORT));
    expect(r.exitCode).toBe(0);
    expect(r.output).toMatch(/already running|Daemon started/i);
  });
});

test.describe('stop command', () => {
  test.afterEach(() => {
    ensureStopped();
  });

  test('stop stops running daemon', () => {
    lifecycleBcli('start', '--port', String(E2E_WS_PORT));
    const r = lifecycleBcli('stop');
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('stopped');
  });

  test('--json stop returns valid JSON', () => {
    lifecycleBcli('start', '--port', String(E2E_WS_PORT));
    const r = lifecycleBcli('--json', 'stop');
    expect(r.exitCode).toBe(0);
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('stop when not running handles gracefully', () => {
    ensureStopped();
    const r = lifecycleBcli('stop');
    expect(r.exitCode).toBe(0);
    expect(r.output).toContain('not running');
  });
});

test.describe('status --json when not running', () => {
  test('reports daemon not running', () => {
    ensureStopped();
    const r = lifecycleBcli('--json', 'status');
    expect(r.exitCode).toBe(0);
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.daemon).toBe(false);
  });
});
