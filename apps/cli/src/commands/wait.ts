import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const waitCommand = new Command('wait')
  .description('Wait for a selector, duration, or URL pattern')
  .argument('[selectorOrMs]', 'CSS selector or duration in ms')
  .option('--timeout <ms>', 'Timeout in ms (for selector/URL wait)', '10000')
  .option('--hidden', 'Wait until hidden (not visible)')
  .option('--url <pattern>', 'Wait for URL to match pattern')
  .action(async (selectorOrMs: string | undefined, opts: { timeout: string; hidden?: boolean; url?: string }, cmd: Command) => {
    // URL wait mode
    if (opts.url) {
      const result = await sendCommand(cmd, {
        action: 'waitForUrl',
        params: {
          pattern: opts.url,
          timeout: parseInt(opts.timeout, 10),
        },
      });
      if (result) console.log(result.url);
      return;
    }

    if (!selectorOrMs) {
      console.error('Error: Provide a selector, duration (ms), or --url <pattern>');
      process.exit(1);
    }

    // Check if it's a numeric duration
    const maybeMs = parseInt(selectorOrMs, 10);
    if (!isNaN(maybeMs) && String(maybeMs) === selectorOrMs) {
      // Duration wait
      await sendCommand(cmd, {
        action: 'wait',
        params: { duration: maybeMs },
      });
      console.log(`Waited for ${maybeMs}ms`);
      return;
    }

    // Selector wait
    await sendCommand(cmd, {
      action: 'wait',
      params: {
        selector: selectorOrMs,
        timeout: parseInt(opts.timeout, 10),
        visible: !opts.hidden,
      },
    });
    console.log(`Found: ${selectorOrMs}`);
  });

// Keep waitForUrlCommand as an alias for backward compatibility
export const waitForUrlCommand = new Command('waitforurl')
  .description('Wait for URL to match a pattern (alias for wait --url)')
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
