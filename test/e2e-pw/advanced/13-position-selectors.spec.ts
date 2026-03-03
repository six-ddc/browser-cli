import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';

// ---- --first option ----

test.describe('find --first', () => {
  test('click first checkbox', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, 'click', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');

    // First checkbox was unchecked initially; clicking should check it
    await expect(activePage.locator(SEL.CHECKBOX).first()).toBeChecked();
  });

  test('check first checkbox', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, 'check', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');

    // Verify the first checkbox is now checked
    await expect(activePage.locator(SEL.CHECKBOX).first()).toBeChecked();
  });

  test('default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Omitting action should default to click
    const r = bcli('find', SEL.CHECKBOX, '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('hover first figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    const r = bcli('find', '.figure', 'hover', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('fill first input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'input', 'fill', TEST_USERNAME, '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('focus first input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'input', 'focus', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });

  test('clear first input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Fill the input first
    bcli('fill', SEL.USERNAME, 'testdata');

    const r = bcli('find', 'input', 'clear', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('');
  });
});

// ---- --last option ----

test.describe('find --last', () => {
  test('click last checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, 'click', '--last');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('uncheck last checkbox', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // The second (last) checkbox on /checkboxes is checked by default
    const r = bcli('find', SEL.CHECKBOX, 'uncheck', '--last');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');

    // Verify the last checkbox is now unchecked
    await expect(activePage.locator(SEL.CHECKBOX).last()).not.toBeChecked();
  });

  test('default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, '--last');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('hover last figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    const r = bcli('find', '.figure', 'hover', '--last');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('fill last input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // The last input on the login page should be the password field
    const r = bcli('find', 'input[type="password"]', 'fill', TEST_PASSWORD, '--last');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });

  test('focus last input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'input', 'focus', '--last');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });
});

// ---- --nth option ----

test.describe('find --nth', () => {
  test('nth 1: click first checkbox (1-based)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // nth 1 should be the first checkbox
    const r = bcli('find', SEL.CHECKBOX, 'click', '--nth', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 2: click second checkbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, 'click', '--nth', '2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 1: check first checkbox', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, 'check', '--nth', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');

    // Verify the first checkbox is now checked
    await expect(activePage.locator(SEL.CHECKBOX).first()).toBeChecked();
  });

  test('nth 2: uncheck second checkbox', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Second checkbox is checked by default
    const r = bcli('find', SEL.CHECKBOX, 'uncheck', '--nth', '2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');

    // Verify the second checkbox is now unchecked
    await expect(activePage.locator(SEL.CHECKBOX).last()).not.toBeChecked();
  });

  test('nth: default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, '--nth', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 1: fill first input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'input', 'fill', TEST_USERNAME, '--nth', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('nth 2: fill second input (password)', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'input', 'fill', TEST_PASSWORD, '--nth', '2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });

  test('nth: hover nth figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    // Hovers page has 3 figures
    const r = bcli('find', '.figure', 'hover', '--nth', '2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('nth 3: hover third figure', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    const r = bcli('find', '.figure', 'hover', '--nth', '3');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });
});

// ---- nth equivalence with first/last ----

test.describe('nth equivalence', () => {
  test('nth 1 is equivalent to --first', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Both should target the first checkbox
    const r = bcli('find', SEL.CHECKBOX, 'click', '--nth', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('nth 2 targets the last checkbox (on 2-checkbox page)', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // /checkboxes has exactly 2 checkboxes, so nth 2 = last
    const r = bcli('find', SEL.CHECKBOX, 'click', '--nth', '2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- Position options with different actions ----

test.describe('position option + actions', () => {
  test('position option + type action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'input', 'type', TEST_USERNAME, '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Typed');
  });

  test('position option + dblclick action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);

    const r = bcli('find', 'button', 'dblclick', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Double-clicked');
  });

  test('position option + select action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DROPDOWN);

    const r = bcli('find', 'select', 'select', '1', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Selected');
  });

  test('position option + press action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    bcli('focus', SEL.USERNAME);

    const r = bcli('find', 'input', 'press', 'Tab', '--first');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Pressed');
  });
});

// ---- Position options error handling ----

test.describe('position option error handling', () => {
  test('--nth with invalid (non-numeric) value gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, 'click', '--nth', 'abc');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/[Ii]nvalid|error/i);
  });

  test('--nth with negative value gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', SEL.CHECKBOX, 'click', '--nth', '-1');
    expect(r).toBcliFailure();
  });

  test('--nth with out-of-bounds index gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // There are only 2 checkboxes, so nth 999 should fail
    const r = bcli('find', SEL.CHECKBOX, 'click', '--nth', '999');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('--first with no matching elements gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', '.nonexistent-class-xyz', 'click', '--first');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('--last with no matching elements gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', '.nonexistent-class-xyz', 'click', '--last');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('missing selector gives usage error', async ({ bcli }) => {
    const r = bcli('find');
    expect(r).toBcliFailure();
  });
});

// ---- Position options in multi-element scenarios ----

test.describe('multi-element scenarios', () => {
  test('first and last target different elements', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // Verify we have 2 checkboxes
    const countR = bcli('get', 'count', SEL.CHECKBOX);
    expect(countR).toBcliSuccess();
    expect(countR.stdout.trim()).toBe('2');

    // Check the first checkbox (initially unchecked)
    bcli('find', SEL.CHECKBOX, 'check', '--first');

    // Uncheck the last checkbox (initially checked)
    bcli('find', SEL.CHECKBOX, 'uncheck', '--last');

    // Verify first checkbox is checked and last is unchecked
    await expect(activePage.locator(SEL.CHECKBOX).first()).toBeChecked();
    await expect(activePage.locator(SEL.CHECKBOX).last()).not.toBeChecked();
  });

  test('nth iterates through multiple elements correctly', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    // The hovers page has 3 figure elements
    // Hover each one in sequence using nth
    let r = bcli('find', '.figure', 'hover', '--nth', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');

    r = bcli('find', '.figure', 'hover', '--nth', '2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');

    r = bcli('find', '.figure', 'hover', '--nth', '3');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });
});

// ---- Position options with semantic locators ----

test.describe('position option + semantic locator workflows', () => {
  test('position option then semantic locator', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Use position option to fill first input
    bcli('find', 'input', 'fill', TEST_USERNAME, '--first');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);

    // Use semantic locator to fill password
    bcli('find', 'label=Password', 'fill', TEST_PASSWORD);
    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);

    // Use position option to click the submit button
    bcli('find', 'button[type="submit"]', 'click', '--first');

    await activePage.waitForURL(/secure/, { timeout: 10_000 });
    expect(activePage.url()).toContain('/secure');
  });

  test('fill form fields using nth options', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Fill username (1st input)
    bcli('find', 'input', 'fill', TEST_USERNAME, '--nth', '1');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);

    // Fill password (2nd input)
    bcli('find', 'input', 'fill', TEST_PASSWORD, '--nth', '2');
    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });
});
