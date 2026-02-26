/**
 * Navigate and take a compact snapshot.
 * The E2E test sets TEST_SCRIPT_URL env var.
 */
export default async function (browser) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  const result = await browser.snapshot({ compact: true });
  return result;
}
