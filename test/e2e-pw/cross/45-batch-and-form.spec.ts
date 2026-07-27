import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ===========================================================================
// batch — many commands over one connection, NDJSON per line
// ===========================================================================

let workDir: string;

test.beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'browser-cli-batch-'));
});

test.afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Write command lines to a file and return its path. */
function batchFile(name: string, lines: string[]): string {
  const file = path.join(workDir, name);
  writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

/** Parse NDJSON stdout into one object per line. */
function ndjson(stdout: string): Array<Record<string, unknown>> {
  return stdout
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

test.describe('batch', () => {
  test('runs every line and emits one NDJSON result per command', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = batchFile('happy.txt', [
      '# fill the login form',
      '',
      `fill ${SEL.USERNAME} tomsmith`,
      `fill ${SEL.PASSWORD} secret`,
      'get url',
    ]);

    const r = bcli('batch', file);
    expect(r.exitCode).toBe(0);

    const results = ndjson(r.stdout);
    expect(results).toHaveLength(3);
    expect(results.every((x) => x.success === true)).toBe(true);
    // Blank lines and comments are skipped, but line numbers stay honest.
    expect(results.map((x) => x.line)).toEqual([3, 4, 5]);
    expect(results[2].command).toBe('get url');
    expect(String(results[2].output)).toContain('login');
  });

  test('applies the commands to the real page', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = batchFile('applies.txt', [
      `fill ${SEL.USERNAME} batchuser`,
      `fill ${SEL.PASSWORD} batchpass`,
    ]);

    expect(bcli('batch', file).exitCode).toBe(0);

    expect(await activePage.inputValue(SEL.USERNAME)).toBe('batchuser');
    expect(await activePage.inputValue(SEL.PASSWORD)).toBe('batchpass');
  });

  test('keeps going after a failure and exits non-zero', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = batchFile('continue.txt', [
      `fill ${SEL.USERNAME} first`,
      'click #definitely-not-here',
      `fill ${SEL.PASSWORD} last`,
    ]);

    const r = bcli('batch', file);
    expect(r.exitCode).toBe(1);

    const results = ndjson(r.stdout);
    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect((results[1].error as { code: string }).code).toBe('ELEMENT_NOT_FOUND');
    expect((results[1].error as { hint?: string }).hint).toBeTruthy();
    expect(results[2].success).toBe(true);
  });

  test('--fail-fast stops at the first failure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = batchFile('failfast.txt', [
      `fill ${SEL.USERNAME} first`,
      'click #definitely-not-here',
      `fill ${SEL.PASSWORD} never-reached`,
    ]);

    const r = bcli('batch', file, '--fail-fast');
    expect(r.exitCode).toBe(1);

    const results = ndjson(r.stdout);
    expect(results).toHaveLength(2);
    expect(results[1].success).toBe(false);
  });

  test('handles quoted arguments the way a shell would', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = batchFile('quotes.txt', [`fill "${SEL.USERNAME}" "hello world"`]);

    expect(bcli('batch', file).exitCode).toBe(0);
    expect(await activePage.inputValue(SEL.USERNAME)).toBe('hello world');
  });

  test('rejects an unknown command without touching the page', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = batchFile('unknown.txt', ['definitelynotacommand']);

    const r = bcli('batch', file);
    expect(r.exitCode).toBe(1);
    const results = ndjson(r.stdout);
    expect((results[0].error as { code: string }).code).toBe('INVALID_ARGS');
  });

  test('refuses to run daemon lifecycle commands inside a batch', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = batchFile('nested.txt', ['stop']);

    const r = bcli('batch', file);
    expect(r.exitCode).toBe(1);
    expect((ndjson(r.stdout)[0].error as { code: string }).code).toBe('INVALID_ARGS');
    // The daemon must still be up for the next command.
    expect(bcli('get', 'url').exitCode).toBe(0);
  });

  test('rejects a missing batch file with the argument exit code', ({ bcli }) => {
    const r = bcli('batch', path.join(workDir, 'does-not-exist.txt'));
    expect(r.exitCode).toBe(2);
  });
});

