/**
 * Return a structured object to verify JSON output.
 * The E2E test sets TEST_SCRIPT_URL env var.
 */
export default async function (browser) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  const { title } = await browser.getTitle();
  const { url } = await browser.getUrl();
  return { title, url, steps: 3 };
}
