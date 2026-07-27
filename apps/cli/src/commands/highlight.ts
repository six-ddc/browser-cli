import { Command } from 'commander';
import { addPositionOptions, positionFrom, sendCommand, type TargetOptions } from './shared.js';

export const highlightCommand = addPositionOptions(
  new Command('highlight')
    .description('Highlight an element with a visual overlay (--color, --duration ms)')
    .argument('<selector>', 'CSS selector or @ref')
    .option('--color <color>', 'Highlight color', '#2196F3')
    .option('--duration <ms>', 'Duration in ms', '2000'),
).action(
  async (
    selector: string,
    opts: TargetOptions & { color: string; duration: string },
    cmd: Command,
  ) => {
    await sendCommand(cmd, {
      action: 'highlight',
      params: {
        selector,
        color: opts.color,
        duration: parseInt(opts.duration, 10),
        position: positionFrom(opts),
      },
    });
    console.log('Highlighted');
  },
);
