import type { MarkdownRawResult } from '@browser-cli/shared';

export async function handleMarkdown(): Promise<MarkdownRawResult> {
  return {
    html: document.documentElement.outerHTML,
    url: document.location.href,
  };
}
