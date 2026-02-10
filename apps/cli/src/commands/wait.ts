import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const waitCommand = new Command('wait')
  .description('Wait for a selector to appear or for a duration')
  .argument('[selector]', 'CSS selector (optional if --duration is used)')
  .option('--duration <ms>', 'Time to wait in milliseconds')
  .option('--timeout <ms>', 'Timeout in ms (for selector wait)', '10000')
  .option('--hidden', 'Wait until hidden (not visible)')
  .action(async (selector: string | undefined, opts: { duration?: string; timeout: string; hidden?: boolean }, cmd: Command) => {
    // Validate that either selector or duration is provided
    if (!selector && !opts.duration) {
      console.error('Error: Either <selector> or --duration must be provided');
      process.exit(1);
    }

    const params: { selector?: string; duration?: number; timeout?: number; visible?: boolean } = {};

    if (opts.duration) {
      params.duration = parseInt(opts.duration, 10);
    } else if (selector) {
      params.selector = selector;
      params.timeout = parseInt(opts.timeout, 10);
      params.visible = !opts.hidden;
    }

    await sendCommand(cmd, {
      action: 'wait',
      params,
    });

    if (opts.duration) {
      console.log(`Waited for ${opts.duration}ms`);
    } else {
      console.log(`Found: ${selector}`);
    }
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
