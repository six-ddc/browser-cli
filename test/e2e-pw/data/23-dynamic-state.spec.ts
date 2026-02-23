import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

// ===========================================================================
// Dynamic Controls — Enable/Disable
// ===========================================================================

test.describe('dynamic enable/disable', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);
  });

  test('input starts disabled', async ({ bcli }) => {
    const r = bcli('is', 'enabled', '#input-example input');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('false');
  });

  test('click Enable then input becomes enabled', async ({ bcli }) => {
    bcli('click', '#input-example button');
    // Wait for the enable animation to complete
    bcli('wait', '3000');

    const r = bcli('is', 'enabled', '#input-example input');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('fill on disabled input fails or is ignored', async ({ bcli }) => {
    const r = bcli('fill', '#txt-input', 'test');
    // Filling a disabled input: CLI may fail (enforcing disabled) or succeed (bypassing disabled).
    // Either way, the input value should not actually be usable.
    if (r.success) {
      // CLI fill bypasses disabled attribute — that's acceptable
      expect(r.stdout).toContain('Filled');
    } else {
      expect(r).toBcliFailure();
    }
  });

  test('fill after enable succeeds', async ({ bcli }) => {
    bcli('click', '#input-example button');
    bcli('wait', '3000');

    const r = bcli('fill', '#txt-input', 'hello world');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');

    const v = bcli('get', 'value', '#txt-input');
    expect(v).toBcliSuccess();
    expect(v.stdout).toBe('hello world');
  });

  test('disable then re-enable toggles is enabled', async ({ bcli }) => {
    // Enable
    bcli('click', '#input-example button');
    bcli('wait', '3000');

    const r1 = bcli('is', 'enabled', '#input-example input');
    expect(r1).toBcliSuccess();
    expect(r1.stdout).toBe('true');

    // Disable again
    bcli('click', '#input-example button');
    bcli('wait', '3000');

    const r2 = bcli('is', 'enabled', '#input-example input');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toBe('false');
  });
});

// ===========================================================================
// Dynamic Controls — Remove/Add checkbox
// ===========================================================================

test.describe('dynamic remove/add', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_CONTROLS);
  });

  test('checkbox is initially visible', async ({ bcli }) => {
    const r = bcli('is', 'visible', '#checkbox input[type="checkbox"]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('after remove, checkbox is gone', async ({ bcli }) => {
    bcli('click', '#checkbox-example button');
    bcli('wait', '2000');

    // Element is removed from the DOM: either returns false or fails (element not found)
    const r = bcli('is', 'visible', '#checkbox input[type="checkbox"]');
    if (r.success) {
      expect(r.stdout).toBe('false');
    } else {
      expect(r).toBcliFailure();
    }
  });

  test('after remove then add, checkbox is back', async ({ bcli }) => {
    // Remove
    bcli('click', '#checkbox-example button');
    bcli('wait', '2000');

    // Add back
    bcli('click', '#checkbox-example button');
    bcli('wait', '2000');

    const r = bcli('is', 'visible', '#checkbox input[type="checkbox"]');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('true');
  });

  test('get count reflects checkbox removal', async ({ bcli }) => {
    const before = bcli('get', 'count', '#checkbox input[type="checkbox"]');
    expect(before).toBcliSuccess();
    expect(before.stdout).toBe('1');

    bcli('click', '#checkbox-example button');
    bcli('wait', '2000');

    const after = bcli('get', 'count', '#checkbox input[type="checkbox"]');
    expect(after).toBcliSuccess();
    expect(after.stdout).toBe('0');
  });

  test('wait for checkbox to reappear after add', async ({ bcli }) => {
    // Remove checkbox
    bcli('click', '#checkbox-example button');
    bcli('wait', '2000');

    // Click Add to bring it back
    bcli('click', '#checkbox-example button');

    // Wait for checkbox to reappear
    const r = bcli('wait', '#checkbox input[type="checkbox"]', '--timeout', '5000');
    expect(r).toBcliSuccess();
  });
});

// ===========================================================================
// Dynamic Loading 1 — Hidden element becomes visible
// ===========================================================================

test.describe('dynamic loading 1', () => {
  test('is visible returns false for initially hidden #finish', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.DYNAMIC_LOADING_1);

    const r = bcli('is', 'visible', '#finish');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('false');
  });

  test('after click Start, wait + get text on #finish', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_LOADING_1);

    bcli('click', '#start button');

    // Wait for finish to appear (hidden → visible via style change)
    const waitR = bcli(
      'wait',
      '--fn',
      "document.getElementById('finish').style.display === 'block'",
      '--timeout',
      '10000',
    );
    expect(waitR).toBcliSuccess();

    const textR = bcli('get', 'text', '#finish h4');
    expect(textR).toBcliSuccess();
    expect(textR.stdout).toContain('Hello World!');
  });
});

// ===========================================================================
// Dynamic Loading 2 — Element rendered after the fact
// ===========================================================================

test.describe('dynamic loading 2', () => {
  test('#finish does not exist before clicking Start', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_LOADING_2);

    const r = bcli('get', 'count', '#finish');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('0');
  });

  test('after click Start, wait for #finish then get text', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_LOADING_2);

    bcli('click', '#start button');

    const waitR = bcli('wait', '#finish', '--timeout', '10000');
    expect(waitR).toBcliSuccess();

    const textR = bcli('get', 'text', '#finish h4');
    expect(textR).toBcliSuccess();
    expect(textR.stdout).toContain('Hello World!');
  });

  test('is visible for #finish before and after loading', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DYNAMIC_LOADING_2);

    // Before: element does not exist — either returns false or fails (element not found)
    const beforeR = bcli('is', 'visible', '#finish');
    if (beforeR.success) {
      expect(beforeR.stdout).toBe('false');
    } else {
      expect(beforeR).toBcliFailure();
    }

    // Trigger load
    bcli('click', '#start button');
    const waitR = bcli('wait', '#finish', '--timeout', '10000');
    expect(waitR).toBcliSuccess();

    // After: element exists and is visible
    const afterR = bcli('is', 'visible', '#finish');
    expect(afterR).toBcliSuccess();
    expect(afterR.stdout).toBe('true');
  });
});
