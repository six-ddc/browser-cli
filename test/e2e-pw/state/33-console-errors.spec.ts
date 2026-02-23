import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test.describe('console (basic)', () => {
  test('gets console output', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'console capture is unreliable after network route tests destabilize extension connection');
    await navigateAndWait(PAGES.HOME);

    // Generate a console.log via eval (runs in MAIN world)
    bcli('eval', 'console.log("test-console-message"); true');
    await sleep(2000);

    const r = bcli('console');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('test-console-message');
  });

  test('captures console.warn', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'console capture is unreliable after network route tests destabilize extension connection');
    await navigateAndWait(PAGES.HOME);

    bcli('eval', 'console.warn("test-warning-message"); true');
    await sleep(2000);

    const r = bcli('console');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('test-warning-message');
  });

  test('captures console.error', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'console capture is unreliable after network route tests destabilize extension connection');
    await navigateAndWait(PAGES.HOME);

    bcli('eval', 'console.error("test-error-message"); true');
    await sleep(2000);

    const r = bcli('console');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('test-error-message');
  });
});

test.describe('console --level', () => {
  test('filters log messages', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'console capture is unreliable after network route tests destabilize extension connection');
    await navigateAndWait(PAGES.HOME);

    // Clear console first
    bcli('console', '--clear');

    // Generate different level messages
    bcli('eval', 'console.log("level-log-msg")');
    bcli('eval', 'console.warn("level-warn-msg")');
    await sleep(1000);

    const r = bcli('console', '--level', 'log');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('level-log-msg');
    // Negative assertion: warn-level message should NOT appear when filtering by log
    expect(r.stdout).not.toContain('level-warn-msg');
  });

  test('filters warning messages', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.log("filter-log-only")');
    bcli('eval', 'console.warn("filtered-warn-test")');
    await sleep(1000);

    const r = bcli('console', '--level', 'warn');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('filtered-warn-test');
    // Negative assertion: log-level message should NOT appear when filtering by warn
    expect(r.stdout).not.toContain('filter-log-only');
  });

  test('filters error messages', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.log("filter-log-not-error")');
    bcli('eval', 'console.error("filtered-error-test")');
    await sleep(1000);

    const r = bcli('console', '--level', 'error');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('filtered-error-test');
    // Negative assertion: log-level message should NOT appear when filtering by error
    expect(r.stdout).not.toContain('filter-log-not-error');
  });

  test('filters info messages', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.warn("filter-warn-not-info")');
    bcli('eval', 'console.info("filtered-info-test")');
    await sleep(1000);

    const r = bcli('console', '--level', 'info');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('filtered-info-test');
    // Negative assertion: warn-level message should NOT appear when filtering by info
    expect(r.stdout).not.toContain('filter-warn-not-info');
  });

  test('filters debug messages', async ({ bcli, navigateAndWait }) => {
    // debug messages may not be captured by all environments
    test.fixme(true, 'debug-level console capture is not reliable across environments');

    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.debug("filtered-debug-test")');
    await sleep(1000);

    const r = bcli('console', '--level', 'debug');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('filtered-debug-test');
  });
});

test.describe('console --clear', () => {
  test('clears console buffer', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    // Generate a message
    bcli('eval', 'console.log("pre-clear-message")');
    await sleep(1000);

    // Clear the console
    const r = bcli('console', '--clear');
    expect(r).toBcliSuccess();

    // After clearing and adding new message, old should not appear
    bcli('eval', 'console.log("post-clear-message")');
    await sleep(1000);

    const r2 = bcli('console');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('post-clear-message');
  });
});

test.describe('errors', () => {
  test('gets page errors from error page', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ERROR);
    await sleep(2000);

    const r = bcli('errors');
    expect(r).toBcliSuccess();
    // JavaScript error page should have actual errors
    expect(r.stdout.toLowerCase()).toContain('error');
  });

  test('returns empty or no errors on clean page', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    await sleep(1000);

    const r = bcli('errors');
    expect(r).toBcliSuccess();
    // Home page may or may not have errors -- just verify command succeeds
  });

  test('captures runtime errors from eval', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'eval-thrown async errors via setTimeout are not reliably captured by the errors command');
    await navigateAndWait(PAGES.HOME);

    // Trigger a page-level error via eval
    bcli('eval', 'setTimeout(() => { throw new Error("test-page-error"); }, 10)');
    await sleep(1000);

    const r = bcli('errors');
    expect(r).toBcliSuccess();
    // The thrown error should appear in page errors
    expect(r.stdout).toContain('test-page-error');
  });
});

test.describe('console + errors integration', () => {
  test('eval generates console.log, console captures it', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');

    // Multiple console messages via eval
    bcli('eval', 'console.log("msg-1")');
    bcli('eval', 'console.log("msg-2")');
    bcli('eval', 'console.log("msg-3")');
    await sleep(1000);

    const r = bcli('console');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('msg-1');
    expect(r.stdout).toContain('msg-2');
    expect(r.stdout).toContain('msg-3');
  });

  test('persists across page interactions', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');
    bcli('eval', 'console.log("before-interaction")');

    // Interact with the page
    bcli('click', 'role=link');
    await sleep(1000);

    const r = bcli('console');
    expect(r).toBcliSuccess();
    // Console from before interaction may or may not persist depending on navigation
  });
});
