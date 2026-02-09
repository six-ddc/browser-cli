import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const scrollCommand = new Command('scroll')
  .description('Scroll the page or element')
  .argument('<direction>', 'Direction: up, down, left, right')
  .option('--amount <px>', 'Scroll amount in pixels', '400')
  .option('--selector <sel>', 'Element to scroll (defaults to page)')
  .action(async (direction: string, opts: { amount: string; selector?: string }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'scroll',
      params: {
        direction: direction as 'up' | 'down' | 'left' | 'right',
        amount: parseInt(opts.amount, 10),
        selector: opts.selector,
      },
    });
    console.log('Scrolled');
  });

export const scrollIntoViewCommand = new Command('scrollintoview')
  .description('Scroll an element into view')
  .argument('<selector>', 'CSS selector or @ref')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'scrollIntoView', params: { selector } });
    console.log('Scrolled into view');
  });
