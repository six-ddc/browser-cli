import { Command } from 'commander';
import { APP_NAME, APP_VERSION, DEFAULT_SESSION } from '@browser-cli/shared';
import { registerCommands } from './commands/index.js';

const program = new Command()
  .name('browser-cli')
  .description(`${APP_NAME} — browser automation from the command line`)
  .version(APP_VERSION)
  .option('--session <name>', 'Daemon session name', DEFAULT_SESSION)
  .option('--json', 'Output in JSON format');

registerCommands(program);

program.parse();
