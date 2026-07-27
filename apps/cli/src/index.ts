import { commandCategories } from './commands/index.js';
import { createProgram } from './lib/program.js';
import { generateHelpJSON, generateHelpText } from './lib/help-generator.js';

const program = createProgram();

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
