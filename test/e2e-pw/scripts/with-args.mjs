/**
 * Script that uses args passed via `--`.
 * Usage: browser-cli script with-args.mjs -- --name hello --count 3
 */
export default async function (browser, args) {
  await browser.navigate({ url: process.env.TEST_SCRIPT_URL });
  const { title } = await browser.getTitle();
  return { title, args };
}
