import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const waitCommand = new Command('wait')
  .description('Wait for a selector, duration, URL, text, load state, or function')
  .argument('[selectorOrMs]', 'CSS selector or duration in ms')
  .option('--timeout <ms>', 'Timeout in ms (for selector/URL wait)', '10000')
  .option('--hidden', 'Wait until hidden (not visible)')
  .option('--url <pattern>', 'Wait for URL to match pattern')
  .option('--text <text>', 'Wait for text content to appear on page')
  .option('--load [state]', 'Wait for load state (load/domcontentloaded/networkidle)')
  .option('--fn <expression>', 'Wait for JS function to return truthy')
  .action(
    async (
      selectorOrMs: string | undefined,
      opts: {
        timeout: string;
        hidden?: boolean;
        url?: string;
        text?: string;
        load?: string | boolean;
        fn?: string;
      },
      cmd: Command,
    ) => {
      const timeout = parseInt(opts.timeout, 10);

      // URL wait mode
      if (opts.url) {
        const result = await sendCommand(cmd, {
          action: 'waitForUrl',
          params: { pattern: opts.url, timeout },
        });
        if (result) console.log(result.url);
        return;
      }

      // Text wait mode
      if (opts.text) {
        await sendCommand(cmd, {
          action: 'wait',
          params: { text: opts.text, timeout },
        });
        console.log(`Found text: ${opts.text}`);
        return;
      }

      // Load state wait mode
      if (opts.load !== undefined) {
        const load = (typeof opts.load === 'string' ? opts.load : 'load') as
          | 'load'
          | 'domcontentloaded'
          | 'networkidle';
        await sendCommand(cmd, {
          action: 'wait',
          params: { load, timeout },
        });
        console.log(`Load state: ${load}`);
        return;
      }

      // Function wait mode
      if (opts.fn) {
        await sendCommand(cmd, {
          action: 'wait',
          params: { fn: opts.fn, timeout },
        });
        console.log('Function condition met');
        return;
      }

      if (!selectorOrMs) {
        console.error('Error: Provide a selector, duration (ms), or --url/--text/--load/--fn');
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
          timeout,
          visible: !opts.hidden,
        },
      });
      console.log(`Found: ${selectorOrMs}`);
    },
  );

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
