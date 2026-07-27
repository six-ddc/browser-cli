import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('--json flag', () => {
  test('navigate returns JSON format', async ({ bcli, baseURL }) => {
    const r = bcli('--json', 'navigate', `${baseURL}/${PAGES.HOME}`);
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('get url returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'get', 'url');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed)).toContain('/login');
  });

  test('get title returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'get', 'title');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed)).toContain('The Internet');
  });

  test('get text returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'get', 'text', 'h2');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed)).toContain('Login Page');
  });

  test('click returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'click', SEL.USERNAME);
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('fill returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'fill', SEL.USERNAME, 'json-test');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('snapshot returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'snapshot', '-ic');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('error returns JSON error format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'click', '.nonexistent-element-12345');
    expect(r).toBcliFailure();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
    expect('error' in parsed || 'message' in parsed).toBeTruthy();
  });

  test('is visible returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'is', 'visible', SEL.USERNAME);
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('get count returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('--json', 'get', 'count', SEL.CHECKBOX);
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed)).toContain('2');
  });

  test('get value returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'json-value-test');
    const r = bcli('--json', 'get', 'value', SEL.USERNAME);
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed)).toContain('json-value-test');
  });

  test('cookies returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'cookies');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('tab list returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'tab', 'list');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('eval returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'eval', '1 + 2');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
    expect(JSON.stringify(parsed)).toContain('3');
  });

  test('wait returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'wait', 'h2');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('scroll returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'scroll', 'down');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });
});

test.describe('--json JSON validity', () => {
  test('output is valid JSON (parseable)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'get', 'url');
    expect(r.exitCode).toBe(0);
    expect(() => JSON.parse(r.stdout)).not.toThrow();
  });

  test('error output is valid JSON (parseable)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'click', '.does-not-exist-9999');
    // Even on error, --json mode should always return valid JSON
    expect(() => JSON.parse(r.stdout)).not.toThrow();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
  });
});

test.describe('--json + various commands integration', () => {
  test('find command returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'find', 'role=button');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('highlight returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'highlight', 'h2', '--duration', '100');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('back returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'back');
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });

  test('check returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('--json', 'check', `${SEL.CHECKBOX}:first-of-type`);
    expect(r).toBcliSuccess();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(true);
  });
});

test.describe('--policy', () => {
  const policyDir = path.join(os.tmpdir(), 'browser-cli-e2e-policy');

  const writePolicy = (name: string, policy: unknown): string => {
    mkdirSync(policyDir, { recursive: true });
    const file = path.join(policyDir, name);
    writeFileSync(file, JSON.stringify(policy));
    return file;
  };

  test.afterAll(() => {
    rmSync(policyDir, { recursive: true, force: true });
  });

  test('denies a listed action before it reaches the browser', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = writePolicy('deny-evaluate.json', { deny: ['evaluate'] });
    const r = bcli('--json', '--policy', file, 'eval', '1 + 1');
    expect(r).toBcliFailure();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
    expect(parsed.error.code).toBe('POLICY_DENIED');
    expect(parsed.error.hint).toBeTruthy();
    expect(r.exitCode).toBe(1);
  });

  test('deny wins over allow for the same action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = writePolicy('deny-beats-allow.json', {
      allow: ['evaluate'],
      deny: ['evaluate'],
    });
    const r = bcli('--json', '--policy', file, 'eval', '1 + 1');
    expect(JSON.parse(r.stdout).error.code).toBe('POLICY_DENIED');
  });

  test('default deny blocks everything not explicitly allowed', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = writePolicy('readonly.json', {
      default: 'deny',
      allow: ['getUrl', 'getTitle', 'snapshot'],
    });
    expect(bcli('--policy', file, 'get', 'url')).toBcliSuccess();
    const blocked = bcli('--json', '--policy', file, 'click', SEL.USERNAME);
    expect(JSON.parse(blocked.stdout).error.code).toBe('POLICY_DENIED');
  });

  test('globs match a whole action family', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = writePolicy('no-tabs.json', { deny: ['tab*'] });
    const r = bcli('--json', '--policy', file, 'tab', 'list');
    expect(JSON.parse(r.stdout).error.code).toBe('POLICY_DENIED');
    expect(bcli('--policy', file, 'get', 'url')).toBcliSuccess();
  });

  test('a confirm rule fails outside a TTY instead of hanging', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const file = writePolicy('confirm-click.json', { confirm: ['click'] });
    const r = bcli('--json', '--policy', file, 'click', SEL.USERNAME);
    const parsed = JSON.parse(r.stdout);
    expect(parsed.error.code).toBe('POLICY_DENIED');
    expect(parsed.error.hint).toMatch(/TTY|allow/);
  });

  test('a malformed policy file fails with INVALID_ARGS up front', async ({ bcli }) => {
    mkdirSync(policyDir, { recursive: true });
    const file = path.join(policyDir, 'broken.json');
    writeFileSync(file, '{ not json');
    const r = bcli('--json', '--policy', file, 'get', 'url');
    expect(r.exitCode).toBe(2);
    expect(JSON.parse(r.stdout).error.code).toBe('INVALID_ARGS');
  });

  test('a missing policy file fails with INVALID_ARGS', async ({ bcli }) => {
    const r = bcli('--json', '--policy', path.join(policyDir, 'nope.json'), 'get', 'url');
    expect(r.exitCode).toBe(2);
    expect(JSON.parse(r.stdout).error.code).toBe('INVALID_ARGS');
  });
});

test.describe('--boundaries', () => {
  const BOUNDARY_START = /^\[BOUNDARY_START:([0-9a-f]{32})\]$/;

  test('wraps get text in a matching marker pair', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--boundaries', 'get', 'text', 'h2');
    expect(r).toBcliSuccess();
    const lines = r.stdout.split('\n');
    const opening = BOUNDARY_START.exec(lines[0]!);
    expect(opening).not.toBeNull();
    expect(lines.at(-1)).toBe(`[BOUNDARY_END:${opening![1]}]`);
    expect(lines.slice(1, -1).join('\n')).toContain('Login Page');
  });

  test('wraps snapshot output', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--boundaries', 'snapshot', '-ic');
    expect(r).toBcliSuccess();
    const lines = r.stdout.split('\n');
    expect(BOUNDARY_START.test(lines[0]!)).toBe(true);
    expect(lines.at(-1)).toMatch(/^\[BOUNDARY_END:[0-9a-f]{32}\]$/);
  });

  test('emits no markers when the flag is absent', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    expect(bcli('get', 'text', 'h2').stdout).not.toContain('BOUNDARY_');
  });

  test('leaves --json output unmarked', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', '--boundaries', 'get', 'text', 'h2');
    expect(r).toBcliSuccess();
    expect(r.stdout).not.toContain('BOUNDARY_');
    expect(JSON.parse(r.stdout).success).toBe(true);
  });

  // markdown needs a page Readability can actually extract; LOGIN has too
  // little prose and fails before any boundary is applied.
  test('wraps markdown output', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('--boundaries', 'markdown');
    expect(r).toBcliSuccess();
    expect(r.stdout.split('\n')[0]).toMatch(BOUNDARY_START);
  });
});
