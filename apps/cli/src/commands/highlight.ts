import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const highlightCommand = new Command('highlight')
  .description('Highlight an element on the page')
  .argument('<selector>', 'CSS selector or @ref')
  .option('--color <color>', 'Highlight color', '#2196F3')
  .option('--duration <ms>', 'Duration in ms', '2000')
  .action(async (selector: string, opts: { color: string; duration: string }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'highlight',
      params: {
        selector,
        color: opts.color,
        duration: parseInt(opts.duration, 10),
      },
    });
    console.log('Highlighted');
  });
