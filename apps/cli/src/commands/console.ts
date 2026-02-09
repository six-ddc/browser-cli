import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const consoleCommand = new Command('console')
  .description('Get page console output')
  .option('--level <level>', 'Filter by level: log, warn, error, info, debug')
  .option('--clear', 'Clear console buffer after reading')
  .action(async (opts: { level?: string; clear?: boolean }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'getConsole',
      params: {
        level: opts.level as 'log' | 'warn' | 'error' | 'info' | 'debug' | undefined,
        clear: opts.clear,
      },
    });
    if (result) {
      const entries = result.entries as Array<{ level: string; args: unknown[]; timestamp: number }>;
      if (entries.length === 0) {
        console.log('(no console output)');
        return;
      }
      for (const entry of entries) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const args = entry.args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        console.log(`[${time}] [${entry.level}] ${args}`);
      }
    }
  });

export const errorsCommand = new Command('errors')
  .description('Get page error output')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getErrors', params: {} });
    if (result) {
      const errors = result.errors as Array<{ level: string; args: unknown[]; timestamp: number }>;
      if (errors.length === 0) {
        console.log('(no errors)');
        return;
      }
      for (const entry of errors) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const args = entry.args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        console.log(`[${time}] ${args}`);
      }
    }
  });
