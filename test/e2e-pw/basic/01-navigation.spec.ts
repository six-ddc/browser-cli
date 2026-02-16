import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('navigate command', () => {
  test('loads a page and returns title + URL', async ({ bcli, baseURL }) => {
    const r = bcli('navigate', `${baseURL}/${PAGES.HOME}`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('localhost');
  });

  test('URL is correct after navigation', async ({ navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    expect(activePage.url()).toContain('/login');
  });

  test('alias goto works', async ({ bcli, activePage, baseURL }) => {
    const r = bcli('goto', `${baseURL}/${PAGES.CHECKBOXES}`);
    expect(r).toBcliSuccess();
    await activePage.waitForURL(/checkboxes/);
    expect(activePage.url()).toContain('/checkboxes');
  });

  test('alias open works', async ({ bcli, activePage, baseURL }) => {
    const r = bcli('open', `${baseURL}/${PAGES.DROPDOWN}`);
    expect(r).toBcliSuccess();
    await activePage.waitForURL(/dropdown/);
    expect(activePage.url()).toContain('/dropdown');
  });
});

test.describe('get url / get title', () => {
  test('get url returns current page URL', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('get', 'url');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('/login');
  });

  test('get title returns current page title', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('get', 'title');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('The Internet');
  });
});

test.describe('back / forward', () => {
  test('navigates back in history', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    await navigateAndWait(PAGES.CHECKBOXES);
    expect(activePage.url()).toContain('/checkboxes');

    const r = bcli('back');
    expect(r).toBcliSuccess();
    await activePage.waitForURL(/login/);
    expect(activePage.url()).toContain('/login');
  });

  test('navigates forward in history', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    await navigateAndWait(PAGES.CHECKBOXES);

    bcli('back');
    await activePage.waitForURL(/login/);
    expect(activePage.url()).toContain('/login');

    const r = bcli('forward');
    expect(r).toBcliSuccess();
    await activePage.waitForURL(/checkboxes/);
    expect(activePage.url()).toContain('/checkboxes');
  });

  test('back + forward round-trip preserves URL', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    await navigateAndWait(PAGES.DROPDOWN);

    bcli('back');
    await activePage.waitForURL(/login/);
    bcli('forward');
    await activePage.waitForURL(/dropdown/);
    expect(activePage.url()).toContain('/dropdown');
  });
});

test.describe('reload', () => {
  test('reloads the current page', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('reload');
    expect(r).toBcliSuccess();
    await activePage.waitForLoadState('domcontentloaded');
    expect(activePage.url()).toContain('/login');
  });

  test('returns title and URL', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('reload');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('localhost');
  });
});

test.describe('navigation to different page types', () => {
  test('handles pages with dynamic content', async ({ navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTENT);
    expect(activePage.url()).toContain('/dynamic-content');
  });

  test('handles pages with forms', async ({ navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    await expect(activePage.locator(SEL.USERNAME)).toBeVisible();
    await expect(activePage.locator(SEL.PASSWORD)).toBeVisible();
    await expect(activePage.locator(SEL.LOGIN_BTN)).toBeVisible();
  });
});
