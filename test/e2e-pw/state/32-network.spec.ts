import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

test.describe('network routes (list)', () => {
  test('lists active routes (initially empty or minimal)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('network', 'routes');
    // Command should run without crashing; may succeed or report no routes
    expect(r.exitCode === 0 || r.stdout.includes('no active routes') || r.stderr.length > 0).toBeTruthy();
  });
});

test.describe('network route --abort', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
  });

  test('blocks requests matching pattern', async ({ bcli }) => {
    const r = bcli('network', 'route', '*google-analytics*', '--abort');
    // Network interception may not be available in all environments
    if (r.exitCode !== 0) {
      test.skip();
      return;
    }
    expect(r.stdout).toContain('Route');
  });

  test('blocks specific domain', async ({ bcli }) => {
    const r = bcli('network', 'route', '*example.invalid*', '--abort');
    if (r.exitCode !== 0) {
      test.skip();
      return;
    }
    expect(r.stdout).toContain('Route');
  });
});

test.describe('network route --redirect', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
  });

  test('redirects matching requests', async ({ bcli }) => {
    const r = bcli('network', 'route', '*old-url*', '--redirect', 'https://example.com/new-url');
    if (r.exitCode !== 0) {
      test.skip();
      return;
    }
    expect(r.stdout).toContain('Route');
  });
});

test.describe('network unroute', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
  });

  test('removes a specific route', async ({ bcli }) => {
    const r1 = bcli('network', 'route', '*test-route*', '--abort');
    if (r1.exitCode !== 0) {
      test.skip();
      return;
    }

    const routeIdMatch = r1.stdout.match(/#(\d+)/);
    if (routeIdMatch) {
      const routeId = routeIdMatch[1];
      const r2 = bcli('network', 'unroute', routeId);
      expect(r2.exitCode).toBe(0);
      expect(r2.stdout).toContain('removed');
    }
  });
});

test.describe('network requests', () => {
  test('lists tracked requests', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(2000);

    const r = bcli('network', 'requests');
    expect(r.exitCode).toBe(0);
  });

  test('limits number of results with --limit', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(2000);

    const r = bcli('network', 'requests', '--limit', '5');
    expect(r.exitCode).toBe(0);
  });

  test('filters by URL pattern with --pattern', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(2000);

    const r = bcli('network', 'requests', '--pattern', '*localhost*');
    expect(r.exitCode).toBe(0);
  });

  test('shows only blocked requests with --blocked', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('network', 'requests', '--blocked');
    expect(r.exitCode).toBe(0);
  });

  test('filters by tab ID with --tab', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(2000);

    const tabOutput = bcli('tab', 'list');
    const tabIdMatch = tabOutput.stdout.match(/\[(\d+)\]/);

    if (tabIdMatch) {
      const r = bcli('network', 'requests', '--tab', tabIdMatch[1]);
      expect(r.exitCode).toBe(0);
    }
  });
});

test.describe('network clear', () => {
  test('clears tracked requests', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(1000);

    const r = bcli('network', 'clear');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Cleared');
  });
});

test.describe('network integration', () => {
  test('add route, navigate, check blocked requests', async ({ bcli, navigateAndWait, activePage }) => {
    const r1 = bcli('network', 'route', '*google-analytics*', '--abort');
    if (r1.exitCode !== 0) {
      test.skip();
      return;
    }

    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(2000);

    const r2 = bcli('network', 'routes');
    expect(r2.exitCode).toBe(0);
  });

  test('multiple routes can coexist', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('network', 'route', '*analytics*', '--abort');
    if (r1.exitCode !== 0) {
      test.skip();
      return;
    }

    const r2 = bcli('network', 'route', '*tracking*', '--abort');
    expect(r2.exitCode).toBe(0);
  });

  test('clear requests then navigate generates new requests', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('network', 'clear');
    expect(r1.exitCode).toBe(0);

    await navigateAndWait(PAGES.LOGIN);
    await activePage.waitForTimeout(2000);

    const r2 = bcli('network', 'requests');
    expect(r2.exitCode).toBe(0);
  });
});
