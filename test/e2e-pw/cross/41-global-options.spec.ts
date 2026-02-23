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
    const r = bcli('--json', 'find', 'role', 'button');
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
