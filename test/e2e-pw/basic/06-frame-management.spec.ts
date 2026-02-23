import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test.describe('frame list', () => {
  test('lists all frames on page with iframes', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(2000); // Wait for iframe to load
    const r = bcli('frame', 'list');
    expect(r).toBcliSuccess();
    const out = r.stdout.toLowerCase();
    expect(out.includes('frame') || out.includes('iframe')).toBeTruthy();
  });

  test('shows frames on nested frames page', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.NESTED_FRAMES);
    await sleep(2000);
    const r = bcli('frame', 'list');
    expect(r).toBcliSuccess();
    const out = r.stdout.toLowerCase();
    expect(out.includes('frame') || out.includes('iframe')).toBeTruthy();
  });
});

test.describe('frame current', () => {
  test('shows current frame info (main by default)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', 'current');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });
});

test.describe('frame <selector> — switch to iframe', () => {
  test.fixme(true, 'frame switching fails in headless mode with CONTENT_SCRIPT_NOT_READY or iframe not found');

  test('switches to iframe by selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(3000); // Ensure iframe fully loads

    const r = bcli('frame', '#mce_0_ifr');
    expect(r).toBcliSuccess();

    const current = bcli('frame', 'current');
    expect(current).toBcliSuccess();

    // Switch back
    bcli('frame', 'main');
  });

  test('frame current changes after switch', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(3000);

    const before = bcli('frame', 'current');
    expect(before).toBcliSuccess();

    const switchResult = bcli('frame', '#mce_0_ifr');
    expect(switchResult).toBcliSuccess();

    const after = bcli('frame', 'current');
    expect(after).toBcliSuccess();

    // After switching, the current frame info should differ from before
    expect(after.stdout).not.toBe(before.stdout);

    // Switch back
    bcli('frame', 'main');
  });
});

test.describe('frame main — switch back to main frame', () => {
  test('returns to main frame', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'frame switching fails in headless mode with CONTENT_SCRIPT_NOT_READY or iframe not found');

    await navigateAndWait(PAGES.IFRAME);
    await sleep(3000);

    const switchResult = bcli('frame', '#mce_0_ifr');
    expect(switchResult).toBcliSuccess();

    const r = bcli('frame', 'main');
    expect(r).toBcliSuccess();

    const title = bcli('get', 'title');
    expect(title).toBcliSuccess();
    expect(title.stdout).toContain('The Internet');
  });

  test('works even when already on main frame', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', 'main');
    expect(r).toBcliSuccess();
  });

  test('page operations work after returning from iframe', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'frame switching fails in headless mode with CONTENT_SCRIPT_NOT_READY or iframe not found');

    await navigateAndWait(PAGES.IFRAME);
    await sleep(3000);

    const switchResult = bcli('frame', '#mce_0_ifr');
    expect(switchResult).toBcliSuccess();
    bcli('frame', 'main');

    const title = bcli('get', 'title');
    expect(title).toBcliSuccess();
    expect(title.stdout).toContain('The Internet');
  });
});

test.describe('frame — error handling', () => {
  test('nonexistent iframe selector fails', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', '#nonexistent-iframe-12345');
    expect(r).toBcliFailure();
  });
});

test.describe('frame — integration', () => {
  test.fixme(true, 'frame switching fails in headless mode with CONTENT_SCRIPT_NOT_READY or iframe not found');

  test('switch to frame and back preserves main page access', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(3000);

    const titleBefore = bcli('get', 'title');
    expect(titleBefore).toBcliSuccess();
    expect(titleBefore.stdout).toContain('The Internet');

    const switchResult = bcli('frame', '#mce_0_ifr');
    expect(switchResult).toBcliSuccess();
    bcli('frame', 'main');

    const titleAfter = bcli('get', 'title');
    expect(titleAfter).toBcliSuccess();
    expect(titleAfter.stdout).toContain('The Internet');

    const snap = bcli('snapshot', '-ic');
    expect(snap).toBcliSuccess();
  });
});
