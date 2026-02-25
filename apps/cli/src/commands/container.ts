import { Command } from 'commander';
import { sendCommand } from './shared.js';

const containerCmd = new Command('container').description(
  'Manage Firefox containers (Firefox only)',
);

containerCmd
  .command('list')
  .description('List all containers')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'containerList', params: {} });
    if (result) {
      if (result.containers.length === 0) {
        console.log('No containers');
        return;
      }
      for (const c of result.containers) {
        console.log(`[${c.cookieStoreId}] ${c.name} (${c.color}, ${c.icon})`);
      }
    }
  });

containerCmd
  .command('create <name>')
  .description('Create a new container')
  .option('--color <color>', 'Color: blue turquoise green yellow orange red pink purple', 'blue')
  .option(
    '--icon <icon>',
    'Icon: fingerprint briefcase dollar cart circle gift vacation food fruit pet tree chill fence',
    'circle',
  )
  .action(async (name: string, opts: { color: string; icon: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'containerCreate',
      params: { name, color: opts.color, icon: opts.icon },
    });
    if (result) console.log(`Created: ${result.name} (${result.color}, ${result.icon})`);
  });

containerCmd
  .command('remove <name>')
  .description('Remove a container')
  .action(async (name: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'containerRemove', params: { name } });
    console.log(`Removed container: ${name}`);
  });

export { containerCmd as containerCommand };
