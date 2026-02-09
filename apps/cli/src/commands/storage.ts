import { Command } from 'commander';
import { sendCommand } from './shared.js';

const storageCmd = new Command('storage')
  .description('Page storage management (localStorage/sessionStorage)');

storageCmd
  .command('get [key]')
  .description('Get storage entries')
  .option('--area <area>', 'Storage area: local, session', 'local')
  .action(async (key: string | undefined, opts: { area: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'storageGet',
      params: { key, area: opts.area as 'local' | 'session' },
    });
    if (result) {
      const entries = result.entries as Record<string, string>;
      const keys = Object.keys(entries);
      if (keys.length === 0) {
        console.log('(empty)');
        return;
      }
      for (const k of keys) {
        const v = entries[k];
        const display = v.length > 80 ? v.substring(0, 80) + '...' : v;
        console.log(`${k}=${display}`);
      }
    }
  });

storageCmd
  .command('set <key> <value>')
  .description('Set a storage value')
  .option('--area <area>', 'Storage area: local, session', 'local')
  .action(async (key: string, value: string, opts: { area: string }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'storageSet',
      params: { key, value, area: opts.area as 'local' | 'session' },
    });
    console.log('Set');
  });

storageCmd
  .command('clear')
  .description('Clear all storage')
  .option('--area <area>', 'Storage area: local, session', 'local')
  .action(async (opts: { area: string }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'storageClear',
      params: { area: opts.area as 'local' | 'session' },
    });
    console.log('Cleared');
  });

export { storageCmd as storageCommand };
