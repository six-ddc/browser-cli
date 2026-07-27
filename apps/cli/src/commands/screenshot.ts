import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { fail, getRootOpts, requireInt, sendCommand } from './shared.js';

export const screenshotCommand = new Command('screenshot')
  .description(
    'Capture a screenshot (--full for the whole page, --selector for element, --path to save, --format png/jpeg, --quality 0-100)',
  )
  .option('--selector <sel>', 'CSS selector for element screenshot')
  .option('--path <path>', 'Save path (default: screenshot.png)')
  .option('--format <fmt>', 'Image format: png, jpeg', 'png')
  .option('--quality <n>', 'JPEG quality 0-100')
  .option('--full', 'Capture the entire scrollable page, not just the viewport (Chrome only)')
  .option('--base64', 'Include the base64 image data in --json output')
  .action(
    async (
      opts: {
        selector?: string;
        path?: string;
        format: string;
        quality?: string;
        full?: boolean;
        base64?: boolean;
      },
      cmd: Command,
    ) => {
      if (opts.format !== 'png' && opts.format !== 'jpeg') {
        fail(
          cmd,
          'INVALID_ARGS',
          `--format must be png or jpeg, got: ${opts.format}`,
          'Use --format png (default) or --format jpeg.',
        );
      }
      const quality = requireInt(cmd, opts.quality, '--quality');
      if (quality !== undefined && quality > 100) {
        fail(cmd, 'INVALID_ARGS', `--quality must be 0-100, got: ${opts.quality}`);
      }

      const rootOpts = getRootOpts(cmd);
      // skipJson: the file has to be written before anything is printed, and
      // the base64 payload is far too large to put on stdout by default.
      const result = await sendCommand(
        cmd,
        {
          action: 'screenshot',
          params: { selector: opts.selector, format: opts.format, quality, full: opts.full },
        },
        { skipJson: true },
      );
      if (!result) return;

      const ext = opts.format === 'jpeg' ? 'jpg' : 'png';
      const filePath = opts.path || `screenshot.${ext}`;
      const buffer = Buffer.from(result.data, 'base64');
      writeFileSync(filePath, buffer);

      if (rootOpts.json) {
        const data: Record<string, unknown> = {
          path: filePath,
          width: result.width,
          height: result.height,
          mimeType: result.mimeType,
          bytes: buffer.length,
          fullPage: result.fullPage === true,
        };
        if (opts.base64) data.data = result.data;
        console.log(JSON.stringify({ success: true, data }, null, 2));
        return;
      }

      const dims = result.width && result.height ? `, ${result.width}x${result.height}` : '';
      console.log(`Screenshot saved to ${filePath} (${buffer.length} bytes${dims})`);
    },
  );
