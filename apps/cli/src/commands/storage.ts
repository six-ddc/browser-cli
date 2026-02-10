import { Command } from 'commander';
import { sendCommand } from './shared.js';

const storageCmd = new Command('storage')
  .description('Page storage management (localStorage/sessionStorage)');

function addAreaSubcommands(parent: Command, area: 'local' | 'session'): void {
  const areaCmd = parent
    .command(area)
    .description(`${area === 'local' ? 'localStorage' : 'sessionStorage'} operations`)
    .argument('[key]', 'Key to get (omit for all entries)')
    .action(async (key: string | undefined, _opts: unknown, cmd: Command) => {
      const result = await sendCommand(cmd, {
        action: 'storageGet',
        params: { key, area },
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

  areaCmd
    .command('set <key> <value>')
    .description('Set a storage value')
    .action(async (key: string, value: string, _opts: unknown, cmd: Command) => {
      await sendCommand(cmd, {
        action: 'storageSet',
        params: { key, value, area },
      });
      console.log('Set');
    });

  areaCmd
    .command('clear')
    .description('Clear all storage')
    .action(async (_opts: unknown, cmd: Command) => {
      await sendCommand(cmd, {
        action: 'storageClear',
        params: { area },
      });
      console.log('Cleared');
    });
}

addAreaSubcommands(storageCmd, 'local');
addAreaSubcommands(storageCmd, 'session');

export { storageCmd as storageCommand };
