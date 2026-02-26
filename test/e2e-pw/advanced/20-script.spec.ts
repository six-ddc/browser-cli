import { execFileSync, execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';
import { E2E_DIR } from '../helpers/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../../apps/cli/bin/cli.js');
const SCRIPTS_DIR = path.resolve(__dirname, '../scripts');

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

/**
 * Run `browser-cli script` with TEST_SCRIPT_URL injected into the env.
 * This is needed because user scripts read process.env.TEST_SCRIPT_URL
 * and the standard bcli fixture captures env at module load time.
 */
function runScript(
  scriptName: string,
  baseURL: string,
  pagePath: string,
  opts: { globalArgs?: string[]; scriptArgs?: string[] } = {},
): { stdout: string; stderr: string; exitCode: number; success: boolean } {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const url = `${baseURL}/${pagePath}`;
  const env = {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    BROWSER_CLI_DIR: E2E_DIR,
    TEST_SCRIPT_URL: url,
  };

  // Global args (e.g., --json) go before 'script', script args go after
  const args = [
    CLI_BIN,
    ...(opts.globalArgs ?? []),
    'script',
    scriptPath,
    ...(opts.scriptArgs ?? []),
  ];

  try {
    const stdout = execFileSync('node', args, {
      encoding: 'utf-8',
      timeout: 30_000,
      env,
    });
    return { stdout: stripAnsi(stdout.trim()), stderr: '', exitCode: 0, success: true };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: stripAnsi((e.stdout ?? '').toString().trim()),
      stderr: stripAnsi((e.stderr ?? '').toString().trim()),
      exitCode: e.status ?? 1,
      success: false,
    };
  }
}

// ---- script — basic execution ----

test.describe('script basic', () => {
  test('navigate and return title', async ({ baseURL, activePage }) => {
    const r = runScript('navigate-and-title.mjs', baseURL, PAGES.HOME);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('The Internet');
  });

  test('multi-step form interaction', async ({ baseURL }) => {
    const r = runScript('multi-step.mjs', baseURL, PAGES.LOGIN);
    expect(r.exitCode).toBe(0);
    const output = JSON.parse(r.stdout);
    expect(output.user).toBe('tomsmith');
    expect(output.pass).toBe('SuperSecretPassword!');
    expect(output.submitted).toBe(true);
  });

  test('snapshot returns snapshot field', async ({ baseURL }) => {
    const r = runScript('snapshot.mjs', baseURL, PAGES.HOME);
    expect(r.exitCode).toBe(0);
    // Snapshot result has a "snapshot" field with tree text
    expect(r.stdout).toContain('snapshot');
  });

  test('structured return value', async ({ baseURL }) => {
    const r = runScript('return-value.mjs', baseURL, PAGES.HOME);
    expect(r.exitCode).toBe(0);
    const output = JSON.parse(r.stdout);
    expect(output.title).toContain('The Internet');
    expect(output.url).toContain('/home');
    expect(output.steps).toBe(3);
  });
});

// ---- script — error handling ----

test.describe('script errors', () => {
  test('step error includes step number and action', async ({ baseURL }) => {
    const r = runScript('error-step.mjs', baseURL, PAGES.HOME);
    expect(r.exitCode).not.toBe(0);
    // Error message should contain step info
    expect(r.stderr).toMatch(/Step \d+ \(click\) failed/);
  });

  test('missing file shows error', async ({ baseURL }) => {
    const scriptPath = path.join(SCRIPTS_DIR, 'does-not-exist.mjs');
    const env = {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      BROWSER_CLI_DIR: E2E_DIR,
    };

    let result: { exitCode: number; stderr: string };
    try {
      execFileSync('node', [CLI_BIN, 'script', scriptPath], {
        encoding: 'utf-8',
        timeout: 15_000,
        env,
      });
      result = { exitCode: 0, stderr: '' };
    } catch (err: unknown) {
      const e = err as { stderr?: Buffer | string; status?: number };
      result = {
        exitCode: e.status ?? 1,
        stderr: stripAnsi((e.stderr ?? '').toString().trim()),
      };
    }

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Script not found');
  });

  test('no default export shows error', async ({ baseURL }) => {
    const r = runScript('no-default-export.mjs', baseURL, PAGES.HOME);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('default function');
  });
});

