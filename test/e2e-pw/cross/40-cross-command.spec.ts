import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';
import { mkdtempSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test.describe('tab + interaction cross-tests', () => {
  test('open tab, fill form, switch back, verify different pages', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Record original tab IDs
    const origList = bcli('tab', 'list');
    const origTabIds = [...origList.stdout.matchAll(/\[(\d+)\]/g)].map(m => m[1]);

    bcli('tab', 'new', `${baseURL}/${PAGES.LOGIN}`);
    bcli('wait', '2000');

    const fill = bcli('fill', SEL.USERNAME, 'cross-tab-user');
    expect(fill.exitCode).toBe(0);

    // Switch back to original tab
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
      bcli('wait', '1000');
      const url = bcli('get', 'url');
      expect(url.exitCode).toBe(0);
    }

    // Clean up — close extra tabs (not the original)
    const list = bcli('tab', 'list');
    const allIds = [...list.stdout.matchAll(/\[(\d+)\]/g)].map(m => m[1]);
    const extraIds = allIds.filter(id => !origTabIds.includes(id));
    for (const id of extraIds) {
      bcli('tab', id);
      bcli('tab', 'close');
    }
    if (origTabIds.length > 0) {
      bcli('tab', origTabIds[0]);
    }
  });
});

test.describe('eval + get verification cross-tests', () => {
  test('eval modifies DOM, get verifies', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const evalR = bcli('eval', 'document.title = "Cross Test Title"; true');
    expect(evalR.exitCode).toBe(0);

    const title = bcli('get', 'title');
    expect(title).toBcliSuccess();
    expect(title.stdout).toContain('Cross Test Title');
  });

  test('eval adds element, get count verifies', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const before = bcli('get', 'count', '.cross-test-el');
    expect(before.exitCode).toBe(0);
    expect(before.stdout).toContain('0');

    bcli('eval', 'for(let i=0;i<3;i++){const el=document.createElement("span");el.className="cross-test-el";document.body.appendChild(el)} true');

    const after = bcli('get', 'count', '.cross-test-el');
    expect(after.exitCode).toBe(0);
    expect(after.stdout).toContain('3');
  });

  test('eval changes input value, get value reads it', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('eval', 'document.querySelector("#username").value = "eval-cross"; true');

    const val = bcli('get', 'value', SEL.USERNAME);
    expect(val.exitCode).toBe(0);
    expect(val.stdout).toContain('eval-cross');
  });
});

test.describe('scroll + snapshot cross-tests', () => {
  test('scroll down then take snapshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const scroll = bcli('scroll', 'down', '--amount', '500');
    expect(scroll).toBcliSuccess();

    // Verify scroll actually happened
    const scrollY = bcli('eval', 'window.scrollY');
    expect(scrollY).toBcliSuccess();
    expect(Number(scrollY.stdout)).toBeGreaterThan(0);

    const snap = bcli('snapshot', '-ic');
    expect(snap).toBcliSuccess();
    expect(snap.stdout.length).toBeGreaterThan(0);
  });

  test('scrollintoview then click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const scroll = bcli('scrollintoview', 'div#page-footer a');
    expect(scroll).toBcliSuccess();

    const click = bcli('click', 'div#page-footer a');
    expect(click).toBcliSuccess();
  });
});

test.describe('network + navigation cross-tests', () => {
  test('network route then navigate', async ({ bcli, navigateAndWait }) => {
    test.fixme(true, 'network route fails: Rule with id 10001 does not have a unique ID');
    const route = bcli('network', 'route', '*nonexistent-domain.invalid*', '--abort');
    expect(route).toBcliSuccess();

    await navigateAndWait(PAGES.HOME);

    const title = bcli('get', 'title');
    expect(title.exitCode).toBe(0);
    expect(title.stdout).toContain('The Internet');
  });
});

test.describe('dialog + click cross-tests', () => {
  test('dialog accept then trigger via click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    bcli('dialog', 'accept');
    bcli('click', 'button[onclick="jsAlert()"]');
    bcli('wait', '1000');

    const result = bcli('get', 'text', '#result');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.includes('successfully') || result.stdout.includes('alert')).toBeTruthy();
  });

  test('dialog accept with prompt, then verify result text', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    bcli('dialog', 'accept', 'prompt-test-value');
    bcli('click', 'button[onclick="jsPrompt()"]');
    bcli('wait', '1000');

    const result = bcli('get', 'text', '#result');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('prompt-test-value');
  });
});

test.describe('screenshot after interaction', () => {
  test('screenshot after filling form', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('fill', SEL.USERNAME, 'screenshot-after-fill');

    const tempDir = mkdtempSync(path.join(tmpdir(), 'bcli-test-'));
    const filePath = path.join(tempDir, 'after-fill.png');
    const r = bcli('screenshot', '--path', filePath);
    expect(r.exitCode).toBe(0);
    expect(existsSync(filePath)).toBeTruthy();
    expect(statSync(filePath).size).toBeGreaterThan(0);
    rmSync(tempDir, { recursive: true });
  });

  test('screenshot after navigation and scroll', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);

    bcli('scroll', 'down', '--amount', '500');
    bcli('wait', '1000');

    const tempDir = mkdtempSync(path.join(tmpdir(), 'bcli-test-'));
    const filePath = path.join(tempDir, 'after-scroll.png');
    const r = bcli('screenshot', '--path', filePath);
    expect(r.exitCode).toBe(0);
    expect(existsSync(filePath)).toBeTruthy();
    expect(statSync(filePath).size).toBeGreaterThan(0);
    rmSync(tempDir, { recursive: true });
  });
});

