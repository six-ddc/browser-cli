import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

// ===========================================================================
// is visible
// ===========================================================================

test.describe('is visible', () => {
  test('returns true for visible element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'visible', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('returns true for heading', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'visible', 'h2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('returns false for hidden element', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);
    // Click Remove to hide the checkbox
    bcli('click', '#checkbox-example button');
    await activePage.waitForTimeout(2000);

    // After removal, the checkbox INPUT is removed from the DOM
    // Querying the removed input should fail (element not found) or return false
    const r = bcli('is', 'visible', '#checkbox-example input[type="checkbox"]');
    // Either returns false or fails (element not found) -- both acceptable for removed element
    if (r.exitCode === 0) {
      expect(r.stdout).toBe('false');
    } else {
      // Element not found error is also acceptable
      expect(r.exitCode).not.toBe(0);
    }
  });

  test('fails or returns false for nonexistent element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'visible', '.nonexistent-element');
    // Either the command fails (element not found) or returns false -- both acceptable
    if (r.exitCode === 0) {
      expect(r.stdout).toBe('false');
    } else {
      expect(r.exitCode).not.toBe(0);
    }
  });
});

// ===========================================================================
// is enabled
// ===========================================================================

test.describe('is enabled', () => {
  test('returns true for enabled input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'enabled', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('returns false for disabled input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);

    const r = bcli('is', 'enabled', '#input-example input');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('false');
  });

  test('returns true after enabling a disabled input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);

    // Verify input starts disabled
    const r1 = bcli('is', 'enabled', '#input-example input');
    expect(r1).toBcliSuccess();
    expect(r1.stdout).toBe('false');

    // Click Enable button
    bcli('click', '#input-example button');
    await activePage.waitForTimeout(3000);

    // Now the input should be enabled
    const r2 = bcli('is', 'enabled', '#input-example input');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toBe('true');
  });

  test('returns true for buttons', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'enabled', SEL.LOGIN_BTN);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });
});

// ===========================================================================
// is checked
// ===========================================================================

test.describe('is checked', () => {
  test('returns false for unchecked checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // First checkbox is unchecked by default
    const r = bcli('is', 'checked', `${SEL.CHECKBOX}:first-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('false');
  });

  test('returns true for pre-checked checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Second checkbox is checked by default
    const r = bcli('is', 'checked', `${SEL.CHECKBOX}:last-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('reflects state after check command', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    bcli('check', `${SEL.CHECKBOX}:first-of-type`);
    await activePage.waitForTimeout(500);

    const r = bcli('is', 'checked', `${SEL.CHECKBOX}:first-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('reflects state after uncheck command', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Second checkbox is checked by default -- uncheck it
    bcli('uncheck', `${SEL.CHECKBOX}:last-of-type`);
    await activePage.waitForTimeout(500);

    const r = bcli('is', 'checked', `${SEL.CHECKBOX}:last-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('false');
  });

  test('fails for non-checkbox element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'checked', SEL.USERNAME);
    // Checking a non-checkbox should either fail or return false
    if (r.exitCode === 0) {
      expect(r.stdout).toBe('false');
    }
  });
});
