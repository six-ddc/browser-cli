/**
 * Multi-step form interaction: navigate → fill fields → verify → click.
 * Tests sequential command execution through the script SDK.
 * The E2E test sets TEST_SCRIPT_URL to the login page URL.
 *
 * NOTE: We don't wait after click because the form submit triggers a page
 * navigation which unloads the content script — any subsequent SDK call
 * would fail with a channel-closed error. The test verifies the multi-step
 * sequence and the click's success output instead.
 */
export default async function (browser) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  await browser.fill({ selector: '#username', value: 'tomsmith' });
  await browser.fill({ selector: '#password', value: 'SuperSecretPassword!' });
  // Verify the fills worked before submitting
  const { value: user } = await browser.getValue({ selector: '#username' });
  const { value: pass } = await browser.getValue({ selector: '#password' });
  await browser.click({ selector: 'button[type="submit"]' });
  return { user, pass, submitted: true };
}
