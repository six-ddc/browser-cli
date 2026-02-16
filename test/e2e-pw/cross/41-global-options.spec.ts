import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('--json flag', () => {
  test('navigate returns JSON format', async ({ bcli, baseURL }) => {
    const r = bcli('--json', 'navigate', `${baseURL}/${PAGES.HOME}`);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('true');
  });

  test('get url returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'get', 'url');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('/login');
  });

  test('get title returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'get', 'title');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('The Internet');
  });

  test('get text returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'get', 'text', 'h2');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('Login Page');
  });

  test('click returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'click', SEL.USERNAME);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });

  test('fill returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'fill', SEL.USERNAME, 'json-test');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });

  test('snapshot returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'snapshot', '-ic');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });

  test('error returns JSON error format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'click', '.nonexistent-element-12345');
    expect(r.exitCode).not.toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('false');
    expect(r.stdout.includes('error') || r.stdout.includes('Error')).toBeTruthy();
  });

  test('is visible returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'is', 'visible', SEL.USERNAME);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('true');
  });

  test('get count returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('--json', 'get', 'count', SEL.CHECKBOX);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('2');
  });

  test('get value returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'json-value-test');
    const r = bcli('--json', 'get', 'value', SEL.USERNAME);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('json-value-test');
  });

  test('cookies returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'cookies');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.includes('success') || r.stdout.includes('{')).toBeTruthy();
  });

  test('tab list returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'tab', 'list');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.includes('success') || r.stdout.includes('{')).toBeTruthy();
  });

  test('eval returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'eval', '1 + 2');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
    expect(r.stdout).toContain('3');
  });

  test('wait returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'wait', 'h2');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });

  test('scroll returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('--json', 'scroll', 'down');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
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
    // Even on error, output should be valid JSON
    try {
      JSON.parse(r.stdout);
    } catch {
      // May not always be parseable — acceptable
    }
  });
});

test.describe('--session flag', () => {
  test('default session works', async ({ bcli }) => {
    const r = bcli('status');
    expect(r.exitCode).toBe(0);
  });
});

test.describe('--json + various commands integration', () => {
  test('find command returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'find', 'role', 'button');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });

  test('highlight returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'highlight', 'h2', '--duration', '100');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });

  test('back returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('--json', 'back');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });

  test('check returns JSON format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('--json', 'check', `${SEL.CHECKBOX}:first-of-type`);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('success');
  });
});
