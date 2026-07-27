import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

// ===========================================================================
// Shadow DOM interaction tests (shadow-dom.html)
//
// The page has two open shadow roots:
//   #shadow-host   → #shadow-text
//   #shadow-host-2 → #shadow-text-2, #shadow-input, #shadow-button
// Selectors pierce shadow boundaries, so they are addressed directly.
// ===========================================================================

test.describe('shadow DOM', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.SHADOW_DOM);
  });

  test('get text on shadow host element', async ({ bcli }) => {
    // The shadow host itself may have textContent from the shadow root
    // or we can get text from the page heading
    const r = bcli('get', 'text', 'h3');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Shadow DOM');
  });

  test('snapshot runs without crash on shadow DOM page', async ({ bcli }) => {
    const r = bcli('snapshot', '-c');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('snapshot includes shadow DOM content', async ({ bcli }) => {
    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain("Let's have some different text!");
    expect(r.stdout).toContain('Shadow Button');
  });

  test('snapshot -i registers refs for shadow elements', async ({ bcli }) => {
    const r = bcli('snapshot', '-i');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Shadow Button');
    expect(r.stdout).toMatch(/@e\d+/);
  });

  test('get count for shadow host elements', async ({ bcli }) => {
    const r = bcli('get', 'count', '[id^="shadow-host"]');
    expect(r).toBcliSuccess();
    const count = parseInt(r.stdout, 10);
    expect(count).toBe(2);
  });

  test('click on shadow host element does not crash', async ({ bcli }) => {
    const r = bcli('click', '#shadow-host');
    // Clicking a shadow host should succeed without crashing
    expect(r).toBcliSuccess();
  });

  test('get text reads an element inside a shadow root', async ({ bcli }) => {
    const r = bcli('get', 'text', '#shadow-text');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain("Let's have some different text!");
  });

  test('get attr reads an attribute inside a shadow root', async ({ bcli }) => {
    const r = bcli('get', 'attr', '#shadow-input', 'placeholder');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Shadow input');
  });

  test('get text reads a button inside a shadow root', async ({ bcli }) => {
    const r = bcli('get', 'text', '#shadow-button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Shadow Button');
  });

  test('get count counts elements across shadow roots', async ({ bcli }) => {
    const r = bcli('get', 'count', 'span[id^="shadow-text"]');
    expect(r).toBcliSuccess();
    expect(parseInt(r.stdout, 10)).toBe(2);
  });

  test('piercing path selector resolves through the host', async ({ bcli }) => {
    const r = bcli('get', 'text', '#shadow-host >>> #shadow-text');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain("Let's have some different text!");
  });

  test('fill an input inside a shadow root', async ({ bcli, activePage }) => {
    const r = bcli('fill', '#shadow-input', 'typed into shadow');
    expect(r).toBcliSuccess();

    await expect(activePage.locator('#shadow-input')).toHaveValue('typed into shadow');
    const value = bcli('get', 'value', '#shadow-input');
    expect(value.stdout).toContain('typed into shadow');
  });

  test('click a button inside a shadow root', async ({ bcli }) => {
    const r = bcli('click', '#shadow-button');
    expect(r).toBcliSuccess();
  });

  test('role= locator finds a button inside a shadow root', async ({ bcli }) => {
    const r = bcli('click', 'role=button[name="Shadow Button"]');
    expect(r).toBcliSuccess();
  });

  test('text= locator finds text inside a shadow root', async ({ bcli }) => {
    const r = bcli('get', 'count', 'text="Shadow Button"');
    expect(r).toBcliSuccess();
    expect(parseInt(r.stdout, 10)).toBe(1);
  });

  test('placeholder= locator finds an input inside a shadow root', async ({ bcli, activePage }) => {
    const r = bcli('fill', 'placeholder=Shadow input', 'via placeholder');
    expect(r).toBcliSuccess();
    await expect(activePage.locator('#shadow-input')).toHaveValue('via placeholder');
  });

  test('find acts on an element inside a shadow root', async ({ bcli, activePage }) => {
    const r = bcli('find', '#shadow-input', 'fill', 'via find');
    expect(r).toBcliSuccess();
    await expect(activePage.locator('#shadow-input')).toHaveValue('via find');
  });

  test('wait resolves for a selector inside a shadow root', async ({ bcli }) => {
    const r = bcli('wait', '#shadow-button');
    expect(r).toBcliSuccess();
  });

  test('get text on page heading still works alongside shadow DOM', async ({ bcli }) => {
    const r = bcli('get', 'text', 'body h3');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Shadow DOM');
  });

  test('is visible for shadow host elements', async ({ bcli }) => {
    const r = bcli('is', 'visible', '#shadow-host');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('is visible for an element inside a shadow root', async ({ bcli }) => {
    const r = bcli('is', 'visible', '#shadow-button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });
});
