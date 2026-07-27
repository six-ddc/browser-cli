/**
 * Actionability gate: a command that reports success must have reached the
 * element a user would have reached, and a command that cannot must say why.
 */

import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

test.describe('actionability — visible', () => {
  test('clicks a plain visible button', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#plain-btn');
    expect(r).toBcliSuccess();
    await expect(activePage.locator('#result')).toHaveText('clicked:plain');
  });

  test('refuses a display:none element with ELEMENT_NOT_VISIBLE', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#hidden-btn');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_NOT_VISIBLE');
    expect(r.stderr).toContain('display:none');
    await expect(activePage.locator('#result')).toHaveText('');
  });

  test('--force does not bypass the visibility check', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#hidden-btn', '--force');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_NOT_VISIBLE');
  });
});

test.describe('actionability — enabled', () => {
  test('refuses a disabled button with ELEMENT_DISABLED', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#disabled-btn');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_DISABLED');
    expect(r.stderr).toContain('--force');
    await expect(activePage.locator('#result')).toHaveText('');
  });

  test('refuses aria-disabled="true"', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#aria-disabled-btn');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_DISABLED');
    expect(r.stderr).toContain('aria-disabled');
  });

  test('refuses a control inside a disabled fieldset', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#fieldset-btn');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_DISABLED');
    expect(r.stderr).toContain('fieldset');
  });

  test('refuses filling a readonly input', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('fill', '#readonly-input', 'typed');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_DISABLED');
    expect(r.stderr).toContain('readonly');
    await expect(activePage.locator('#readonly-input')).toHaveValue('locked');
  });

  test('--force clicks a disabled aria button anyway', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#aria-disabled-btn', '--force');
    expect(r).toBcliSuccess();
    await expect(activePage.locator('#result')).toHaveText('clicked:aria');
  });
});

test.describe('actionability — occlusion', () => {
  test('refuses an element covered by a consent banner', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#covered-btn');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_OCCLUDED');
    expect(r.stderr).toContain('consent-banner');
    await expect(activePage.locator('#result')).toHaveText('');
  });

  test('succeeds once the overlay is dismissed', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    expect(bcli('click', '#dismiss-banner')).toBcliSuccess();
    await expect(activePage.locator('#consent-banner')).toHaveCount(0);

    const r = bcli('click', '#covered-btn');
    expect(r).toBcliSuccess();
    await expect(activePage.locator('#result')).toHaveText('clicked:covered');
  });

  test('--force clicks through the overlay', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#covered-btn', '--force');
    expect(r).toBcliSuccess();
    await expect(activePage.locator('#result')).toHaveText('clicked:covered');
  });
});

test.describe('strict matching', () => {
  test('refuses an ambiguous selector and lists the candidates', async ({
    bcli,
    navigateAndWait,
    activePage,
  }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '.dupe');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('MULTIPLE_MATCHES');
    expect(r.stderr).toContain('matched 3 elements');
    expect(r.stderr).toContain('Dupe One');
    await expect(activePage.locator('#result')).toHaveText('');
  });

  test('--nth picks a specific match (1-based)', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    expect(bcli('click', '.dupe', '--nth', '2')).toBcliSuccess();
    await expect(activePage.locator('#result')).toHaveText('clicked:dupe-2');
  });

  test('--last picks the final match', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    expect(bcli('click', '.dupe', '--last')).toBcliSuccess();
    await expect(activePage.locator('#result')).toHaveText('clicked:dupe-3');
  });
});

test.describe('element refs', () => {
  test('an unregistered ref reports how many refs exist', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);
    expect(bcli('snapshot', '-i')).toBcliSuccess();

    const r = bcli('click', '@e9999');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_NOT_FOUND');
    expect(r.stderr).toContain('snapshot -i');
  });

  test('refs go stale after navigating away', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);
    expect(bcli('snapshot', '-i')).toBcliSuccess();

    await navigateAndWait(PAGES.LOGIN);

    const r = bcli('click', '@e1');
    expect(r).toBcliFailure();
    expect(r.stderr).toMatch(/STALE_REF|ELEMENT_NOT_FOUND/);
    expect(r.stderr).toContain('snapshot');
  });
});

test.describe('not found errors', () => {
  test('names the page and suggests a snapshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ACTIONABILITY);

    const r = bcli('click', '#does-not-exist');
    expect(r).toBcliFailure();
    expect(r.stderr).toContain('ELEMENT_NOT_FOUND');
    expect(r.stderr).toContain('actionability');
    expect(r.stderr).toContain('snapshot -i');
  });
});
