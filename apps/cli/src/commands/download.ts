import { Command } from 'commander';
import { sendCommand } from './shared.js';

const downloadCommand = new Command('download').description(
  'Browser downloads (subcommands: list, wait)',
);

downloadCommand
  .command('list')
  .description('List recent downloads, most recent first')
  .option('--limit <n>', 'Max downloads to show')
  .option('--state <state>', 'Filter by state: in_progress, interrupted, complete')
  .action(async (opts: { limit?: string; state?: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'downloadList',
      params: {
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        state: opts.state as 'in_progress' | 'interrupted' | 'complete' | undefined,
      },
    });

    if (!result) return;

    if (result.downloads.length === 0) {
      console.log('(no downloads recorded)');
      return;
    }

    for (const d of result.downloads) {
      console.log(`#${d.id}  ${d.state}  ${d.filename}  (${d.fileSize} bytes)  ${d.url}`);
    }
  });

downloadCommand
  .command('wait')
  .description('Wait for a download to finish (defaults to the most recent/next download)')
  .option('--id <id>', 'Download id to wait on (see: download list)')
  .option('--timeout <ms>', 'Max time to wait', '30000')
  .action(async (opts: { id?: string; timeout: string }, cmd: Command) => {
    const timeout = parseInt(opts.timeout, 10);
    const result = await sendCommand(cmd, {
      action: 'downloadWait',
      params: {
        id: opts.id ? parseInt(opts.id, 10) : undefined,
        timeout,
      },
    });

    if (result) {
      const { download } = result;
      console.log(
        `${download.state}  ${download.filename}  (${download.fileSize} bytes)  ${download.url}`,
      );
      if (download.error) console.log(`error: ${download.error}`);
    }
  });

export { downloadCommand };
