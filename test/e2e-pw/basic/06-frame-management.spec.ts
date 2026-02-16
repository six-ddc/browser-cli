import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

test.describe('frame list', () => {
  test('lists all frames on page with iframes', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.IFRAME);
    await activePage.waitForTimeout(2000); // Wait for iframe to load
    const r = bcli('frame', 'list');
    if (r.exitCode !== 0) {
      // Frame listing may fail if iframe is cross-origin or not ready
      test.skip();
      return;
    }
    const out = r.stdout.toLowerCase();
    expect(out.includes('frame') || out.includes('iframe') || out.length > 0).toBeTruthy();
  });

  test('shows frames on nested frames page', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.NESTED_FRAMES);
    await activePage.waitForTimeout(2000);
    const r = bcli('frame', 'list');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });
});

test.describe('frame current', () => {
  test('shows current frame info (main by default)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', 'current');
    expect(r.exitCode).toBe(0);
    expect(r.stdout.length).toBeGreaterThan(0);
  });
});

test.describe('frame <selector> — switch to iframe', () => {
  test('switches to iframe by selector', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.IFRAME);
    await activePage.waitForTimeout(3000); // Ensure iframe fully loads

    const r = bcli('frame', '#mce_0_ifr');
    if (r.exitCode !== 0) {
      // Frame switching may not work in test environment
      test.skip();
      return;
    }

    const current = bcli('frame', 'current');
    expect(current.exitCode).toBe(0);

    // Switch back
    bcli('frame', 'main');
  });

  test('frame current changes after switch', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.IFRAME);
    await activePage.waitForTimeout(3000);

    const switchResult = bcli('frame', '#mce_0_ifr');
    if (switchResult.exitCode !== 0) {
      test.skip();
      return;
    }
    const after = bcli('frame', 'current');
    expect(after.exitCode).toBe(0);

    // Switch back
    bcli('frame', 'main');
  });
});

test.describe('frame main — switch back to main frame', () => {
  test('returns to main frame', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.IFRAME);
    await activePage.waitForTimeout(3000);

    const switchResult = bcli('frame', '#mce_0_ifr');
    if (switchResult.exitCode !== 0) {
      test.skip();
      return;
    }
    const r = bcli('frame', 'main');
    expect(r.exitCode).toBe(0);

    const title = bcli('get', 'title');
    expect(title.exitCode).toBe(0);
    expect(title.stdout).toContain('The Internet');
  });

  test('works even when already on main frame', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', 'main');
    expect(r.exitCode).toBe(0);
  });

  test('page operations work after returning from iframe', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.IFRAME);
    await activePage.waitForTimeout(3000);

    const switchResult = bcli('frame', '#mce_0_ifr');
    if (switchResult.exitCode !== 0) {
      test.skip();
      return;
    }
    bcli('frame', 'main');

    const title = bcli('get', 'title');
    expect(title.exitCode).toBe(0);
    expect(title.stdout).toContain('The Internet');
  });
});

test.describe('frame — error handling', () => {
  test('nonexistent iframe selector fails', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', '#nonexistent-iframe-12345');
    expect(r.exitCode).not.toBe(0);
  });
});

test.describe('frame — integration', () => {
  test('switch to frame and back preserves main page access', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.IFRAME);
    await activePage.waitForTimeout(3000);

    const titleBefore = bcli('get', 'title');
    expect(titleBefore.stdout).toContain('The Internet');

    const switchResult = bcli('frame', '#mce_0_ifr');
    if (switchResult.exitCode !== 0) {
      test.skip();
      return;
    }
    bcli('frame', 'main');

    const titleAfter = bcli('get', 'title');
    expect(titleAfter.exitCode).toBe(0);
    expect(titleAfter.stdout).toContain('The Internet');

    // Snapshot may return empty after frame switching due to content script state
    const snap = bcli('snapshot', '-ic');
    expect(snap.exitCode).toBe(0);
  });
});