// ---- script — args via -- ----

test.describe('script args', () => {
  test('passes --key value args to script', async ({ baseURL }) => {
    const r = runScript('with-args.mjs', baseURL, PAGES.HOME, {
      scriptArgs: ['--', '--name', 'hello', '--count', '3'],
    });
    expect(r.exitCode).toBe(0);
    const output = JSON.parse(r.stdout);
    expect(output.args.name).toBe('hello');
    expect(output.args.count).toBe('3');
  });

  test('passes boolean flags to script', async ({ baseURL }) => {
    const r = runScript('with-args.mjs', baseURL, PAGES.HOME, {
      scriptArgs: ['--', '--verbose', '--dry-run'],
    });
    expect(r.exitCode).toBe(0);
    const output = JSON.parse(r.stdout);
    expect(output.args.verbose).toBe(true);
    expect(output.args['dry-run']).toBe(true);
  });

  test('no args gives empty object', async ({ baseURL }) => {
    const r = runScript('with-args.mjs', baseURL, PAGES.HOME);
    expect(r.exitCode).toBe(0);
    const output = JSON.parse(r.stdout);
    expect(output.args).toEqual({});
  });
});

// ---- script — --json flag ----

test.describe('script --json', () => {
  test('success with --json', async ({ baseURL }) => {
    const r = runScript('return-value.mjs', baseURL, PAGES.HOME, { globalArgs: ['--json'] });
    expect(r.exitCode).toBe(0);
    const output = JSON.parse(r.stdout);
    expect(output.success).toBe(true);
    expect(output.data).toBeDefined();
    expect(output.data.title).toContain('The Internet');
  });

  test('failure with --json includes step info', async ({ baseURL }) => {
    const r = runScript('error-step.mjs', baseURL, PAGES.HOME, { globalArgs: ['--json'] });
    expect(r.exitCode).not.toBe(0);
    const output = JSON.parse(r.stdout);
    expect(output.success).toBe(false);
    expect(output.step).toBeGreaterThan(0);
    expect(output.action).toBe('click');
  });
});

// ---- script — stdin (`-`) ----

/**
 * Run `browser-cli script -` with script source piped via stdin.
 */
function runStdinScript(
  source: string,
  baseURL: string,
  pagePath: string,
  opts: { globalArgs?: string[] } = {},
): { stdout: string; stderr: string; exitCode: number; success: boolean } {
  const url = `${baseURL}/${pagePath}`;
  const env = {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    BROWSER_CLI_DIR: E2E_DIR,
    TEST_SCRIPT_URL: url,
  };

  const args = [...(opts.globalArgs ?? []), 'script', '-'];

  // Use shell to pipe the script source into the CLI via heredoc
  const cmd = `node ${CLI_BIN} ${args.join(' ')}`;

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 30_000,
      env,
      input: source,
    });
    return { stdout: stripAnsi(stdout.trim()), stderr: '', exitCode: 0, success: true };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: stripAnsi((e.stdout ?? '').toString().trim()),
      stderr: stripAnsi((e.stderr ?? '').toString().trim()),
      exitCode: e.status ?? 1,
      success: false,
    };
  }
}

test.describe('script stdin', () => {
  test('reads script from stdin via -', async ({ baseURL }) => {
    const source = `
export default async function(browser) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  const { title } = await browser.getTitle();
  return title;
}
`;
    const r = runStdinScript(source, baseURL, PAGES.HOME);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('The Internet');
  });

  test('stdin script receives args', async ({ baseURL }) => {
    const source = `
export default async function(browser, args) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  return { greeting: args.name || 'world' };
}
`;
    // stdin script with args: pipe source + pass args after --
    const url = `${baseURL}/${PAGES.HOME}`;
    const env = {
      ...process.env,
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      BROWSER_CLI_DIR: E2E_DIR,
      TEST_SCRIPT_URL: url,
    };
    const cmd = `node ${CLI_BIN} script - -- --name hello`;
    try {
      const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 30_000, env, input: source });
      const output = JSON.parse(stripAnsi(stdout.trim()));
      expect(output.greeting).toBe('hello');
    } catch (err: unknown) {
      const e = err as { stderr?: string };
      throw new Error(`Script failed: ${e.stderr}`);
    }
  });
});
