import { Command } from 'commander';
import { APP_NAME } from '@browser-cli/shared';
import { registerCommands } from './commands/index.js';

const program = new Command()
  .name('browser-cli')
  .description(`${APP_NAME} — browser automation from the command line`)
  .version(__APP_VERSION__)
  .option('--session <sessionId>', 'Target a specific browser connection by session ID')
  .option('--tab <tabId>', 'Target a specific tab by ID (from tab list)')
  .option('--json', 'Output in JSON format');

registerCommands(program);

program.parse();
