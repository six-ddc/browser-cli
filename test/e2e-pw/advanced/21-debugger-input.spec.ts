import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

/**
 * Tests for the --debugger flag which uses Chrome DevTools Protocol
 * to dispatch trusted (isTrusted=true) input events.
 *
 * The trusted-events.html page logs "click:trusted/untrusted",
 * "input:trusted/untrusted", "keydown:<key>:trusted/untrusted"
 * into a #log div, so we can verify isTrusted values.
 */

test.describe('--debugger click', () => {
  test('produces isTrusted=true click event', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.TRUSTED_EVENTS);

    const r = bcli('click', '#btn', '--debugger');
    expect(r).toBcliSuccess();

    // Verify the click was trusted
    const log = await activePage.locator('#log').textContent();
    expect(log).toContain('click:trusted');
  });

  test('without --debugger produces isTrusted=false', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.TRUSTED_EVENTS);

    const r = bcli('click', '#btn');
    expect(r).toBcliSuccess();

    const log = await activePage.locator('#log').textContent();
    expect(log).toContain('click:untrusted');
  });
});

test.describe('--debugger fill', () => {
  test('produces trusted input event', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.TRUSTED_EVENTS);

    const r = bcli('fill', '#input', 'hello', '--debugger');
    expect(r).toBcliSuccess();

    // Verify the input event was trusted
    const log = await activePage.locator('#log').textContent();
    expect(log).toContain('input:trusted');

    // Verify the value was actually filled
    const value = await activePage.locator('#input').inputValue();
    expect(value).toBe('hello');
  });
});

test.describe('--debugger type', () => {
  test('produces trusted keydown events per character', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.TRUSTED_EVENTS);

    const r = bcli('type', '#input', 'ab', '--debugger');
    expect(r).toBcliSuccess();

    // Verify trusted keydown events for typed characters
    const log = await activePage.locator('#log').textContent();
    expect(log).toContain('keydown:a:trusted');
    expect(log).toContain('keydown:b:trusted');
  });
});

test.describe('--debugger press', () => {
  test('produces trusted keydown event', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.TRUSTED_EVENTS);

    const r = bcli('press', 'Enter', '--debugger');
    expect(r).toBcliSuccess();

    // Verify the keydown event was trusted
    const log = await activePage.locator('#log').textContent();
    expect(log).toContain('keydown:Enter:trusted');
  });

  test('without --debugger produces untrusted keydown', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.TRUSTED_EVENTS);

    const r = bcli('press', 'Enter');
    expect(r).toBcliSuccess();

    const log = await activePage.locator('#log').textContent();
    expect(log).toContain('keydown:Enter:untrusted');
  });
});
