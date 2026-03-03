import type { MarkdownRawResult } from '@browser-cli/shared';
import { waitForDOMStable } from './dom-stable';

export async function handleMarkdown(): Promise<MarkdownRawResult> {
  await waitForDOMStable();
  return {
    html: document.documentElement.outerHTML,
    url: document.location.href,
  };
}
