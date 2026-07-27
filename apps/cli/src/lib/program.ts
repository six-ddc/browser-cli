import { Command } from 'commander';
import { APP_NAME, BrowserCliError } from '@browser-cli/shared';
import { registerCommands } from '../commands/index.js';
import { fail } from '../commands/shared.js';
import { initBoundaries } from './boundaries.js';
import { initPolicy } from './policy.js';

/**
 * Build the CLI command tree.
 *
 * `batch` and `repl` call this to get a program they can parse repeatedly:
 * Commander restores each command's option state before every parse, so one
 * instance can serve many command lines without values leaking between them.
 */
export function createProgram(): Command {
  const program = new Command()
    .name('browser-cli')
    .description(`${APP_NAME} — browser automation from the command line`)
    .version(__APP_VERSION__)
    .option('--session <sessionId>', 'Target a specific browser connection by session ID')
    .option('--tab <tabId>', 'Target a specific tab by ID (from tab list)')
    .option('--json', 'Output in JSON format')
    .option('--help-json', 'Output command reference as JSON (for AI agents)')
    .option('--help-all', 'Show all commands organized by category')
    .option(
      '--policy <file>',
      'JSON action policy restricting which actions may run (env: BROWSER_CLI_POLICY)',
    )
    .option(
      '--boundaries',
      'Wrap page-sourced output in [BOUNDARY_START:<nonce>] markers (env: BROWSER_CLI_BOUNDARIES=1)',
    );

  // Resolve both guard rails before any action runs, so a malformed policy is
  // reported up front rather than at the moment a command would have been sent.
  program.hook('preAction', (thisCommand, actionCommand) => {
    const opts = thisCommand.opts<{ policy?: string; boundaries?: boolean }>();
    initBoundaries(opts.boundaries);
    try {
      initPolicy(opts.policy);
    } catch (err) {
      if (!(err instanceof BrowserCliError)) throw err;
      fail(actionCommand, err.code, err.message, err.hint);
    }
  });

  registerCommands(program);
  return program;
}

/**
 * Make a command tree throw instead of calling process.exit, so a bad line in
 * a batch aborts only that line.
 */
export function makeNonExiting(command: Command, writeErr: (str: string) => void): void {
  command.exitOverride();
  command.configureOutput({ writeOut: writeErr, writeErr });
  for (const sub of command.commands) makeNonExiting(sub, writeErr);
}
