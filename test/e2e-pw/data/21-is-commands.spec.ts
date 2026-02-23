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

  test('returns false for hidden element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);
    // Click Remove to hide the checkbox
    bcli('click', '#checkbox-example button');
    // Wait for the removal animation to complete
    bcli('wait', '2000');

    // After removal: either returns false or fails (element not found)
    const r = bcli('is', 'visible', '#checkbox-example input[type="checkbox"]');
    if (r.success) {
      expect(r.stdout).toBe('false');
    } else {
      expect(r).toBcliFailure();
    }
  });

  test('fails for nonexistent element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'visible', '.nonexistent-element');
    // Nonexistent element: either returns false or fails (element not found)
    if (r.success) {
      expect(r.stdout).toBe('false');
    } else {
      expect(r).toBcliFailure();
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

  test('returns true after enabling a disabled input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);

    // Verify input starts disabled
    const r1 = bcli('is', 'enabled', '#input-example input');
    expect(r1).toBcliSuccess();
    expect(r1.stdout).toBe('false');

    // Click Enable button and wait for the enable animation to complete
    bcli('click', '#input-example button');
    bcli('wait', '3000');

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

  test('reflects state after check command', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    bcli('check', `${SEL.CHECKBOX}:first-of-type`);

    const r = bcli('is', 'checked', `${SEL.CHECKBOX}:first-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('reflects state after uncheck command', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Second checkbox is checked by default -- uncheck it
    bcli('uncheck', `${SEL.CHECKBOX}:last-of-type`);

    const r = bcli('is', 'checked', `${SEL.CHECKBOX}:last-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('false');
  });

  test('fails for non-checkbox element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'checked', SEL.USERNAME);
    // Checking a non-checkbox element should return false (it has no checked state)
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('false');
  });
});
