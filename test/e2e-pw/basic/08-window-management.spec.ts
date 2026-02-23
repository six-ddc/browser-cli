import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

// Match the headless detection logic from fixtures/bcli.ts:
// headless is the default unless HEADLESS=0 is explicitly set.
const isHeadless = process.env.HEADLESS !== '0';

test.describe('window (list)', () => {
  test('lists all windows (bare command)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('window');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('window list: lists all windows', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('window', 'list');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });
});

test.describe('window new', () => {
  test.skip(isHeadless, 'window create/close unreliable in headless mode');

  test('opens a new window with URL', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);
    const beforeList = bcli('window', 'list');
    expect(beforeList).toBcliSuccess();
    const beforeCount = [...beforeList.stdout.matchAll(/\[(\d+)\]/g)].length;

    const r = bcli('window', 'new', `${baseURL}/${PAGES.LOGIN}`);
    expect(r).toBcliSuccess();
    bcli('wait', '3000');

    // Verify window count increased
    const afterList = bcli('window', 'list');
    expect(afterList).toBcliSuccess();
    const afterCount = [...afterList.stdout.matchAll(/\[(\d+)\]/g)].length;
    expect(afterCount).toBe(beforeCount + 1);

    const url = bcli('get', 'url');
    expect(url).toBcliSuccess();
    expect(url.stdout).toContain('/login');

    // Clean up -- close the new window
    bcli('window', 'close');
    bcli('wait', '2000');
  });

  test('opens a new blank window (no URL)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const beforeList = bcli('window', 'list');
    expect(beforeList).toBcliSuccess();
    const beforeCount = [...beforeList.stdout.matchAll(/\[(\d+)\]/g)].length;

    const r = bcli('window', 'new');
    expect(r).toBcliSuccess();
    bcli('wait', '2000');

    // Verify window count increased
    const afterList = bcli('window', 'list');
    expect(afterList).toBcliSuccess();
    const afterCount = [...afterList.stdout.matchAll(/\[(\d+)\]/g)].length;
    expect(afterCount).toBe(beforeCount + 1);

    // Clean up -- close the new blank window
    bcli('window', 'close');
    bcli('wait', '2000');
  });
});

test.describe('window close', () => {
  test.skip(isHeadless, 'window create/close unreliable in headless mode');

  test('closes a window', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);
    const beforeList = bcli('window', 'list');
    expect(beforeList).toBcliSuccess();
    const beforeCount = [...beforeList.stdout.matchAll(/\[(\d+)\]/g)].length;

    bcli('window', 'new', `${baseURL}/${PAGES.CHECKBOXES}`);
    bcli('wait', '2000');

    const r = bcli('window', 'close');
    expect(r).toBcliSuccess();
    bcli('wait', '2000');

    // After closing the new window, count should be back to original
    const afterList = bcli('window', 'list');
    expect(afterList).toBcliSuccess();
    const afterCount = [...afterList.stdout.matchAll(/\[(\d+)\]/g)].length;
    expect(afterCount).toBe(beforeCount);
  });

  test('closes a window by specific ID', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Record original window IDs
    const origList = bcli('window', 'list');
    expect(origList).toBcliSuccess();
    const origWindowIds = [...origList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);

    // Open a new window
    bcli('window', 'new', `${baseURL}/${PAGES.CHECKBOXES}`);
    bcli('wait', '3000');

    // Get all window IDs and find the new one
    const afterList = bcli('window', 'list');
    expect(afterList).toBcliSuccess();
    const allIds = [...afterList.stdout.matchAll(/\[(\d+)\]/g)].map((m) => m[1]);
    const newWindowId = allIds.find((id) => !origWindowIds.includes(id));
    expect(newWindowId).toBeDefined();

    // Close the new window by its specific ID
    const r = bcli('window', 'close', newWindowId!);
    expect(r).toBcliSuccess();
    bcli('wait', '2000');

    // Verify the new window is gone
    const finalList = bcli('window', 'list');
    expect(finalList).toBcliSuccess();
    expect(finalList.stdout).not.toContain(`[${newWindowId}]`);
  });
});

test.describe('window integration', () => {
  test.skip(isHeadless, 'window create/close unreliable in headless mode');

  test('open new window, interact, close', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('window', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '2000');

    const fill = bcli('fill', SEL.USERNAME, 'window-test');
    expect(fill).toBcliSuccess();

    bcli('window', 'close');
    bcli('wait', '2000');

    const url = bcli('get', 'url');
    expect(url).toBcliSuccess();
  });
});
