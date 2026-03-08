import { Command } from 'commander';
import { APP_NAME } from '@browser-cli/shared';
import { registerCommands, commandCategories } from './commands/index.js';
import { generateHelpJSON, generateHelpText } from './lib/help-generator.js';

const program = new Command()
  .name('browser-cli')
  .description(`${APP_NAME} — browser automation from the command line`)
  .version(__APP_VERSION__)
  .option('--session <sessionId>', 'Target a specific browser connection by session ID')
  .option('--tab <tabId>', 'Target a specific tab by ID (from tab list)')
  .option('--json', 'Output in JSON format')
  .option('--help-json', 'Output command reference as JSON (for AI agents)')
  .option('--help-all', 'Show all commands organized by category');

registerCommands(program);

// Handle --help-json before parse (Commander eats --help* flags)
const argv = process.argv.slice(2);
if (argv.includes('--help-json')) {
  console.log(JSON.stringify(generateHelpJSON(program, commandCategories), null, 2));
  process.exit(0);
}
if (argv.includes('--help-all')) {
  console.log(generateHelpText(program, commandCategories));
  process.exit(0);
}

program.parse();
