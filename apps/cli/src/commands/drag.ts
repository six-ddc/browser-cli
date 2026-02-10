import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const dragCommand = new Command('drag')
  .description('Drag an element to a target')
  .argument('<source>', 'Source element selector')
  .argument('<target>', 'Target element selector')
  .action(async (source: string, target: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'drag', params: { source, target } });
    console.log('Dragged');
  });
