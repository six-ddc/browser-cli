import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME } from '../helpers/constants';

test.describe('CSS selectors', () => {
  test('clicks by ID selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('click', '#username');
    expect(r).toBcliSuccess();
  });

  test('clicks by class selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('click', '.radius');
    expect(r).toBcliSuccess();
  });

  test('clicks by attribute selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('click', 'button[type="submit"]');
    expect(r).toBcliSuccess();
  });

  test('gets text by tag selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('get', 'text', 'h2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Login Page');
  });

  test('counts elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('get', 'count', SEL.CHECKBOX);
    expect(r).toBcliSuccess();
    expect(parseInt(r.stdout.trim(), 10)).toBe(2);
  });
});

test.describe('semantic locators — text=', () => {
  test('click with text= locator', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('click', 'text=Login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('click with quoted text= for exact match', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);
    const r = bcli('click', 'text="Add Element"');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
    await expect(activePage.locator('.added-manually')).toBeVisible();
  });
});

test.describe('semantic locators — role=', () => {
  test('click with role= locator', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('click', 'role=button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('click with role= and name filter', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('click', 'role=button[name="Login"]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('click role=link', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('click', 'role=link');
    expect(r).toBcliSuccess();
  });
});

test.describe('semantic locators — label=', () => {
  test('fill with label= locator', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('fill', 'label=Username', 'testuser');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('testuser');
  });

  test('fill with label= on password field', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('fill', 'label=Password', 'secret');
    expect(r).toBcliSuccess();
    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue('secret');
  });
});

test.describe('element references (@e1, @e2, ...)', () => {
  test('snapshot -ic generates @e refs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('@e');
  });

  test('click using @e ref from snapshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    bcli('snapshot', '-ic');

    const r = bcli('click', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('fill using @e ref from snapshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('snapshot', '-ic');

    const r = bcli('fill', '@e2', 'reftest');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
  });
});

test.describe('find command — semantic engines', () => {
  test('find by role with default click action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('find', 'role', 'button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('find by role with --name filter', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('find', 'role', 'button', '--name', 'Login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('find by text', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);
    const r = bcli('find', 'text', 'Add Element', 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
    await expect(activePage.locator('.added-manually')).toBeVisible();
  });

  test('find by label and fill', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('find', 'label', 'Username', 'fill', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('find by label with exact match', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('find', 'label', 'Username', 'fill', 'exacttest', '--exact');
    expect(r).toBcliSuccess();
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('exacttest');
  });

  test('find by xpath', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('find', 'xpath', '//button[@type="submit"]', 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

test.describe('find command — position selectors', () => {
  test('first position selector', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('find', 'first', SEL.CHECKBOX, 'check');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');
    await expect(activePage.locator(`${SEL.CHECKBOX}:first-of-type`)).toBeChecked();
  });

  test('last position selector', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('find', 'last', SEL.CHECKBOX, 'uncheck');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');
    await expect(activePage.locator(`${SEL.CHECKBOX}:last-of-type`)).not.toBeChecked();
  });

  test('nth position selector (1-based)', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('find', 'nth', '1', SEL.CHECKBOX, 'check');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');
    await expect(activePage.locator(`${SEL.CHECKBOX}:first-of-type`)).toBeChecked();
  });

  test('nth 2 position selector', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('find', 'nth', '2', SEL.CHECKBOX, 'uncheck');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');
    await expect(activePage.locator(`${SEL.CHECKBOX}:last-of-type`)).not.toBeChecked();
  });
});

test.describe('find command — different actions', () => {
  test('find + hover action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);
    const r = bcli('find', 'first', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('find + select action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DROPDOWN);
    const r = bcli('find', 'role', 'combobox', 'select', 'Option 1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Selected');
  });

  test('find + clear action', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'clearme');

    const r = bcli('find', 'label', 'Username', 'clear');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('');
  });

  test('find + focus action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('find', 'label', 'Username', 'focus');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });
});

test.describe('error cases', () => {
  test('clicking non-existent selector fails', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('click', '.does-not-exist-at-all');
    expect(r).toBcliFailure();
  });

  test('find with unknown engine fails', async ({ bcli }) => {
    const r = bcli('find', 'unknownengine', 'value', 'click');
    expect(r).toBcliFailure();
  });
});
