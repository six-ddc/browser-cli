import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

test.describe('cookies set', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('cookies', 'clear');
  });

  test('sets a basic cookie', async ({ bcli, baseURL }) => {
    const r = bcli('cookies', 'set', 'testcookie', 'testvalue', '--url', `${baseURL}/${PAGES.HOME}`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cookie set');
  });

  test('sets cookie with domain', async ({ bcli, baseURL }) => {
    const r = bcli('cookies', 'set', 'domcookie', 'domvalue', '--url', `${baseURL}/${PAGES.HOME}`, '--domain', 'localhost');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cookie set');
  });

  test('sets cookie with path', async ({ bcli, baseURL }) => {
    const r = bcli('cookies', 'set', 'pathcookie', 'pathvalue', '--url', `${baseURL}/${PAGES.LOGIN}`, '--path', '/login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cookie set');
  });

  test('sets cookie with secure flag', async ({ bcli, baseURL }) => {
    const r = bcli('cookies', 'set', 'securecookie', 'securevalue', '--url', `${baseURL}/${PAGES.HOME}`, '--secure');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cookie set');
  });

  test('sets cookie with httponly flag', async ({ bcli, baseURL }) => {
    const r = bcli('cookies', 'set', 'httponlycookie', 'httponlyvalue', '--url', `${baseURL}/${PAGES.HOME}`, '--httponly');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cookie set');
  });

  test('sets cookie with samesite', async ({ bcli, baseURL }) => {
    const r = bcli('cookies', 'set', 'samecookie', 'samevalue', '--url', `${baseURL}/${PAGES.HOME}`, '--samesite', 'lax');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cookie set');
  });
});

test.describe('cookies get', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('cookies', 'clear');
  });

  test('retrieves set cookie by name', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'mycookie', 'myvalue', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'get', 'mycookie');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('mycookie=myvalue');
  });

  test('shows all cookies when no name given', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'cookie1', 'value1', '--url', `${baseURL}/${PAGES.HOME}`);
    bcli('cookies', 'set', 'cookie2', 'value2', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'get');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('cookie1=value1');
    expect(r.stdout).toContain('cookie2=value2');
  });

  test('filters by --url', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'urlcookie', 'urlvalue', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'get', '--url', `${baseURL}/${PAGES.HOME}`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('urlcookie=urlvalue');
  });

  test('filters by --domain', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'domtest', 'domval', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'get', '--domain', 'localhost');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('domtest=domval');
  });

  test('returns empty when no cookies match name', async ({ bcli }) => {
    const r = bcli('cookies', 'get', 'nonexistent-cookie-name');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('(no cookies)');
  });
});

test.describe('cookies (list all)', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('cookies', 'clear');
  });

  test('lists all cookies (bare command)', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'listtest', 'listvalue', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('listtest=listvalue');
    expect(r.stdout).toContain('Domain:');
  });

  test('shows (no cookies) when empty', async ({ bcli }) => {
    const r = bcli('cookies');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('(no cookies)');
  });

  test('displays cookie flags', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'flagtest', 'flagvalue', '--url', `${baseURL}/${PAGES.HOME}`, '--httponly');
    await activePage.waitForTimeout(500);

    const r = bcli('cookies');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('flagtest=flagvalue');
    expect(r.stdout).toContain('HttpOnly');
  });
});

test.describe('cookies clear', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('cookies', 'clear');
  });

  test('clears all cookies', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'clearthis', 'clearval', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'clear');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');

    // Verify cookies are gone
    const r2 = bcli('cookies', 'get');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('(no cookies)');
  });

  test('clears cookies for specific URL', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'urlclear', 'urlval', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'clear', '--url', `${baseURL}/${PAGES.HOME}`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');
  });

  test('clears cookies for specific domain', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'domclear', 'domval', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'clear', '--domain', 'localhost');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');

    // Verify cookies are gone
    const r2 = bcli('cookies', 'get');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('(no cookies)');
  });
});

test.describe('cookies round-trip', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('cookies', 'clear');
  });

  test('set then get round-trip preserves value', async ({ bcli, baseURL, activePage }) => {
    const cookieName = 'roundtrip';
    const cookieValue = 'testvalue123';

    bcli('cookies', 'set', cookieName, cookieValue, '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'get', cookieName);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain(`${cookieName}=${cookieValue}`);
  });

  test('set multiple, clear all, verify empty', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'first', 'firstval', '--url', `${baseURL}/${PAGES.HOME}`);
    bcli('cookies', 'set', 'second', 'secondval', '--url', `${baseURL}/${PAGES.HOME}`);
    bcli('cookies', 'set', 'third', 'thirdval', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    // Verify all set
    const r1 = bcli('cookies', 'get');
    expect(r1).toBcliSuccess();
    expect(r1.stdout).toContain('first=firstval');
    expect(r1.stdout).toContain('second=secondval');
    expect(r1.stdout).toContain('third=thirdval');

    // Clear all
    bcli('cookies', 'clear');
    await activePage.waitForTimeout(500);

    // Verify all gone
    const r2 = bcli('cookies', 'get');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('(no cookies)');
  });

  test('overwrite existing cookie value', async ({ bcli, baseURL, activePage }) => {
    bcli('cookies', 'set', 'overwrite', 'original', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    // Overwrite with new value
    bcli('cookies', 'set', 'overwrite', 'updated', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(500);

    const r = bcli('cookies', 'get', 'overwrite');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('overwrite=updated');
    expect(r.stdout).not.toContain('overwrite=original');
  });
});
