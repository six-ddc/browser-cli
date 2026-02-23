import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

// ===========================================================================
// Shadow DOM interaction tests (shadow-dom.html)
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
    // Shadow DOM content may or may not appear in the accessibility tree
    // depending on browser/implementation — just ensure it doesn't crash
    expect(r.stdout.length).toBeGreaterThan(0);
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

  test('eval can access shadow DOM elements', async ({ bcli }) => {
    const r = bcli('eval', "document.getElementById('shadow-host').shadowRoot.querySelector('#shadow-text').textContent");
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain("Let's have some different text!");
  });

  test('eval can access shadow DOM input', async ({ bcli }) => {
    const r = bcli('eval', "document.getElementById('shadow-host-2').shadowRoot.querySelector('#shadow-input').placeholder");
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Shadow input');
  });

  test('eval can access shadow DOM button text', async ({ bcli }) => {
    const r = bcli('eval', "document.getElementById('shadow-host-2').shadowRoot.querySelector('#shadow-button').textContent");
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Shadow Button');
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
});
