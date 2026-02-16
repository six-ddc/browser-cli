import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME } from '../helpers/constants';

// ===========================================================================
// get url
// ===========================================================================

test.describe('get url', () => {
  test('returns current page URL', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'url');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('/login');
  });

  test('updates after navigation', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('get', 'url');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('/checkboxes');
  });
});

// ===========================================================================
// get title
// ===========================================================================

test.describe('get title', () => {
  test('returns page title', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'title');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('The Internet');
  });
});

// ===========================================================================
// get text
// ===========================================================================

test.describe('get text', () => {
  test('returns element text content', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'text', 'h2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Login Page');
  });

  test('returns nested text content', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('get', 'text', 'h1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Welcome');
  });

  test('fails for nonexistent selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'text', '.nonexistent-element');
    expect(r).toBcliFailure();
  });
});

// ===========================================================================
// get html
// ===========================================================================

test.describe('get html', () => {
  test('returns innerHTML of element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'html', '#login button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Login');
  });

  test('--outer returns outerHTML including element tag', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'html', '#login button', '--outer');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('<button');
    expect(r.stdout).toContain('Login');
  });

  test('returns form innerHTML with nested elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'html', '#login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('input');
  });
});

// ===========================================================================
// get value
// ===========================================================================

test.describe('get value', () => {
  test('returns empty string for unfilled input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'value', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('');
  });

  test('returns value after fill', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, TEST_USERNAME);
    await activePage.waitForTimeout(500);

    const r = bcli('get', 'value', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe(TEST_USERNAME);
  });

  test('returns value after clearing and re-filling', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'first');
    await activePage.waitForTimeout(500);
    bcli('clear', SEL.USERNAME);
    await activePage.waitForTimeout(500);
    bcli('fill', SEL.USERNAME, 'second');
    await activePage.waitForTimeout(500);

    const r = bcli('get', 'value', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('second');
  });
});

// ===========================================================================
// get attr
// ===========================================================================

test.describe('get attr', () => {
  test('returns attribute value', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'attr', SEL.USERNAME, 'name');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('username');
  });

  test('returns type attribute of button', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'attr', SEL.LOGIN_BTN, 'type');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('submit');
  });

  test('returns id attribute', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'attr', SEL.USERNAME, 'id');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('username');
  });

  test('returns null for nonexistent attribute', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'attr', SEL.USERNAME, 'data-nonexistent');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('null');
  });
});

// ===========================================================================
// get count
// ===========================================================================

test.describe('get count', () => {
  test('counts matching elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('get', 'count', SEL.CHECKBOX);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('2');
  });

  test('returns 0 for no matches', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'count', '.nonexistent-class');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('0');
  });

  test('counts list items on homepage', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('get', 'count', 'ul li a');
    expect(r).toBcliSuccess();
    const count = parseInt(r.stdout, 10);
    expect(count).not.toBeNaN();
    expect(count).toBeGreaterThan(0);
  });
});

// ===========================================================================
// get box
// ===========================================================================

test.describe('get box', () => {
  test('returns bounding box dimensions', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'box', '#login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toMatch(/x=\d+ y=\d+ w=\d+ h=\d+/);
  });

  test('returns non-zero dimensions for visible element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'box', 'h2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toMatch(/x=\d+ y=\d+ w=\d+ h=\d+/);
    // Width and height should be positive
    expect(r.stdout).not.toContain('w=0 ');
    expect(r.stdout).not.toContain('h=0');
  });

  test('fails for nonexistent element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'box', '.nonexistent-element');
    expect(r).toBcliFailure();
  });
});
