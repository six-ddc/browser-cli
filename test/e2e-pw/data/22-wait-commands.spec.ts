import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_USERNAME, TEST_PASSWORD } from '../helpers/constants';

// ===========================================================================
// wait <ms> -- Duration wait
// ===========================================================================

test.describe('wait duration', () => {
  test('waits for specified milliseconds', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const startTime = Date.now();
    const r = bcli('wait', '1000');
    const elapsed = Date.now() - startTime;

    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Waited for 1000ms');
    // Should take at least 1 second
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });

  test('short wait completes quickly', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('wait', '100');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Waited for 100ms');
  });
});

// ===========================================================================
// wait <selector> -- Selector wait
// ===========================================================================

test.describe('wait selector', () => {
  test('succeeds for existing element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('wait', SEL.USERNAME);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain(`Found: ${SEL.USERNAME}`);
  });

  test('succeeds for heading element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('wait', 'h2');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Found: h2');
  });

  test('times out for nonexistent element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('wait', '.never-going-to-exist', '--timeout', '2000');
    expect(r).toBcliFailure();
  });

  test('waits for dynamically loaded element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_LOADING_2);
    // Click Start to trigger async loading
    bcli('click', '#start button');

    // Wait for the dynamically loaded element
    const r = bcli('wait', '#finish', '--timeout', '10000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Found: #finish');
  });

  test('respects custom timeout', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    // Short timeout for nonexistent element
    const startTime = Date.now();
    const r = bcli('wait', '.nonexistent', '--timeout', '2000');
    const elapsed = Date.now() - startTime;

    expect(r).toBcliFailure();
    // Should timeout around 2 seconds, not the default 10
    expect(elapsed).toBeLessThanOrEqual(5000);
  });
});

// ===========================================================================
// wait --hidden -- Wait for element to become hidden
// ===========================================================================

test.describe('wait --hidden', () => {
  test('waits until element is removed', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);
    // Click Remove to hide the checkbox
    bcli('click', '#checkbox-example button');

    // Wait for the checkbox to become hidden
    const r = bcli('wait', '#checkbox', '--hidden', '--timeout', '10000');
    expect(r).toBcliSuccess();
  });
});

// ===========================================================================
// wait --url -- URL pattern wait
// ===========================================================================

test.describe('wait --url', () => {
  test('succeeds when URL already matches', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('wait', '--url', 'login', '--timeout', '5000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('/login');
  });

  test('waits for URL change after login', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    // Fill credentials and submit to trigger URL change
    bcli('fill', SEL.USERNAME, TEST_USERNAME);
    bcli('fill', SEL.PASSWORD, TEST_PASSWORD);
    // Click login to trigger navigation
    bcli('click', SEL.LOGIN_BTN);

    // Wait for navigation to settle
    bcli('wait', '2000');

    // wait --url should detect that the URL now contains /secure
    const r = bcli('wait', '--url', '**/secure*', '--timeout', '10000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('secure');
  });
});

// ===========================================================================
// wait --text -- Text content wait
// ===========================================================================

test.describe('wait --text', () => {
  test('succeeds when text is already present', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('wait', '--text', 'Login Page', '--timeout', '5000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Found text: Login Page');
  });

  test('waits for dynamically loaded text', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_LOADING_2);
    // Click Start to trigger async loading
    bcli('click', '#start button');

    // Wait for the text to appear
    const r = bcli('wait', '--text', 'Hello World!', '--timeout', '10000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Found text: Hello World!');
  });

  test('times out when text never appears', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli(
      'wait',
      '--text',
      'This text will never appear on the page',
      '--timeout',
      '2000',
    );
    expect(r).toBcliFailure();
  });
});

// ===========================================================================
// wait --load -- Load state wait
// ===========================================================================

// NOTE: These tests only verify the "already loaded" case — navigateAndWait ensures
// the page is fully loaded before wait --load is called. A more thorough test would
// call `navigate` and immediately `wait --load` in rapid succession to test the
// waiting-for-load scenario, but that is difficult to orchestrate with synchronous
// CLI calls. This limitation is known and accepted.
test.describe('wait --load', () => {
  test('waits for page load (default)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('wait', '--load');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Load state: load');
  });

  test('waits for DOMContentLoaded', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('wait', '--load', 'domcontentloaded');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Load state: domcontentloaded');
  });

  test('waits for network idle', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('wait', '--load', 'networkidle', '--timeout', '15000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Load state: networkidle');
  });
});

// ===========================================================================
// wait --fn -- JavaScript function wait
// ===========================================================================

test.describe('wait --fn', () => {
  test('succeeds when condition is already true', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli('wait', '--fn', "document.querySelectorAll('a').length > 0");
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Function condition met');
  });

  test('checks document.title', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('wait', '--fn', "document.title.includes('Internet')");
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Function condition met');
  });

  test('times out for false condition', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r = bcli(
      'wait',
      '--fn',
      "document.getElementById('does-not-exist') !== null",
      '--timeout',
      '2000',
    );
    expect(r).toBcliFailure();
  });
});

// ===========================================================================
// waitforurl command (alias)
// ===========================================================================

test.describe('waitforurl', () => {
  test('works as alias for wait --url', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('waitforurl', 'login', '--timeout', '5000');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('/login');
  });
});
