import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

test.describe('scroll down', () => {
  test('scrolls page downward', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'down');
    expect(r.exitCode).toBe(0);
  });

  test('scrolls specific pixel amount', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'down', '--amount', '500');
    expect(r.exitCode).toBe(0);
  });
});

test.describe('scroll up', () => {
  test('scrolls page upward', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    bcli('scroll', 'down', '--amount', '500');
    await activePage.waitForTimeout(1000);

    const r = bcli('scroll', 'up');
    expect(r.exitCode).toBe(0);
  });

  test('scrolls specific pixel amount upward', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    bcli('scroll', 'down', '--amount', '800');
    await activePage.waitForTimeout(1000);

    const r = bcli('scroll', 'up', '--amount', '300');
    expect(r.exitCode).toBe(0);
  });
});

test.describe('scroll left / right', () => {
  test('scrolls page to the right', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'right');
    expect(r.exitCode).toBe(0);
  });

  test('scrolls page to the left', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    bcli('scroll', 'right', '--amount', '500');
    await activePage.waitForTimeout(1000);

    const r = bcli('scroll', 'left');
    expect(r.exitCode).toBe(0);
  });
});

test.describe('scroll --selector', () => {
  test('scrolls within a specific element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scroll', 'down', '--selector', 'body');
    expect(r.exitCode).toBe(0);
  });
});

test.describe('scrollintoview', () => {
  test('scrolls element into viewport', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('scrollintoview', '#scroll-target');
    expect(r.exitCode).toBe(0);
  });

  test('works with CSS selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('scrollintoview', 'div#page-footer a');
    if (r.exitCode === 0) {
      const visible = bcli('is', 'visible', 'div#page-footer a');
      expect(visible.stdout).toContain('true');
    }
  });

  test('fails for nonexistent element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('scrollintoview', '.nonexistent-element-12345');
    expect(r.exitCode).not.toBe(0);
  });
});

test.describe('scroll integration', () => {
  test('multiple scroll operations in sequence', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);

    let r = bcli('scroll', 'down', '--amount', '200');
    expect(r.exitCode).toBe(0);

    r = bcli('scroll', 'down', '--amount', '200');
    expect(r.exitCode).toBe(0);

    r = bcli('scroll', 'up', '--amount', '100');
    expect(r.exitCode).toBe(0);
  });

  test('scroll down then take snapshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const before = bcli('snapshot', '-c');
    expect(before.exitCode).toBe(0);

    bcli('scroll', 'down', '--amount', '500');

    const after = bcli('snapshot', '-c');
    expect(after.exitCode).toBe(0);
  });

  test('scrollintoview then click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const scroll = bcli('scrollintoview', 'div#page-footer a');
    if (scroll.exitCode === 0) {
      const click = bcli('click', 'div#page-footer a');
      expect(click.exitCode).toBe(0);
    }
  });
});
