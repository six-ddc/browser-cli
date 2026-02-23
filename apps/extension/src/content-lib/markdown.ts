import type { MarkdownRawResult } from '@browser-cli/shared';

// eslint-disable-next-line @typescript-eslint/require-await -- async for caller contract
export async function handleMarkdown(): Promise<MarkdownRawResult> {
  return {
    html: document.documentElement.outerHTML,
    url: document.location.href,
  };
}
