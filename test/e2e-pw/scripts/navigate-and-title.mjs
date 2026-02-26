/**
 * Navigate to the URL from TEST_SCRIPT_URL env var and return the page title.
 * The E2E test sets this env var before invoking `browser-cli script`.
 */
export default async function (browser) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  const { title } = await browser.getTitle();
  return title;
}