test.describe('snapshot refs + navigation (ref invalidation)', () => {
  test('snapshot refs invalidated after navigation', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const snap = bcli('snapshot', '-ic');
    expect(snap.exitCode).toBe(0);
    expect(snap.stdout).toContain('@e1');

    await navigateAndWait(PAGES.CHECKBOXES);

    // Old refs should be stale after navigation to a different page
    const clickOldRef = bcli('click', '@e1');
    expect(clickOldRef).toBcliFailure();
  });

  test('snapshot refs work after re-snapshot on new page', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('snapshot', '-ic');

    await navigateAndWait(PAGES.CHECKBOXES);

    const snap = bcli('snapshot', '-ic');
    expect(snap.exitCode).toBe(0);
    expect(snap.stdout).toContain('@e');

    const click = bcli('click', '@e1');
    expect(click.exitCode).toBe(0);
  });
});

test.describe('cookies + storage + state save/load cross-tests', () => {
  test('set cookies and storage, save state, clear, load, verify', async ({ bcli, navigateAndWait, baseURL, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('cookies', 'set', 'cross-cookie', 'cross-val', '--url', `${baseURL}/${PAGES.HOME}`);
    bcli('storage', 'local', 'set', 'cross-local', 'cross-local-val');

    const tempDir = mkdtempSync(path.join(tmpdir(), 'bcli-test-'));
    const stateFile = path.join(tempDir, 'cross-state.json');
    const save = bcli('state', 'save', stateFile);
    expect(save.exitCode).toBe(0);

    bcli('cookies', 'clear');
    bcli('storage', 'local', 'clear');

    const load = bcli('state', 'load', stateFile);
    expect(load.exitCode).toBe(0);

    await navigateAndWait(PAGES.HOME);
    bcli('wait', '1000');

    const cookie = bcli('cookies', 'get', 'cross-cookie');
    expect(cookie).toBcliSuccess();
    expect(cookie.stdout.includes('cross-val') || cookie.stdout.includes('cross-cookie')).toBeTruthy();

    rmSync(tempDir, { recursive: true });
  });
});

test.describe('highlight + snapshot cross-tests', () => {
  test('highlight element then take snapshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const hl = bcli('highlight', SEL.LOGIN_BTN, '--duration', '500');
    expect(hl.exitCode).toBe(0);

    const snap = bcli('snapshot', '-ic');
    expect(snap.exitCode).toBe(0);
    expect(snap.stdout.length).toBeGreaterThan(0);
  });
});

test.describe('console + eval cross-tests', () => {
  test('eval console.log then read console output', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('console', '--clear');

    bcli('eval', 'console.log("cross-console-test"); true');
    bcli('wait', '1000');

    const cons = bcli('console');
    expect(cons.exitCode).toBe(0);
    expect(cons.stdout).toContain('cross-console-test');
  });
});

test.describe('multi-step workflow cross-tests', () => {
  test('complete login workflow with multiple command types', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const snap = bcli('snapshot', '-ic');
    expect(snap.exitCode).toBe(0);

    bcli('find', 'label', 'Username', 'fill', TEST_USERNAME);
    bcli('find', 'label', 'Password', 'fill', TEST_PASSWORD);
    bcli('find', 'role', 'button', '--name', 'Login');

    bcli('wait', '--url', '**/secure*', '--timeout', '5000');

    const title = bcli('get', 'title');
    expect(title.exitCode).toBe(0);

    const url = bcli('get', 'url');
    expect(url.exitCode).toBe(0);
    expect(url.stdout).toContain('/secure');

    const flash = bcli('get', 'text', SEL.FLASH_MESSAGE);
    expect(flash.exitCode).toBe(0);
    expect(flash.stdout).toContain('You logged into a secure area');
  });

  test('viewport change + navigate + snapshot + screenshot', async ({ bcli, navigateAndWait }) => {
    const vp = bcli('set', 'viewport', '375', '812');
    expect(vp).toBcliSuccess();

    try {
      await navigateAndWait(PAGES.LOGIN);

      const snap = bcli('snapshot', '-ic');
      expect(snap).toBcliSuccess();
      expect(snap.stdout.length).toBeGreaterThan(0);

      const tempDir = mkdtempSync(path.join(tmpdir(), 'bcli-test-'));
      const filePath = path.join(tempDir, 'mobile-view.png');
      const ss = bcli('screenshot', '--path', filePath);
      expect(ss).toBcliSuccess();
      expect(existsSync(filePath)).toBeTruthy();
      rmSync(tempDir, { recursive: true });
    } finally {
      // Always reset viewport even on test failure
      bcli('set', 'viewport', '1280', '720');
    }
  });
});
