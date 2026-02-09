import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { sendCommand } from './shared.js';

export const screenshotCommand = new Command('screenshot')
  .description('Capture a screenshot of the current page')
  .option('--selector <sel>', 'CSS selector for element screenshot')
  .option('--path <path>', 'Save path (default: screenshot.png)')
  .option('--format <fmt>', 'Image format: png, jpeg', 'png')
  .option('--quality <n>', 'JPEG quality 0-100')
  .action(async (opts: { selector?: string; path?: string; format: string; quality?: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'screenshot',
      params: {
        selector: opts.selector,
        format: opts.format as 'png' | 'jpeg',
        quality: opts.quality ? parseInt(opts.quality, 10) : undefined,
      },
    });
    if (result) {
      const ext = opts.format === 'jpeg' ? 'jpg' : 'png';
      const filePath = opts.path || `screenshot.${ext}`;
      const buffer = Buffer.from(result.data as string, 'base64');
      writeFileSync(filePath, buffer);
      console.log(`Screenshot saved to ${filePath} (${buffer.length} bytes)`);
    }
  });
