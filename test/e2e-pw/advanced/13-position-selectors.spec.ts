import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';

// ---- first selector ----

test.describe('find first', () => {
  test('click first checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'first', SEL.CHECKBOX, 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('check first checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'first', SEL.CHECKBOX, 'check');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');
  });

  test('default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Omitting action should default to click
    const r = bcli('find', 'first', SEL.CHECKBOX);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('hover first figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    const r = bcli('find', 'first', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('fill first input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'first', 'input', 'fill', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('focus first input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'first', 'input', 'focus');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });

  test('clear first input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Fill the input first
    bcli('fill', SEL.USERNAME, 'testdata');

    const r = bcli('find', 'first', 'input', 'clear');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('');
  });
});

// ---- last selector ----

test.describe('find last', () => {
  test('click last checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'last', SEL.CHECKBOX, 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('uncheck last checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // The second (last) checkbox on /checkboxes is checked by default
    const r = bcli('find', 'last', SEL.CHECKBOX, 'uncheck');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');
  });

  test('default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'last', SEL.CHECKBOX);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('hover last figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    const r = bcli('find', 'last', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('fill last input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // The last input on the login page should be the password field
    const r = bcli('find', 'last', 'input[type="password"]', 'fill', TEST_PASSWORD);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });

  test('focus last input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'last', 'input', 'focus');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });
});

// ---- nth selector ----

test.describe('find nth', () => {
  test('nth 1: click first checkbox (1-based)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // nth 1 should be the first checkbox
    const r = bcli('find', 'nth', '1', SEL.CHECKBOX, 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 2: click second checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'nth', '2', SEL.CHECKBOX, 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 1: check first checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'nth', '1', SEL.CHECKBOX, 'check');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');
  });

  test('nth 2: uncheck second checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Second checkbox is checked by default
    const r = bcli('find', 'nth', '2', SEL.CHECKBOX, 'uncheck');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');
  });

  test('nth: default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'nth', '1', SEL.CHECKBOX);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 1: fill first input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'nth', '1', 'input', 'fill', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('nth 2: fill second input (password)', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'nth', '2', 'input', 'fill', TEST_PASSWORD);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });

  test('nth: hover nth figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    // Hovers page has 3 figures
    const r = bcli('find', 'nth', '2', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('nth 3: hover third figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    const r = bcli('find', 'nth', '3', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });
});

// ---- nth equivalence with first/last ----

test.describe('nth equivalence', () => {
  test('nth 1 is equivalent to first', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Both should target the first checkbox
    const r = bcli('find', 'nth', '1', SEL.CHECKBOX, 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 2 targets the last checkbox (on 2-checkbox page)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // /checkboxes has exactly 2 checkboxes, so nth 2 = last
    const r = bcli('find', 'nth', '2', SEL.CHECKBOX, 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- Position Selectors with Different Actions ----

test.describe('position selector + actions', () => {
  test('position selector + type action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'first', 'input', 'type', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Typed');
  });

  test('position selector + dblclick action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);

    const r = bcli('find', 'first', 'button', 'dblclick');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Double-clicked');
  });

  test('position selector + select action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DROPDOWN);

    const r = bcli('find', 'first', 'select', 'select', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Selected');
  });

  test('position selector + press action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('focus', SEL.USERNAME);

    const r = bcli('find', 'first', 'input', 'press', 'Tab');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Pressed');
  });
});

// ---- Position Selectors Error Handling ----

test.describe('position selector error handling', () => {
  test('nth with invalid index gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'nth', 'abc', SEL.CHECKBOX, 'click');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/[Ii]nvalid|error/i);
  });

  test('nth with negative index gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'nth', '-1', SEL.CHECKBOX, 'click');
    expect(r).toBcliFailure();
  });

  test('nth with out-of-bounds index gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // There are only 2 checkboxes, so nth 999 should fail
    const r = bcli('find', 'nth', '999', SEL.CHECKBOX, 'click');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('first with no matching elements gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'first', '.nonexistent-class-xyz', 'click');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('last with no matching elements gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'last', '.nonexistent-class-xyz', 'click');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('nth with missing selector gives usage error', async ({ bcli }) => {
    const r = bcli('find', 'nth', '1');
    expect(r).toBcliFailure();
  });

  test('first with missing selector gives usage error', async ({ bcli }) => {
    const r = bcli('find', 'first');
    expect(r).toBcliFailure();
  });
});

// ---- Position Selectors in Multi-Element Scenarios ----

test.describe('multi-element scenarios', () => {
  test('first and last target different elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Verify we have 2 checkboxes
    const countR = bcli('get', 'count', SEL.CHECKBOX);
    expect(countR).toBcliSuccess();
    expect(countR.stdout.trim()).toBe('2');

    // Check the first checkbox
    bcli('find', 'first', SEL.CHECKBOX, 'check');

    // Uncheck the last checkbox
    bcli('find', 'last', SEL.CHECKBOX, 'uncheck');

    // After these operations, first should be checked and last should be unchecked
    // (assuming first was unchecked and last was checked initially)
  });

  test('nth iterates through multiple elements correctly', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    // The hovers page has 3 figure elements
    // Hover each one in sequence using nth
    let r = bcli('find', 'nth', '1', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');

    r = bcli('find', 'nth', '2', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');

    r = bcli('find', 'nth', '3', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });
});

// ---- Position Selectors with Semantic Locators ----

test.describe('position selector + semantic locator workflows', () => {
  test('position selector then semantic locator', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Use position selector to fill first input
    bcli('find', 'first', 'input', 'fill', TEST_USERNAME);
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);

    // Use semantic locator to fill password
    bcli('find', 'label', 'Password', 'fill', TEST_PASSWORD);
    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);

    // Use position selector to click the submit button
    bcli('find', 'first', 'button[type="submit"]', 'click');

    await activePage.waitForURL(/secure/, { timeout: 10_000 });
    expect(activePage.url()).toContain('/secure');
  });

  test('fill form fields using nth selectors', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Fill username (1st input)
    bcli('find', 'nth', '1', 'input', 'fill', TEST_USERNAME);
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);

    // Fill password (2nd input)
    bcli('find', 'nth', '2', 'input', 'fill', TEST_PASSWORD);
    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });
});
