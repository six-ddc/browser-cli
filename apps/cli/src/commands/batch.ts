import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { EXIT_FAILURE } from '@browser-cli/shared';
import { BatchRunner, parseBatchInput } from '../lib/batch-runner.js';
import { fail, getRootOpts } from './shared.js';

export const batchCommand = new Command('batch')
  .description(
    'Run many CLI commands over one connection — one command per line, from a file or stdin ("-")',
  )
  .argument('[file]', 'File of command lines; omit or "-" to read stdin')
  .option('--fail-fast', 'Stop at the first failing command')
  .action(async (file: string | undefined, opts: { failFast?: boolean }, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);

    let input: string;
    try {
      input = readFileSync(!file || file === '-' ? 0 : file, 'utf-8');
    } catch (err) {
      fail(
        cmd,
        'INVALID_ARGS',
        `Failed to read commands from ${file && file !== '-' ? file : 'stdin'}: ${(err as Error).message}`,
        'Pass a readable file path, or pipe the commands in on stdin.',
      );
    }

    const lines = parseBatchInput(input);
    if (lines.length === 0) {
      fail(
        cmd,
        'INVALID_ARGS',
        'No commands to run',
        'Provide one CLI command per line; blank lines and # comments are ignored.',
      );
    }

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

    let failed = 0;
    try {
      for (const { line, text } of lines) {
        const result = await runner.run(text, line);
        process.stdout.write(JSON.stringify(result) + '\n');
        if (!result.success) {
          failed++;
          if (opts.failFast) break;
        }
      }
    } finally {
      runner.disconnect();
    }

    if (failed > 0) process.exit(EXIT_FAILURE);
  });
