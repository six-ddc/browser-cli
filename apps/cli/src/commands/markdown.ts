import { Command } from 'commander';
import { truncateUrl } from '@browser-cli/shared';
import type { MarkdownResult } from '@browser-cli/shared';
import { sendCommand, getRootOpts } from './shared.js';
import { wrapPageContent } from '../lib/boundaries.js';

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

export const markdownCommand = new Command('markdown')
  .description('Extract page content as clean Markdown (uses Defuddle for article extraction)')
  .action(async (_opts: Record<string, never>, cmd: Command) => {
    const result = (await sendCommand(
      cmd,
      { action: 'markdown', params: {} },
      { skipJson: true },
    )) as unknown as MarkdownResult | null;
    if (!result) return;

    result.markdown = trimMarkdownUrls(result.markdown);
    const rootOpts = getRootOpts(cmd);

    if (rootOpts.json) {
      console.log(JSON.stringify({ success: true, data: result }, null, 2));
      process.exit(0);
    }

    console.log(wrapPageContent(result.markdown));
  });
