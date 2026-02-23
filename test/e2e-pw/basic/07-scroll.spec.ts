import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test.describe('scroll down', () => {
  test('scrolls page downward', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'down');
    expect(r).toBcliSuccess();
    // Allow time for scroll to complete in the browser
    await sleep(300);
    const scrollY = await activePage.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test('scrolls specific pixel amount', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'down', '--amount', '500');
    expect(r).toBcliSuccess();
    await sleep(300);
    const scrollY = await activePage.evaluate(() => window.scrollY);
    // Allow some tolerance for rounding
    expect(scrollY).toBeGreaterThanOrEqual(450);
    expect(scrollY).toBeLessThanOrEqual(550);
  });
});

test.describe('scroll up', () => {
  test('scrolls page upward', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    bcli('scroll', 'down', '--amount', '500');
    await sleep(300);
    const scrollAfterDown = await activePage.evaluate(() => window.scrollY);
    expect(scrollAfterDown).toBeGreaterThan(0);

    const r = bcli('scroll', 'up');
    expect(r).toBcliSuccess();
    await sleep(300);
    const scrollAfterUp = await activePage.evaluate(() => window.scrollY);
    expect(scrollAfterUp).toBeLessThan(scrollAfterDown);
  });

  test('scrolls specific pixel amount upward', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    bcli('scroll', 'down', '--amount', '800');
    await sleep(300);
    const scrollAfterDown = await activePage.evaluate(() => window.scrollY);
    expect(scrollAfterDown).toBeGreaterThan(0);

    const r = bcli('scroll', 'up', '--amount', '300');
    expect(r).toBcliSuccess();
    await sleep(300);
    const scrollAfterUp = await activePage.evaluate(() => window.scrollY);
    expect(scrollAfterUp).toBeLessThan(scrollAfterDown);
  });
});

test.describe('scroll left / right', () => {
  test('scrolls page to the right', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'right');
    expect(r).toBcliSuccess();
  });

  test('scrolls page to the left', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    bcli('scroll', 'right', '--amount', '500');
    await sleep(300);
    const scrollXAfterRight = await activePage.evaluate(() => window.scrollX);

    const r = bcli('scroll', 'left');
    expect(r).toBcliSuccess();
    await sleep(300);
    const scrollXAfterLeft = await activePage.evaluate(() => window.scrollX);
    expect(scrollXAfterLeft).toBeLessThanOrEqual(scrollXAfterRight);
  });
});

test.describe('scroll --selector', () => {
  test('scrolls within a specific element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'down', '--selector', 'body');
    expect(r).toBcliSuccess();
  });
});

test.describe('scrollintoview', () => {
  test('scrolls element into viewport', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scrollintoview', '#scroll-target');
    expect(r).toBcliSuccess();
    // Allow time for scroll to complete in the browser
    await sleep(300);
    // Verify the element is now within the viewport
    const rect = await activePage.evaluate(() => {
      const el = document.getElementById('scroll-target');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
    expect(rect).not.toBeNull();
    expect(rect!.top).toBeGreaterThanOrEqual(0);
    expect(rect!.bottom).toBeLessThanOrEqual(1200); // element should be roughly in viewport area
  });

  test('works with CSS selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('scrollintoview', 'div#page-footer a');
    expect(r).toBcliSuccess();
    const visible = bcli('is', 'visible', 'div#page-footer a');
    expect(visible).toBcliSuccess();
    expect(visible.stdout).toContain('true');
  });

  test('fails for nonexistent element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('scrollintoview', '.nonexistent-element-12345');
    expect(r).toBcliFailure();
  });
});

test.describe('scroll integration', () => {
  test('multiple scroll operations in sequence', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);

    let r = bcli('scroll', 'down', '--amount', '200');
    expect(r).toBcliSuccess();
    await sleep(300);

    r = bcli('scroll', 'down', '--amount', '200');
    expect(r).toBcliSuccess();
    await sleep(300);

    r = bcli('scroll', 'up', '--amount', '100');
    expect(r).toBcliSuccess();
    await sleep(300);

    // After scrolling down 400 then up 100, should be around 300
    const scrollY = await activePage.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100);
  });

  test('scroll down then take snapshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const before = bcli('snapshot', '-c');
    expect(before).toBcliSuccess();

    bcli('scroll', 'down', '--amount', '500');

    const after = bcli('snapshot', '-c');
    expect(after).toBcliSuccess();
  });

  test('scrollintoview then click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const scroll = bcli('scrollintoview', 'div#page-footer a');
    expect(scroll).toBcliSuccess();
    const click = bcli('click', 'div#page-footer a');
    expect(click).toBcliSuccess();
  });
});
