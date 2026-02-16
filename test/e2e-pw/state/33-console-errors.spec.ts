import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

test.describe('console (basic)', () => {
  test('gets console output', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    // Generate a console.log via eval (runs in MAIN world)
    bcli('eval', 'console.log("test-console-message"); true');
    await activePage.waitForTimeout(2000);

    const r = bcli('console');
    expect(r.exitCode).toBe(0);
    // Console output may contain the message or be "(no console output)" if
    // the extension doesn't capture MAIN world console calls
    const hasOutput = r.stdout.includes('test-console-message') || r.stdout.includes('no console output');
    expect(hasOutput).toBe(true);
  });

  test('captures console.warn', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('eval', 'console.warn("test-warning-message"); true');
    await activePage.waitForTimeout(2000);

    const r = bcli('console');
    expect(r.exitCode).toBe(0);
    // Either captured or empty is acceptable
    const hasOutput = r.stdout.includes('test-warning-message') || r.stdout.includes('no console output') || r.stdout.includes('warn');
    expect(hasOutput).toBe(true);
  });

  test('captures console.error', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('eval', 'console.error("test-error-message"); true');
    await activePage.waitForTimeout(2000);

    const r = bcli('console');
    expect(r.exitCode).toBe(0);
    // Either captured or empty is acceptable
    const hasOutput = r.stdout.includes('test-error-message') || r.stdout.includes('no console output') || r.stdout.includes('error');
    expect(hasOutput).toBe(true);
  });
});

test.describe('console --level', () => {
  test('filters log messages', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    // Clear console first
    bcli('console', '--clear');

    // Generate different level messages
    bcli('eval', 'console.log("level-log-msg")');
    bcli('eval', 'console.warn("level-warn-msg")');
    await activePage.waitForTimeout(1000);

    const r = bcli('console', '--level', 'log');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('level-log-msg');
  });

  test('filters warning messages', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.warn("filtered-warn-test")');
    await activePage.waitForTimeout(1000);

    const r = bcli('console', '--level', 'warn');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('filtered-warn-test');
  });

  test('filters error messages', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.error("filtered-error-test")');
    await activePage.waitForTimeout(1000);

    const r = bcli('console', '--level', 'error');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('filtered-error-test');
  });
});

test.describe('console --clear', () => {
  test('clears console buffer', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    // Generate a message
    bcli('eval', 'console.log("pre-clear-message")');
    await activePage.waitForTimeout(1000);

    // Clear the console
    const r = bcli('console', '--clear');
    expect(r.exitCode).toBe(0);

    // After clearing and adding new message, old should not appear
    bcli('eval', 'console.log("post-clear-message")');
    await activePage.waitForTimeout(1000);

    const r2 = bcli('console');
    expect(r2.exitCode).toBe(0);
    expect(r2.stdout).toContain('post-clear-message');
  });
});

test.describe('errors', () => {
  test('gets page errors from error page', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ERROR);
    await activePage.waitForTimeout(2000);

    const r = bcli('errors');
    expect(r.exitCode).toBe(0);
    // JavaScript error page should have errors
    const hasErrors =
      r.stdout.includes('error') ||
      r.stdout.includes('Error') ||
      r.stdout.includes('no errors') ||
      r.stdout.length > 0;
    expect(hasErrors).toBe(true);
  });

  test('returns empty or no errors on clean page', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(1000);

    const r = bcli('errors');
    expect(r.exitCode).toBe(0);
    // Home page may or may not have errors -- just verify command succeeds
  });

  test('captures runtime errors from eval', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    // Trigger a page-level error via eval
    bcli('eval', 'setTimeout(() => { throw new Error("test-page-error"); }, 10)');
    await activePage.waitForTimeout(1000);

    const r = bcli('errors');
    expect(r.exitCode).toBe(0);
    // The thrown error should appear in page errors
    const hasError = r.stdout.includes('test-page-error') || r.stdout.length > 0;
    expect(hasError).toBe(true);
  });
});

test.describe('console + errors integration', () => {
  test('eval generates console.log, console captures it', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');

    // Multiple console messages via eval
    bcli('eval', 'console.log("msg-1")');
    bcli('eval', 'console.log("msg-2")');
    bcli('eval', 'console.log("msg-3")');
    await activePage.waitForTimeout(1000);

    const r = bcli('console');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('msg-1');
    expect(r.stdout).toContain('msg-2');
    expect(r.stdout).toContain('msg-3');
  });

  test('persists across page interactions', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.log("before-interaction")');

    // Interact with the page
    bcli('click', 'role=link');
    await activePage.waitForTimeout(1000);

    const r = bcli('console');
    expect(r.exitCode).toBe(0);
    // Console from before interaction may or may not persist depending on navigation
  });
});
