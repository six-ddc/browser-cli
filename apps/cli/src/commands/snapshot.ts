import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const snapshotCommand = new Command('snapshot')
  .description('Get accessibility snapshot of the page')
  .option('--interactive', 'Only show interactive elements')
  .option('--compact', 'Compact output')
  .option('--depth <n>', 'Max tree depth')
  .action(async (opts: { interactive?: boolean; compact?: boolean; depth?: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'snapshot',
      params: {
        interactive: opts.interactive,
        compact: opts.compact,
        depth: opts.depth ? parseInt(opts.depth, 10) : undefined,
      },
    });
    if (result) {
      console.log(result.snapshot);
      console.error(`\n(${result.refCount} interactive elements)`);
    }
  });
