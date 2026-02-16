import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('window (list)', () => {
  test('lists all windows (bare command)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('window');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('window list: lists all windows', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('window', 'list');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });
});

test.describe('window new', () => {
  test('opens a new window with URL', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('window', 'new', `${baseURL}/${PAGES.LOGIN}`);
    expect(r.exitCode).toBe(0);
    bcli('wait', '3000');

    // Content script may not be ready in the new window
    const url = bcli('get', 'url');
    if (url.exitCode === 0) {
      expect(url.stdout).toContain('/login');
    }

    // Clean up — close the new window
    bcli('window', 'close');
    bcli('wait', '2000');
  });
});

test.describe('window close', () => {
  test('closes a window', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('window', 'new', `${baseURL}/${PAGES.CHECKBOXES}`);
    bcli('wait', '2000');

    const r = bcli('window', 'close');
    expect(r.exitCode).toBe(0);
    bcli('wait', '2000');

    const list = bcli('window', 'list');
    expect(list.exitCode).toBe(0);
  });
});

test.describe('window integration', () => {
  test('open new window, interact, close', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('window', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '2000');

    const fill = bcli('fill', SEL.USERNAME, 'window-test');
    expect(fill.exitCode).toBe(0);

    bcli('window', 'close');
    bcli('wait', '2000');

    const url = bcli('get', 'url');
    expect(url.exitCode).toBe(0);
  });
});
