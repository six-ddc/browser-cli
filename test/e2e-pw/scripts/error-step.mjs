/**
 * Click a nonexistent selector to trigger a step error.
 * The E2E test sets TEST_SCRIPT_URL env var.
 */
export default async function (browser) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  // This should fail — no such element
  await browser.click({ selector: '#nonexistent-element-xyz' });
}