// ===========================================================================
// form fill — one round-trip, control type decides the primitive
// ===========================================================================

test.describe('form fill', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.FORM_FILL);
  });

  test('drives text, textarea, select and checkbox from one JSON map', async ({
    bcli,
    activePage,
  }) => {
    const data = JSON.stringify({
      '#name': 'Alice',
      '#email': 'alice@example.com',
      '#bio': 'hello there',
      '#country': 'Japan',
      '#terms': true,
      '#newsletter': false,
    });

    const r = bcli('form', 'fill', '--data', data);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled 6/6 fields');

    expect(await activePage.inputValue('#name')).toBe('Alice');
    expect(await activePage.inputValue('#email')).toBe('alice@example.com');
    expect(await activePage.inputValue('#bio')).toBe('hello there');
    // Matched by visible option text, not just value.
    expect(await activePage.inputValue('#country')).toBe('jp');
    expect(await activePage.isChecked('#terms')).toBe(true);
    expect(await activePage.isChecked('#newsletter')).toBe(false);
  });

  test('reports the primitive chosen per control type', async ({ bcli }) => {
    const data = JSON.stringify({ '#name': 'Bob', '#country': 'us', '#terms': true });
    const r = bcli('--json', 'form', 'fill', '--data', data);
    expect(r).toBcliSuccess();

    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(parsed.data.fields.map((f: { action: string }) => f.action)).toEqual([
      'fill',
      'select',
      'check',
    ]);
    expect(parsed.data.filled).toBe(3);
    expect(parsed.data.failed).toBe(0);
  });

  test('checks a radio button', async ({ bcli, activePage }) => {
    expect(bcli('form', 'fill', '--data', '{"#plan-pro": true}')).toBcliSuccess();
    expect(await activePage.isChecked('#plan-pro')).toBe(true);
  });

  test('aborts on the first bad field and says how far it got', async ({ bcli, activePage }) => {
    const data = JSON.stringify({ '#name': 'Carol', '#nope': 'x', '#email': 'never@example.com' });
    const r = bcli('form', 'fill', '--data', data);

    expect(r.exitCode).toBe(3);
    expect(r.stderr).toContain('ELEMENT_NOT_FOUND');
    expect(r.stderr).toContain('1 of 3 fields');
    // Fields before the failure stay applied; fields after it are untouched.
    expect(await activePage.inputValue('#name')).toBe('Carol');
    expect(await activePage.inputValue('#email')).toBe('');
  });

  test('--continue-on-error applies the rest and tallies the failure', async ({
    bcli,
    activePage,
  }) => {
    const data = JSON.stringify({ '#name': 'Dave', '#nope': 'x', '#email': 'dave@example.com' });
    const r = bcli('--json', 'form', 'fill', '--data', data, '--continue-on-error');
    expect(r).toBcliSuccess();

    const parsed = JSON.parse(r.stdout);
    expect(parsed.data.filled).toBe(2);
    expect(parsed.data.failed).toBe(1);
    expect(parsed.data.fields[1].error.code).toBe('ELEMENT_NOT_FOUND');

    expect(await activePage.inputValue('#name')).toBe('Dave');
    expect(await activePage.inputValue('#email')).toBe('dave@example.com');
  });

  test('refuses a disabled field unless --force is given', async ({ bcli }) => {
    const r = bcli('form', 'fill', '--data', '{"#locked": "x"}');
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('ELEMENT_DISABLED');
  });

  test('rejects malformed --data with the argument exit code', ({ bcli }) => {
    const r = bcli('--json', 'form', 'fill', '--data', '{not json');
    expect(r.exitCode).toBe(2);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe('INVALID_ARGS');
    expect(parsed.error.hint).toBeTruthy();
  });

  test('accepts an array so one selector can repeat', async ({ bcli, activePage }) => {
    const data = JSON.stringify([
      ['#name', 'first'],
      ['#name', 'second'],
    ]);
    expect(bcli('form', 'fill', '--data', data)).toBcliSuccess();
    expect(await activePage.inputValue('#name')).toBe('second');
  });
});
