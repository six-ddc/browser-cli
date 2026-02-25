import { Command } from 'commander';
import { sendCommand } from './shared.js';

const historyCmd = new Command('history')
  .description('Browse history')
  .option('--limit <n>', 'Maximum number of entries', '20')
  .action(async (opts: { limit: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'historySearch',
      params: { text: '', limit: parseInt(opts.limit, 10) },
    });
    if (result) {
      const { entries } = result;
      if (entries.length === 0) {
        console.log('No history entries');
        return;
      }
      for (const e of entries) {
        console.log(`[${e.id}] ${e.title || '(no title)'}`);
        console.log(`    ${e.url}`);
      }
    }
  });

historyCmd
  .command('search <text>')
  .description('Search browser history (use --limit before "search" to customize)')
  .action(async (text: string, _opts: unknown, cmd: Command) => {
    // --limit is on the parent command; read from there
    const parentOpts = cmd.parent?.opts<{ limit?: string }>();
    const limit = parseInt(parentOpts?.limit ?? '20', 10);
    const result = await sendCommand(cmd, {
      action: 'historySearch',
      params: { text, limit },
    });
    if (result) {
      const { entries } = result;
      if (entries.length === 0) {
        console.log('No history entries found');
        return;
      }
      for (const e of entries) {
        console.log(`[${e.id}] ${e.title || '(no title)'}`);
        console.log(`    ${e.url}`);
      }
    }
  });

export { historyCmd as historyCommand };
