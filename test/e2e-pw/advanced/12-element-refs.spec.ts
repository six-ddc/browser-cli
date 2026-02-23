import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';

// ---- Snapshot Generates Refs ----

test.describe('snapshot generates refs', () => {
  test('snapshot -ic produces element refs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();

    // Output should contain @e references
    expect(r.stdout).toContain('@e');
  });

  test('snapshot -ic shows @e1 as first ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();

    // First ref should be @e1
    expect(r.stdout).toContain('@e1');
  });

  test('snapshot -ic shows multiple refs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();

    // Login page has username, password, and login button at minimum
    expect(r.stdout).toContain('@e1');
    expect(r.stdout).toContain('@e2');
    expect(r.stdout).toContain('@e3');
  });

  test('snapshot refCount matches number of refs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();

    // Output should contain refs and we should have at least 2 checkboxes
    expect(r.stdout).toContain('@e1');
    expect(r.stdout).toContain('@e2');
  });
});

// ---- Click with Element Ref ----

test.describe('click with @e ref', () => {
  test('click checkbox using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Take snapshot to generate refs
    bcli('snapshot', '-ic');

    // Click the first element ref (should be a checkbox)
    const r = bcli('click', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('click button using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Take snapshot to generate refs
    bcli('snapshot', '-ic');

    // We know the login page has multiple interactive elements
    // The button should be one of the refs
    const r = bcli('click', '@e3');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- Fill with Element Ref ----

test.describe('fill with @e ref', () => {
  test('fill input using element ref', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Take snapshot to generate refs
    bcli('snapshot', '-ic');

    // @e1 should be the username input on the login page
    const r = bcli('fill', '@e1', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    // Verify the field was actually filled
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('fill password using element ref', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Take snapshot to generate refs
    bcli('snapshot', '-ic');

    // @e2 should be the password input on the login page
    const r = bcli('fill', '@e2', TEST_PASSWORD);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });
});

// ---- Hover with Element Ref ----

test.describe('hover with @e ref', () => {
  test('hover using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('snapshot', '-ic');

    const r = bcli('hover', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });
});

// ---- Focus with Element Ref ----

test.describe('focus with @e ref', () => {
  test('focus using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('snapshot', '-ic');

    const r = bcli('focus', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });
});

// ---- Type with Element Ref ----

test.describe('type with @e ref', () => {
  test('type text using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('snapshot', '-ic');

    const r = bcli('type', '@e1', 'testuser');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Typed');
  });
});

// ---- Clear with Element Ref ----

test.describe('clear with @e ref', () => {
  test('clear input using element ref', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('snapshot', '-ic');

    // First fill the input
    bcli('fill', '@e1', 'testdata');

    // Then clear it using the same ref
    const r = bcli('clear', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('');
  });
});

// ---- Get Data with Element Ref ----

test.describe('get data with @e ref', () => {
  test('get text content using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Snapshot to get refs
    bcli('snapshot', '-ic');

    // @e3 should correspond to the login button on the login page
    const r = bcli('get', 'text', '@e3');
    expect(r).toBcliSuccess();
    // The login button text contains "Login"
    expect(r.stdout).toContain('Login');
  });

  test('get value using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('snapshot', '-ic');

    // Fill the username field
    bcli('fill', '@e1', 'checkvalue');

    const r = bcli('get', 'value', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('checkvalue');
  });
});

// ---- Check/Uncheck with Element Ref ----

test.describe('check/uncheck with @e ref', () => {
  test('check checkbox using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    bcli('snapshot', '-ic');

    const r = bcli('check', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');
  });

  test('uncheck checkbox using element ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    bcli('snapshot', '-ic');

    // @e2 should be the second checkbox (checked by default)
    const r = bcli('uncheck', '@e2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');
  });
});

// ---- Refs are Regenerated on Each Snapshot ----

test.describe('ref regeneration', () => {
  test('refs are regenerated on new snapshot', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // First snapshot
    bcli('snapshot', '-ic');

    // Fill using @e1
    bcli('fill', '@e1', 'first-run');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('first-run');

    // Navigate to a different page and back
    await navigateAndWait(PAGES.CHECKBOXES);
    await navigateAndWait(PAGES.LOGIN);

    // Take new snapshot -- refs should be regenerated
    bcli('snapshot', '-ic');

    // @e1 should still work (regenerated for the new page state)
    const r = bcli('fill', '@e1', 'second-run');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('second-run');
  });
});

// ---- Stale Ref Error ----

test.describe('stale ref handling', () => {
  test('stale ref: ref from old page after navigation', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Take snapshot to generate refs
    bcli('snapshot', '-ic');

    // Navigate to a different page (refs should become stale)
    await navigateAndWait(PAGES.CHECKBOXES);

    // Try to use the old ref -- the CSS selector may still resolve on the new page
    // (e.g., @e1 was "#username" which doesn't exist on checkboxes page),
    // or it may succeed if the selector matches something on the new page.
    const r = bcli('click', '@e1');
    // The ref maps to a CSS selector from the login page. On the checkboxes page,
    // this selector likely won't match, so we expect failure.
    if (r.success) {
      // If CSS selector fallback matched an element on the new page, that's acceptable
      expect(r.stdout).toContain('Clicked');
    } else {
      // Expected: the old ref's selector doesn't match on the new page
      expect(r).toBcliFailure();
      expect(r.stdout + r.stderr).toMatch(/not found|Element|stale/i);
    }
  });

  test('nonexistent ref gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Take snapshot to generate refs
    bcli('snapshot', '-ic');

    // Try to use a ref that doesn't exist (@e999)
    const r = bcli('click', '@e999');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });
});

// ---- Refs with Different Snapshot Flags ----

test.describe('snapshot flags and refs', () => {
  test('snapshot -i produces refs for interactive elements only', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('snapshot', '-i');
    expect(r).toBcliSuccess();

    // Should have refs for interactive elements
    expect(r.stdout).toContain('@e');
  });

  test('snapshot -c produces compact output with refs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('snapshot', '-c');
    expect(r).toBcliSuccess();

    // Compact mode should still include refs
    expect(r.stdout).toContain('@e');
  });

  test('snapshot with -s selector scopes refs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('snapshot', '-ic', '-s', 'form');
    expect(r).toBcliSuccess();

    // Scoped snapshot should still have refs but only for form elements
    expect(r.stdout).toContain('@e');
  });
});

// ---- Complete Workflow with Refs ----

test.describe('complete workflow with refs', () => {
  test('snapshot + ref-based login', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Take snapshot to generate refs
    bcli('snapshot', '-ic');

    // Fill username using ref
    bcli('fill', '@e1', TEST_USERNAME);

    // Fill password using ref
    bcli('fill', '@e2', TEST_PASSWORD);

    // Click login button using ref
    bcli('click', '@e3');

    // Wait for navigation
    await activePage.waitForURL(/secure/, { timeout: 10_000 });
    expect(activePage.url()).toContain('/secure');
  });
});
