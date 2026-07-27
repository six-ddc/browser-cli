import { Command } from 'commander';
import type { ConsoleEntry } from '@browser-cli/shared';
import { sendCommand } from './shared.js';
import { logger } from '../util/logger.js';
import { wrapPageContent } from '../lib/boundaries.js';
import { formatArgStacks, formatConsoleArgs, indentStack } from '../lib/console-format.js';

function parseLimit(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) throw new Error(`--limit requires a non-negative integer, got: ${value}`);
  return n;
}

function formatEntry(entry: ConsoleEntry): string {
  const time = new Date(entry.timestamp).toLocaleTimeString();
  let line = `[${time}] [${entry.level}] ${formatConsoleArgs(entry.args)}`;
  line += formatArgStacks(entry.args);
  if (entry.level === 'pageerror') {
    if (entry.stack) {
      line += indentStack(entry.stack);
    }
    if (entry.source) {
      line += `\n    source: ${entry.source}`;
    }
  }
  return line;
}

export const consoleCommand = new Command('console')
  .description(
    'Get page console output (--level log/warn/error/info/debug/pageerror; --limit to cap results; --clear to reset buffer)',
  )
  .option('--level <level>', 'Filter by level: log, warn, error, info, debug, pageerror')
  .option('--limit <n>', 'Only return the most recent n entries', parseLimit)
  .option('--clear', 'Clear console buffer after reading')
  .action(async (opts: { level?: string; limit?: number; clear?: boolean }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'getConsole',
      params: {
        level: opts.level as 'log' | 'warn' | 'error' | 'info' | 'debug' | 'pageerror' | undefined,
        limit: opts.limit,
        clear: opts.clear,
      },
    });
    if (result) {
      const { entries, dropped } = result;
      const notice =
        dropped && dropped > 0
          ? `[truncated: ${dropped} earlier entries dropped (ring buffer holds 1000)]`
          : undefined;
      if (entries.length === 0) {
        console.log(wrapPageContent('(no console output)', notice));
      } else {
        console.log(wrapPageContent(entries.map(formatEntry).join('\n'), notice));
      }
      if (notice) {
        logger.warn(`${dropped} earlier entries dropped (ring buffer holds 1000)`);
      }
    }
  });

export const errorsCommand = new Command('errors')
  .description('Get page errors (console.error + uncaught page errors)')
  .option('--limit <n>', 'Only return the most recent n entries', parseLimit)
  .action(async (opts: { limit?: number }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'getErrors',
      params: { limit: opts.limit },
    });
    if (result) {
      const { errors } = result;
      if (errors.length === 0) {
        console.log(wrapPageContent('(no errors)'));
        return;
      }
      console.log(wrapPageContent(errors.map(formatEntry).join('\n')));
    }
  });
