import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const waitCommand = new Command('wait')
  .description('Wait for a selector to appear')
  .argument('<selector>', 'CSS selector')
  .option('--timeout <ms>', 'Timeout in ms', '10000')
  .option('--hidden', 'Wait until hidden (not visible)')
  .action(async (selector: string, opts: { timeout: string; hidden?: boolean }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'wait',
      params: {
        selector,
        timeout: parseInt(opts.timeout, 10),
        visible: !opts.hidden,
      },
    });
    console.log(`Found: ${selector}`);
  });

export const waitForUrlCommand = new Command('waitforurl')
  .description('Wait for URL to match a pattern')
  .argument('<pattern>', 'URL regex pattern')
  .option('--timeout <ms>', 'Timeout in ms', '10000')
  .action(async (pattern: string, opts: { timeout: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'waitForUrl',
      params: {
        pattern,
        timeout: parseInt(opts.timeout, 10),
      },
    });
    if (result) console.log(result.url);
  });
