import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';

test.describe('click', () => {
  test('clicks an element by CSS selector', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);
    const r = bcli('click', 'button[onclick="addElement()"]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
    await expect(activePage.locator('.added-manually')).toBeVisible();
  });

  test('clicks a login button and navigates', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, TEST_USERNAME);
    bcli('fill', SEL.PASSWORD, TEST_PASSWORD);

    const r = bcli('click', SEL.LOGIN_BTN);
    expect(r).toBcliSuccess();
    await activePage.waitForURL(/secure/);
    expect(activePage.url()).toContain('/secure');
  });

  test('right-click with --button option', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CONTEXT_MENU);
    const r = bcli('click', '#hot-spot', '--button', 'right');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('middle-click with --button middle', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CONTEXT_MENU);
    const r = bcli('click', '#hot-spot', '--button', 'middle');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

test.describe('dblclick', () => {
  test('double-clicks an element', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);
    const r = bcli('dblclick', 'button[onclick="addElement()"]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Double-clicked');
    // CLI dblclick dispatches a dblclick event; the onclick handler fires once
    await expect(activePage.locator('.added-manually')).toHaveCount(1);
  });
});

test.describe('fill', () => {
  test('fills an input field with a value', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('fill', SEL.USERNAME, 'testuser');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('testuser');
  });

  test('replaces existing input value', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'first');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('first');

    bcli('fill', SEL.USERNAME, 'second');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('second');
  });

  test('fills password field', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('fill', SEL.PASSWORD, TEST_PASSWORD);
    expect(r).toBcliSuccess();
    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });
});

test.describe('type', () => {
  test('types text character-by-character', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.INPUTS);
    const r = bcli('type', 'input[type="number"]', '12345');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Typed');
    await expect(activePage.locator('input[type="number"]')).toHaveValue('12345');
  });

  test('types with --delay option', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.INPUTS);
    const r = bcli('type', 'input[type="number"]', '42', '--delay', '50');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Typed');
    await expect(activePage.locator('input[type="number"]')).toHaveValue('42');
  });
});

test.describe('check / uncheck', () => {
  test('checks an unchecked checkbox', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('check', `${SEL.CHECKBOX}:first-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');
    await expect(activePage.locator(`${SEL.CHECKBOX}:first-of-type`)).toBeChecked();
  });

  test('checking an already-checked checkbox stays checked', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('check', `${SEL.CHECKBOX}:last-of-type`);
    expect(r).toBcliSuccess();
    await expect(activePage.locator(`${SEL.CHECKBOX}:last-of-type`)).toBeChecked();
  });

  test('unchecks a checked checkbox', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('uncheck', `${SEL.CHECKBOX}:last-of-type`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');
    await expect(activePage.locator(`${SEL.CHECKBOX}:last-of-type`)).not.toBeChecked();
  });

  test('unchecking an already-unchecked checkbox stays unchecked', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('uncheck', `${SEL.CHECKBOX}:first-of-type`);
    expect(r).toBcliSuccess();
    await expect(activePage.locator(`${SEL.CHECKBOX}:first-of-type`)).not.toBeChecked();
  });
});

test.describe('select', () => {
  test('selects a dropdown option by value', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.DROPDOWN);
    const r = bcli('select', SEL.DROPDOWN, '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Selected');
    await expect(activePage.locator(SEL.DROPDOWN)).toHaveValue('1');
  });

  test('selects a dropdown option by visible text', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.DROPDOWN);
    const r = bcli('select', SEL.DROPDOWN, 'Option 2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Selected');
    await expect(activePage.locator(SEL.DROPDOWN)).toHaveValue('2');
  });

  test('changing selection updates value', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.DROPDOWN);
    bcli('select', SEL.DROPDOWN, '1');
    await expect(activePage.locator(SEL.DROPDOWN)).toHaveValue('1');

    bcli('select', SEL.DROPDOWN, '2');
    await expect(activePage.locator(SEL.DROPDOWN)).toHaveValue('2');
  });
});

test.describe('hover', () => {
  test('hovers over an element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);
    const r = bcli('hover', '.figure:first-of-type');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
    // Note: CSS :hover pseudo-class does not activate with programmatic hover
    // (dispatching mouse events). Only real user mouse position triggers :hover.
    // So we only verify the CLI command succeeded.
  });
});

test.describe('press (page-level key)', () => {
  test('presses a key on the page', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);
    const r = bcli('press', 'Enter');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Pressed');
    await expect(activePage.locator('#result')).toContainText('Enter');
  });

  test('Tab key', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);
    const r = bcli('press', 'Tab');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Pressed');
    await expect(activePage.locator('#result')).toContainText('Tab');
  });

  test('key alias works', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);
    const r = bcli('key', 'Escape');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Pressed');
    await expect(activePage.locator('#result')).toContainText('Escape');
  });
});

test.describe('clear', () => {
  test('clears an input field', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'testvalue');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('testvalue');

    const r = bcli('clear', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('');
  });
});

test.describe('focus', () => {
  test('focuses an input element', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('focus', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
    await expect(activePage.locator(SEL.USERNAME)).toBeFocused();
  });
});

test.describe('complete login flow (integration)', () => {
  test('fill + click completes login', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, TEST_USERNAME);
    bcli('fill', SEL.PASSWORD, TEST_PASSWORD);
    bcli('click', SEL.LOGIN_BTN);

    await activePage.waitForURL(/secure/);
    expect(activePage.url()).toContain('/secure');
    await expect(activePage.locator(SEL.FLASH_MESSAGE)).toContainText('You logged into a secure area');
  });
});
