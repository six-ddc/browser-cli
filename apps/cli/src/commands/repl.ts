import { Command } from 'commander';
import { createInterface } from 'node:readline';
import { BatchRunner } from '../lib/batch-runner.js';
import { fail, getRootOpts } from './shared.js';
import { logger } from '../util/logger.js';

export const replCommand = new Command('repl')
  .description('Interactive session — one CLI command per line over a single persistent connection')
  .option('--json', 'Emit one NDJSON result per command instead of plain output')
  .action(async (opts: { json?: boolean }, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);
    const asJson = opts.json ?? rootOpts.json ?? false;

    let tabId: number | undefined;
    if (rootOpts.tab) {
      tabId = Number(rootOpts.tab);
      if (Number.isNaN(tabId)) {
        fail(
          cmd,
          'INVALID_ARGS',
          `Invalid --tab value "${rootOpts.tab}" — must be a numeric tab ID`,
          "Run 'tab list' to see the open tab IDs.",
        );
      }
    }

    const runner = new BatchRunner({ sessionId: rootOpts.session, tabId });
    await runner.connect();

    const interactive = process.stdin.isTTY;
    const rl = createInterface({ input: process.stdin, terminal: interactive });
    if (interactive) {
      logger.info("browser-cli repl — one command per line, 'exit' or Ctrl-D to quit");
      process.stdout.write('> ');
    }

    let lineNumber = 0;
    for await (const raw of rl) {
      lineNumber++;
      const text = raw.trim();
      if (text === 'exit' || text === 'quit') break;
      if (text.length === 0 || text.startsWith('#')) {
        if (interactive) process.stdout.write('> ');
        continue;
      }

      const result = await runner.run(text, lineNumber);
      if (asJson) {
        process.stdout.write(JSON.stringify(result) + '\n');
      } else {
        if (result.output) process.stdout.write(result.output + '\n');
        if (result.error) {
          logger.error(`Error [${result.error.code}]: ${result.error.message}`);
          if (result.error.hint) logger.error(`  hint: ${result.error.hint}`);
        }
      }
      if (interactive) process.stdout.write('> ');
    }

    rl.close();
    runner.disconnect();
  });
