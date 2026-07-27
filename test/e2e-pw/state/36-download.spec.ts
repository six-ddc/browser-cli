import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Playwright intercepts downloads (CDP Browser.setDownloadBehavior) and saves
// them under a random artifact path, so the page's suggested filename
// ("browser-cli-sample.txt") never reaches disk here. Assert on what is real in
// this environment instead: terminal state, byte count, and source URL.
const SAMPLE_URL_PART = 'download-sample.txt';
const SAMPLE_BYTES = 84;

test.describe('download', () => {
  test('waits for a download triggered by clicking a download link', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.DOWNLOAD);

    const click = bcli('find', '#download-link', 'click');
    expect(click).toBcliSuccess();

    // A file this small usually finishes before the next CLI command lands, so
    // this exercises the "recently completed" branch of download wait; a slower
    // download exercises the in-progress branch. Both must succeed.
    await sleep(300);

    const result = bcli('download', 'wait', '--timeout', '10000');
    expect(result).toBcliSuccess();
    expect(result.stdout).toContain('complete');
    expect(result.stdout).toContain(SAMPLE_URL_PART);
    expect(result.stdout).toContain(`${SAMPLE_BYTES} bytes`);
  });

  test('download list shows the completed download', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DOWNLOAD);

    const click = bcli('find', '#download-link', 'click');
    expect(click).toBcliSuccess();

    const waited = bcli('download', 'wait', '--timeout', '10000');
    expect(waited).toBcliSuccess();

    const list = bcli('download', 'list', '--limit', '5');
    expect(list).toBcliSuccess();
    expect(list.stdout).toContain(SAMPLE_URL_PART);
    expect(list.stdout).toContain('complete');
  });

  test('download wait reports a timeout when nothing is downloading', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.HOME);

    // No download triggered, and any earlier one is well outside the 10s
    // "recently completed" lookback by the time this runs.
    await sleep(11000);

    const result = bcli('download', 'wait', '--timeout', '2000');
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('TIMEOUT');
  });
});
