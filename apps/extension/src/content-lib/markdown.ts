import type { MarkdownResult } from '@browser-cli/shared';
import { waitForDOMStable } from './dom-stable';

export async function handleMarkdown(): Promise<MarkdownResult> {
  await waitForDOMStable();

  const { default: Defuddle } = await import('defuddle/full');

  // Clone to avoid mutating the live page (defuddle removes elements)
  const clonedDoc = document.cloneNode(true) as Document;
  const defuddle = new Defuddle(clonedDoc, {
    url: document.location.href,
    markdown: true,
  });

  const result = await defuddle.parseAsync();

  if (!result.content) {
    throw new Error('Could not extract readable content from this page');
  }

  return {
    title: result.title || document.title,
    markdown: result.content,
    byline: result.author || null,
    excerpt: result.description || null,
  };
}
