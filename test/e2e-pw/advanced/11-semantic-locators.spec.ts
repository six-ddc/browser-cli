import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';

// ---- role= locator ----

test.describe('role= locator', () => {
  test('click button by role', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'role=button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('click button with name filter', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'role=button[name="Login"]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('click link by role', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'role=link');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('fill textbox by role', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('fill', 'role=textbox', TEST_USERNAME);
    expect(r).toBcliSuccess();

    // The first textbox on /login is the username field
    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('hover element by role', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('hover', 'role=link');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('role with [exact] option', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'role=button[name="Login"][exact]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('count elements by role', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('get', 'count', 'role=checkbox');
    expect(r).toBcliSuccess();
    // The checkboxes page has exactly 2 checkboxes
    expect(r.stdout.trim()).toBe('2');
  });
});

// ---- text= locator ----

test.describe('text= locator', () => {
  test('click by text (substring match)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'text=Login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('exact match with quoted value', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Quoted value triggers exact match
    const r = bcli('click', 'text="Login"');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('substring match (partial text)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // "Log" should match "Login" in substring mode
    const r = bcli('click', 'text=Log');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('hover element by text', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ADD_REMOVE);

    const r = bcli('hover', 'text=Add Element');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });

  test('text is case insensitive by default', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'text=login');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- label= locator ----

test.describe('label= locator', () => {
  test('find input by label text', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('fill', 'label=Username', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('find password input by label', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('fill', 'label=Password', TEST_PASSWORD);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.PASSWORD)).toHaveValue(TEST_PASSWORD);
  });

  test('click input found by label', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'label=Username');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('exact match with quoted value', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('fill', 'label="Username"', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
  });

  test('label is case insensitive by default', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('fill', 'label=username', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
  });
});

// ---- placeholder= locator ----

test.describe('placeholder= locator', () => {
  test('find input by placeholder', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.FORGOT_PASSWORD);

    const r = bcli('fill', 'placeholder=E-mail', 'test@example.com');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
  });

  test('click input by placeholder', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.FORGOT_PASSWORD);

    const r = bcli('click', 'placeholder=E-mail');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- alt= locator ----

test.describe('alt= locator', () => {
  test('click image by alt text', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOVERS);

    // The hovers page has images with alt="User 1", alt="User 2", alt="User 3"
    // Substring match on "User" should find one of them
    const r = bcli('click', 'alt=User');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });
});

// ---- title= locator ----

test.describe('title= locator', () => {
  test('fails when no element has matching title attribute', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CONTEXT_MENU);

    // The context menu page has no elements with a title attribute,
    // so title=Context should fail to find an element
    const r = bcli('hover', 'title=Context');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('finds element by title attribute on testid page', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.TESTID_PAGE);

    // The testid page has a button with title="Submit form"
    const r = bcli('hover', 'title=Submit form');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Hovered');
  });
});

// ---- testid= locator ----

test.describe('testid= locator', () => {
  test('find element by data-testid', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Inject a test element with data-testid to verify the locator works
    bcli('eval', 'document.querySelector("button").setAttribute("data-testid", "login-btn"); true');

    const r = bcli('click', 'testid=login-btn');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('exact match (case-sensitive)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Add a test element with data-testid
    bcli(
      'eval',
      'document.querySelector("button").setAttribute("data-testid", "LoginButton"); true',
    );

    // Exact case match should work
    const r = bcli('click', 'testid=LoginButton');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');

    // Wrong case should fail (testid is case-sensitive)
    bcli(
      'eval',
      'document.querySelector("button").setAttribute("data-testid", "LoginButton"); true',
    );
    const r2 = bcli('click', 'testid=loginbutton');
    expect(r2).toBcliFailure();
  });
});

// ---- xpath= locator ----

test.describe('xpath= locator', () => {
  test('find by simple xpath', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'xpath=//button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('find by attribute xpath', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'xpath=//button[@type="submit"]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('fill input by xpath', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('fill', 'xpath=//input[@id="username"]', TEST_USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    await expect(activePage.locator(SEL.USERNAME)).toHaveValue(TEST_USERNAME);
  });

  test('find by text content xpath', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'xpath=//h2[contains(text(),"Login")]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('complex xpath with multiple conditions', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('click', 'xpath=//input[@type="checkbox"][1]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('invalid xpath gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'xpath=///invalid[[');
    expect(r).toBcliFailure();
  });
});

// ---- Locators with get commands ----

test.describe('semantic locator with get commands', () => {
  test('get text with role= selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('get', 'text', 'role=heading');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Login');
  });

  test('get value from input found by label=', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Fill the username field first
    bcli('fill', SEL.USERNAME, TEST_USERNAME);

    const r = bcli('get', 'value', 'label=Username');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain(TEST_USERNAME);
  });

  test('is visible with role= selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('is', 'visible', 'role=button');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('true');
  });

  test('get count with role= selector', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const r = bcli('get', 'count', 'role=checkbox');
    expect(r).toBcliSuccess();
    // Should be a number > 0
    expect(r.stdout).toMatch(/[1-9][0-9]*/);
  });
});

// ---- Locator Error Cases ----

test.describe('semantic locator error cases', () => {
  test('nonexistent text= gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', 'text=ThisTextDefinitelyDoesNotExistAnywhere12345');
    expect(r).toBcliFailure();
    expect(r.stdout + r.stderr).toMatch(/not found|Element/i);
  });

  test('nonexistent role= gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // alertdialog role shouldn't exist on the login page
    const r = bcli('click', 'role=alertdialog');
    expect(r).toBcliFailure();
  });

  test('nonexistent label= gives error', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('fill', 'label=NonexistentLabel12345', 'value');
    expect(r).toBcliFailure();
  });
});
