import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('network routes (list)', () => {
  test('lists active routes (initially empty or minimal)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('network', 'routes');
    expect(r).toBcliSuccess();
  });
});

test.describe('network route --abort', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
  });

  test('blocks requests matching pattern', async ({ bcli }) => {
    test.fixme(true, 'network route fails: Rule with id 10001 does not have a unique ID');
    const r = bcli('network', 'route', '*google-analytics*', '--abort');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Route');

    // Verify the route appears in the routes list
    const r2 = bcli('network', 'routes');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('google-analytics');
  });

  test('blocks specific domain', async ({ bcli }) => {
    test.fixme(true, 'network route fails: Rule with id 10001 does not have a unique ID');
    const r = bcli('network', 'route', '*example.invalid*', '--abort');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Route');

    // Verify the route appears in the routes list
    const r2 = bcli('network', 'routes');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('example.invalid');
  });
});

test.describe('network route --redirect', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
  });

  test('redirects matching requests', async ({ bcli }) => {
    test.fixme(true, 'network route fails: Rule with id 10001 does not have a unique ID');
    const r = bcli('network', 'route', '*old-url*', '--redirect', 'https://example.com/new-url');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Route');

    // Verify the route appears in the routes list
    const r2 = bcli('network', 'routes');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('old-url');
  });
});

test.describe('network unroute', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
  });

  test('removes a specific route', async ({ bcli }) => {
    test.fixme(true, 'network route fails: Rule with id 10001 does not have a unique ID');
    const r1 = bcli('network', 'route', '*test-route*', '--abort');
    expect(r1).toBcliSuccess();

    const routeIdMatch = r1.stdout.match(/#(\d+)/);
    expect(routeIdMatch).toBeTruthy();

    const routeId = routeIdMatch![1];
    const r2 = bcli('network', 'unroute', routeId);
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('removed');
  });
});

test.describe('network integration', () => {
  test('add route, navigate, check blocked requests', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'network route fails: Rule with id 10001 does not have a unique ID');
    const r1 = bcli('network', 'route', '*google-analytics*', '--abort');
    expect(r1).toBcliSuccess();

    await navigateAndWait(PAGES.HOME);
    await sleep(2000);

    const r2 = bcli('network', 'routes');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('google-analytics');
  });

  test('multiple routes can coexist', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'network route fails: Rule with id 10001 does not have a unique ID');
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('network', 'route', '*analytics*', '--abort');
    expect(r1).toBcliSuccess();

    const r2 = bcli('network', 'route', '*tracking*', '--abort');
    expect(r2).toBcliSuccess();

    // Verify both routes appear in the routes list
    const r3 = bcli('network', 'routes');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('analytics');
    expect(r3.stdout).toContain('tracking');
  });

  test('clear requests then navigate generates new requests', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('network', 'clear');
    expect(r1).toBcliSuccess();

    await navigateAndWait(PAGES.LOGIN);
    await sleep(2000);

    const r2 = bcli('network', 'requests');
    expect(r2).toBcliSuccess();
    // After navigating to login page, requests should contain its URL
    expect(r2.stdout).toContain('login');
  });
});
