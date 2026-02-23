import { Command } from 'commander';
import { Defuddle } from 'defuddle/node';
import { truncateUrl } from '@browser-cli/shared';
import type { MarkdownRawResult } from '@browser-cli/shared';
import { sendCommand, getRootOpts } from './shared.js';

/** Truncate long URLs inside markdown link/image syntax */
function trimMarkdownUrls(md: string): string {
  // [text](url) and ![alt](url) — match the URL inside parens
  return md.replace(
    /(!?\[[^\]]*\])\((https?:\/\/[^)]+)\)/g,
    (_match, bracket: string, url: string) => {
      const trimmed = truncateUrl(url);
      return `${bracket}(${trimmed})`;
    },
  );
}

async function extractMarkdown(raw: MarkdownRawResult) {
  const extracted = await Defuddle(raw.html, raw.url, { markdown: true });
  if (!extracted.content) {
    throw new Error('Could not extract readable content from this page');
  }
  return {
    title: extracted.title ?? '',
    markdown: trimMarkdownUrls(extracted.content),
    byline: extracted.author ?? null,
    excerpt: extracted.description ?? null,
  };
}

export const markdownCommand = new Command('markdown')
  .description('Extract page content as readable Markdown')
  .action(async (_opts: Record<string, never>, cmd: Command) => {
    const raw = (await sendCommand(
      cmd,
      { action: 'markdown', params: {} },
      { skipJson: true },
    )) as unknown as MarkdownRawResult | null;
    if (!raw) return;

    const result = await extractMarkdown(raw);
    const rootOpts = getRootOpts(cmd);

    if (rootOpts.json) {
      console.log(JSON.stringify({ success: true, data: result }, null, 2));
      process.exit(0);
    }

    console.log(result.markdown);
  });
