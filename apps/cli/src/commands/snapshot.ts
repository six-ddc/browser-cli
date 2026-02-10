import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const snapshotCommand = new Command('snapshot')
  .description('Get accessibility snapshot of the page')
  .option('-i, --interactive', 'Only show interactive elements')
  .option('-c, --compact', 'Compact output')
  .option('-d, --depth <n>', 'Max tree depth')
  .option('-s, --selector <selector>', 'Scope snapshot to a specific element')
  .action(async (opts: { interactive?: boolean; compact?: boolean; depth?: string; selector?: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'snapshot',
      params: {
        interactive: opts.interactive,
        compact: opts.compact,
        depth: opts.depth ? parseInt(opts.depth, 10) : undefined,
        selector: opts.selector,
      },
    });
    if (result) {
      console.log(result.snapshot);
      console.error(`\n(${result.refCount} interactive elements)`);
    }
  });
