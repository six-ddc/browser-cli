import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const snapshotCommand = new Command('snapshot')
  .description(
    'Get accessibility tree snapshot (-i interactive, -c compact, -C cursor, -d depth, -s selector, -f role filter)',
  )
  .option('-i, --interactive', 'Only show interactive elements')
  .option('-c, --compact', 'Compact output')
  .option('-C, --cursor', 'Include cursor-interactive elements (cursor:pointer)')
  .option('-d, --depth <n>', 'Max tree depth')
  .option('-s, --selector <selector>', 'Scope snapshot to a specific element')
  .option('-f, --filter <role>', 'Only show nodes with this ARIA role (and their ancestors)')
  .action(
    async (
      opts: {
        interactive?: boolean;
        compact?: boolean;
        cursor?: boolean;
        depth?: string;
        selector?: string;
        filter?: string;
      },
      cmd: Command,
    ) => {
      const result = await sendCommand(cmd, {
        action: 'snapshot',
        params: {
          interactive: opts.interactive,
          compact: opts.compact,
          cursor: opts.cursor,
          depth: opts.depth ? parseInt(opts.depth, 10) : undefined,
          selector: opts.selector,
          filter: opts.filter,
        },
      });
      if (result) {
        console.log(result.snapshot);
        console.error(`\n(${result.refCount} interactive elements)`);
      }
    },
  );
