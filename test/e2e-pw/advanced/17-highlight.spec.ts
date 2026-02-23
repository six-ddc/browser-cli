import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('highlight (default)', () => {
  test('highlights element by CSS selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', SEL.LOGIN_BTN);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });

  test('highlights input element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });

  test('highlights heading element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', 'h2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });
});

test.describe('highlight --color', () => {
  test('uses custom hex color', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', SEL.LOGIN_BTN, '--color', '#FF0000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });

  test('accepts named color', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', SEL.USERNAME, '--color', 'red');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });
});

test.describe('highlight --duration', () => {
  test('highlights for custom duration', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', SEL.LOGIN_BTN, '--duration', '500');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });

  test('short duration completes quickly', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const start = Date.now();
    const r = bcli('highlight', SEL.USERNAME, '--duration', '100');
    const elapsed = Date.now() - start;
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
    // Short duration should complete well under 5 seconds
    expect(elapsed).toBeLessThan(5000);
  });
});

test.describe('highlight combined options', () => {
  test('custom color and duration together', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', SEL.LOGIN_BTN, '--color', '#00FF00', '--duration', '300');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });
});

test.describe('highlight error handling', () => {
  test('fails for nonexistent element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', '.nonexistent-element-12345');
    expect(r).toBcliFailure();
  });
});

test.describe('highlight with semantic locators', () => {
  test('works with role= locator', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', 'role=button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });

  test('works with text= locator', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('highlight', 'text=Login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Highlighted');
  });
});

test.describe('highlight integration: multiple highlights', () => {
  test('highlights multiple elements sequentially', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r1 = bcli('highlight', SEL.USERNAME, '--duration', '100');
    expect(r1).toBcliSuccess();
    expect(r1.stdout).toContain('Highlighted');

    const r2 = bcli('highlight', SEL.PASSWORD, '--duration', '100');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('Highlighted');

    const r3 = bcli('highlight', SEL.LOGIN_BTN, '--duration', '100');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('Highlighted');
  });
});
