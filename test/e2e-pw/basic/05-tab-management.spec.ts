import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('tab (list)', () => {
  test('lists all tabs (bare command)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('tab');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('tab list: lists all tabs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('tab', 'list');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('http');
  });
});

test.describe('tab new', () => {
  test('opens a new blank tab', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('tab', 'new');
    expect(r.exitCode).toBe(0);

    const list = bcli('tab', 'list');
    expect(list.exitCode).toBe(0);

    // Clean up — close the newly opened tab
    bcli('tab', 'close');
  });

  test('opens tab with specific URL', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('tab', 'new', `${baseURL}/${PAGES.LOGIN}`);
    expect(r.exitCode).toBe(0);
    bcli('wait', '2000');

    const url = bcli('get', 'url');
    expect(url.exitCode).toBe(0);
    expect(url.stdout).toContain('/login');

    // Clean up — close the newly opened tab (active)
    bcli('tab', 'close');
  });
});

test.describe('tab switch', () => {
  test('switches to tab by ID', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Record original tab ID
    const origList = bcli('tab', 'list');
    const origTabIds = [...origList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);

    bcli('tab', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '2000');

    const url = bcli('get', 'url');
    expect(url.stdout).toContain('/login');

    // Switch back to original tab
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
      bcli('wait', '1000');
    }

    // Clean up — close the extra tab (the login tab, not the original)
    // Switch to the new tab and close it
    const list = bcli('tab', 'list');
    const allIds = [...list.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
    const extraIds = allIds.filter((id) => !origTabIds.includes(id));
    for (const id of extraIds) {
      bcli('tab', id);
      bcli('tab', 'close');
    }
    // Switch back to original
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
    }
  });
});

test.describe('tab close', () => {
  test('closes the active tab', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Record original tab
    const origList = bcli('tab', 'list');
    const origTabIds = [...origList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);

    bcli('tab', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '2000');

    // Active tab is now the new (login) tab. Closing it should return to original.
    const r = bcli('tab', 'close');
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Tab closed');
    bcli('wait', '1000');

    // Should be back on the original tab
    const url = bcli('get', 'url');
    expect(url.exitCode).toBe(0);
  });

  test('closes a tab by specific tab ID', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Record original tab IDs
    const origList = bcli('tab', 'list');
    const origTabIds = [...origList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);

    // Open a new tab
    bcli('tab', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '2000');

    // Get the new tab's ID
    const afterList = bcli('tab', 'list');
    const allIds = [...afterList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
    const newTabId = allIds.find((id) => !origTabIds.includes(id));
    expect(newTabId).toBeDefined();

    // Switch back to original tab first
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
      bcli('wait', '1000');
    }

    // Close the new tab by its specific ID
    const r = bcli('tab', 'close', newTabId!);
    expect(r.exitCode).toBe(0);
    bcli('wait', '1000');

    // Verify the new tab is gone
    const finalList = bcli('tab', 'list');
    expect(finalList.stdout).not.toContain(`[${newTabId}]`);
  });
});

test.describe('tab integration', () => {
  test('open new tab, interact, switch back', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Record original tab
    const origList = bcli('tab', 'list');
    const origTabIds = [...origList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);

    bcli('tab', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '2000');

    const fill = bcli('fill', SEL.USERNAME, 'tab-test-user');
    expect(fill.exitCode).toBe(0);

    // Switch back to original tab
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
      bcli('wait', '1000');
    }

    // Clean up — close extra tabs
    const list = bcli('tab', 'list');
    const allIds = [...list.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
    const extraIds = allIds.filter((id) => !origTabIds.includes(id));
    for (const id of extraIds) {
      bcli('tab', id);
      bcli('tab', 'close');
    }
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
    }
  });

  test('multiple new tabs then close all extras', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Record original tab
    const origList = bcli('tab', 'list');
    const origTabIds = [...origList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);

    bcli('tab', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '1000');
    bcli('tab', 'new', `${baseURL}/${PAGES.CHECKBOXES}`);
    bcli('wait', '1000');

    const list = bcli('tab', 'list');
    expect(list.exitCode).toBe(0);

    // Close all extras (not the original)
    const allIds = [...list.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
    const extraIds = allIds.filter((id) => !origTabIds.includes(id));
    for (const id of extraIds) {
      bcli('tab', id);
      bcli('tab', 'close');
      bcli('wait', '500');
    }

    // Switch back to original
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
    }

    const remaining = bcli('tab', 'list');
    expect(remaining.exitCode).toBe(0);
  });
});
