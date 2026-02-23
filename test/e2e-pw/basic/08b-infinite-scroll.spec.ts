import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

// ===========================================================================
// Infinite Scroll tests (infinite-scroll.html)
// ===========================================================================

test.describe('infinite scroll', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.INFINITE_SCROLL);
  });

  test('initial page has scroll items', async ({ bcli }) => {
    const r = bcli('get', 'count', '.scroll-item');
    expect(r).toBcliSuccess();
    const count = parseInt(r.stdout, 10);
    expect(count).toBe(5);
  });

  test('eval addContent directly adds items', async ({ bcli }) => {
    const beforeR = bcli('get', 'count', '.scroll-item');
    expect(beforeR).toBcliSuccess();
    const before = parseInt(beforeR.stdout, 10);

    // Directly call the page's addContent function
    bcli('eval', 'addContent()');

    const afterR = bcli('get', 'count', '.scroll-item');
    expect(afterR).toBcliSuccess();
    const after = parseInt(afterR.stdout, 10);

    expect(after).toBe(before + 5);
  });

  test('multiple addContent calls accumulate items', async ({ bcli }) => {
    const beforeR = bcli('get', 'count', '.scroll-item');
    expect(beforeR).toBcliSuccess();
    const before = parseInt(beforeR.stdout, 10);

    bcli('eval', 'addContent(); addContent()');

    const afterR = bcli('get', 'count', '.scroll-item');
    expect(afterR).toBcliSuccess();
    const after = parseInt(afterR.stdout, 10);

    expect(after).toBe(before + 10);
  });

  test('snapshot works on infinite scroll page', async ({ bcli }) => {
    const r = bcli('snapshot', '-c');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('get text on a scroll item', async ({ bcli }) => {
    const r = bcli('get', 'text', '.scroll-item:first-child');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Scroll item');
    expect(r.stdout).toContain('Lorem ipsum');
  });
});
