import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';

// ---- Find by Role ----

test.describe('find role', () => {
  test('default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // find role button should click the first button (Login)
    const r = bcli('find', 'role', 'button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('click button with --name', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'role', 'button', '--name', 'Login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('fill textbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'role', 'textbox', 'fill', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
  });

  test('hover on link', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'role', 'link', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('focus on textbox', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'role', 'textbox', 'focus');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });
});

// ---- Find by Text ----

test.describe('find text', () => {
  test('click by text content', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'text', 'Login', 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('default action is click', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Omitting action should default to click
    const r = bcli('find', 'text', 'Login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('exact match with --exact flag', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'text', 'Login', 'click', '--exact');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('partial match finds element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // "Log" should match "Login" in partial/substring mode
    const r = bcli('find', 'text', 'Log', 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- Find by Label ----

test.describe('find label', () => {
  test('fill input by label text', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'label', 'Username', 'fill', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    // Verify the input was actually filled
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('fill password by label', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'label', 'Password', 'fill', TEST_PASSWORD);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });

  test('click input found by label', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'label', 'Username', 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('focus input found by label', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'label', 'Username', 'focus');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Focused');
  });
});

// ---- Find by Placeholder ----

test.describe('find placeholder', () => {
  test('fill input by placeholder text', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.FORGOT_PASSWORD);

    const r = bcli('find', 'placeholder', 'E-mail', 'fill', 'test@example.com');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
  });
});

// ---- Find by XPath ----

test.describe('find xpath', () => {
  test('click button by xpath', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'xpath', '//button[@type="submit"]', 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('fill input by xpath', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'xpath', '//input[@id="username"]', 'fill', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('complex xpath expression', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'xpath', '//input[@type="checkbox"]', 'click');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- Find with Different Actions ----

test.describe('find + actions', () => {
  test('find + fill action', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'label', 'Username', 'fill', 'testuser');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('testuser');
  });

  test('find + type action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.INPUTS);

    const r = bcli('find', 'role', 'spinbutton', 'type', '12345');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Typed');
  });

  test('find + hover action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    const r = bcli('find', 'first', '.figure', 'hover');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('find + check action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('find', 'first', SEL.CHECKBOX, 'check');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Checked');
  });

  test('find + uncheck action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    // The second checkbox is checked by default on this page
    const r = bcli('find', 'last', SEL.CHECKBOX, 'uncheck');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Unchecked');
  });

  test('find + select action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DROPDOWN);

    const r = bcli('find', 'role', 'combobox', 'select', '1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Selected');
  });

  test('find + clear action', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // First fill, then clear using find
    bcli('fill', SEL.USERNAME, 'testdata');
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue('testdata');

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

  test('find + dblclick action', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);

    const r = bcli('find', 'text', 'Add Element', 'dblclick');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Double-clicked');
  });

  test('find + press action on element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Focus on the username input, then press Tab
    bcli('focus', SEL.USERNAME);

    const r = bcli('find', 'label', 'Username', 'press', 'Tab');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Pressed');
  });
});

// ---- Find Error Handling ----

test.describe('find error handling', () => {
  test('unknown engine gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'unknown', 'value', 'click');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/Unknown engine|unknown/i);
  });

  test('unknown action gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'text', 'Login', 'invalidaction');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/Unknown action|unknown/i);
  });

  test('fill without value gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('find', 'label', 'Username', 'fill');
    expect(r).toBcliFailure();
  });

  test('select without value gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DROPDOWN);

    const r = bcli('find', 'role', 'combobox', 'select');
    expect(r).toBcliFailure();
  });

  test('too few arguments gives usage error', async ({ bcli }) => {
    const r = bcli('find', 'role');
    expect(r).toBcliFailure();
  });
});

// ---- Complete Workflow with Find ----

test.describe('find workflow', () => {
  test('complete login flow using find commands', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Fill username using find + label
    bcli('find', 'label', 'Username', 'fill', TEST_USERNAME);
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);

    // Fill password using find + label
    bcli('find', 'label', 'Password', 'fill', TEST_PASSWORD);
    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);

    // Click login button using find + role
    bcli('find', 'role', 'button', '--name', 'Login', 'click');

    // Wait for navigation to secure page
    await activePage.waitForURL(/secure/, { timeout: 10_000 });
    expect(activePage.url()).toContain('/secure');
  });
});
