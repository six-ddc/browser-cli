import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

// ===========================================================================
// Selector Not Found
// ===========================================================================

test.describe('selector not found errors', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.ERROR_TEST);
  });

  test('click on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('click', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('fill on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('fill', '.nonexistent-element', 'text');
    expect(r).toBcliFailure();
  });

  test('hover on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('hover', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('get text on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('get', 'text', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('get box on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('get', 'box', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('focus on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('focus', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('clear on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('clear', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('get value on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('get', 'value', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('get attr on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('get', 'attr', '.nonexistent-element', 'id');
    expect(r).toBcliFailure();
  });
});

// ===========================================================================
// Invalid Arguments
// ===========================================================================

test.describe('invalid arguments', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.ERROR_TEST);
  });

  test('select with invalid option value fails', async ({ bcli }) => {
    const r = bcli('select', '#test-select', 'nonexistent-option-value');
    // Selecting a nonexistent option value should fail
    expect(r).toBcliFailure();
  });

  test('scroll with invalid direction errors', async ({ bcli }) => {
    const r = bcli('scroll', 'diagonal');
    expect(r).toBcliFailure();
  });

  test('set viewport with non-numeric width errors', async ({ bcli }) => {
    const r = bcli('set', 'viewport', 'abc', '720');
    expect(r).toBcliFailure();
  });
});

// ===========================================================================
// Timeout Behavior
// ===========================================================================

test.describe('timeout behavior', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.ERROR_TEST);
  });

  test('wait for nonexistent selector with short timeout fails within time limit', async ({ bcli }) => {
    const startTime = Date.now();
    const r = bcli('wait', '.never-going-to-exist', '--timeout', '1000');
    const elapsed = Date.now() - startTime;

    expect(r).toBcliFailure();
    // Should timeout around 1 second, not the default 10s
    expect(elapsed).toBeLessThanOrEqual(5000);
  });

  test('wait --text for text that never appears with short timeout', async ({ bcli }) => {
    const startTime = Date.now();
    const r = bcli('wait', '--text', 'This text will absolutely never appear', '--timeout', '1000');
    const elapsed = Date.now() - startTime;

    expect(r).toBcliFailure();
    expect(elapsed).toBeLessThanOrEqual(5000);
  });

  test('wait --fn for false condition with short timeout', async ({ bcli }) => {
    const startTime = Date.now();
    const r = bcli('wait', '--fn', 'false', '--timeout', '1000');
    const elapsed = Date.now() - startTime;

    expect(r).toBcliFailure();
    expect(elapsed).toBeLessThanOrEqual(5000);
  });
});

// ===========================================================================
// Error JSON Format
// ===========================================================================

test.describe('error JSON format', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.ERROR_TEST);
  });

  test('--json click .nonexistent returns parseable JSON with success false', async ({ bcli }) => {
    const r = bcli('--json', 'click', '.nonexistent-element');
    expect(r).toBcliFailure();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
    expect('error' in parsed || 'message' in parsed).toBeTruthy();
  });

  test('--json wait .nonexistent --timeout 1000 returns parseable JSON error', async ({ bcli }) => {
    const r = bcli('--json', 'wait', '.nonexistent-element', '--timeout', '1000');
    expect(r).toBcliFailure();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
  });

  test('--json get text .nonexistent returns parseable JSON error', async ({ bcli }) => {
    const r = bcli('--json', 'get', 'text', '.nonexistent-element');
    expect(r).toBcliFailure();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
  });

  test('--json fill .nonexistent returns parseable JSON error', async ({ bcli }) => {
    const r = bcli('--json', 'fill', '.nonexistent-element', 'value');
    expect(r).toBcliFailure();
    const parsed = JSON.parse(r.stdout);
    expect(parsed.success).toBe(false);
  });
});

// ===========================================================================
// Edge Cases
// ===========================================================================

test.describe('edge cases', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.ERROR_TEST);
  });

  test('get count returns 0 for nonexistent selector (no crash)', async ({ bcli }) => {
    const r = bcli('get', 'count', '.nonexistent-element');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('0');
  });

  test('very long selector string does not crash', async ({ bcli }) => {
    const longSelector = '.a' + 'b'.repeat(200);
    const r = bcli('click', longSelector);
    // A 200+ char random selector should fail to find an element
    expect(r).toBcliFailure();
  });

  test('special characters in selector are handled', async ({ bcli }) => {
    // Querying an element with special chars in its data attributes
    const r = bcli('get', 'text', '#special-chars');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Special Chars');
  });

  test('scrollintoview on nonexistent element fails', async ({ bcli }) => {
    const r = bcli('scrollintoview', '.nonexistent-element-12345');
    expect(r.exitCode).not.toBe(0);
  });

  test('dblclick on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('dblclick', '.nonexistent-element');
    expect(r).toBcliFailure();
  });

  test('check on nonexistent selector fails', async ({ bcli }) => {
    const r = bcli('check', '.nonexistent-element');
    expect(r).toBcliFailure();
  });
});
