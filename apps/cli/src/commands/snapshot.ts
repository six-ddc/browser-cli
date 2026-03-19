import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { sendCommand, getRootOpts } from './shared.js';
import { logger } from '../util/logger.js';
import { stripRefs, formatUnifiedDiff } from '@browser-cli/shared';

export const snapshotCommand = new Command('snapshot')
  .description(
    'Get accessibility tree snapshot (-i interactive, -c compact, -C cursor, -d depth, -s selector, -f role filter)',
  )
  .option('-i, --interactive', 'Only show interactive elements')
  .option('-c, --compact', 'Compact output')
  .option('-C, --cursor', 'Include cursor-interactive elements (cursor:pointer)')
  .option('-d, --depth <n>', 'Max tree depth')
  .option('-s, --selector <selector>', 'Scope snapshot to a specific element')
  .option('-f, --filter <role>', 'Only show nodes with this ARIA role (and their ancestors)')
  .option('--save <path>', 'Save snapshot baseline to file (refs stripped, still prints output)')
  .option('--base <path>', 'Diff current snapshot against saved baseline (unified diff output)')
  .action(
    async (
      opts: {
        interactive?: boolean;
        compact?: boolean;
        cursor?: boolean;
        depth?: string;
        selector?: string;
        filter?: string;
        save?: string;
        base?: string;
      },
      cmd: Command,
    ) => {
      if (opts.save && opts.base) {
        logger.error('Cannot use --save and --base together');
        process.exit(1);
      }

      const snapshotParams = {
        interactive: opts.interactive,
        compact: opts.compact,
        cursor: opts.cursor,
        depth: opts.depth ? parseInt(opts.depth, 10) : undefined,
        selector: opts.selector,
        filter: opts.filter,
      };

      // --- Diff mode ---
      if (opts.base) {
        let baseline: string;
        try {
          baseline = readFileSync(opts.base, 'utf-8');
        } catch {
          logger.error(`Failed to read baseline file: ${opts.base}`);
          process.exit(1);
        }

        // Take new snapshot (skipJson so --json doesn't exit early)
        const result = await sendCommand(
          cmd,
          { action: 'snapshot', params: snapshotParams },
          { skipJson: true },
        );
        if (!result) return;

        const oldLines = baseline.trimEnd().split('\n');
        const newLines = result.snapshot.split('\n');
        const strippedNewLines = stripRefs(result.snapshot).split('\n');

        const { diff, summary } = formatUnifiedDiff({
          oldLabel: opts.base,
          oldLines,
          newLines,
          strippedNewLines,
          refCount: result.refCount,
        });

        const rootOpts = getRootOpts(cmd);
        if (rootOpts.json) {
          console.log(JSON.stringify({ diff, summary, refCount: result.refCount }, null, 2));
        } else if (diff) {
          console.log(diff);
          console.error(
            `\n(${summary.added} added, ${summary.removed} removed, ${summary.changed} changed; ${result.refCount} interactive elements)`,
          );
        } else {
          console.error('No changes detected.');
        }
        return;
      }

      // --- Normal / Save mode ---
      const result = await sendCommand(cmd, {
        action: 'snapshot',
        params: snapshotParams,
      });
      if (!result) return;

      console.log(result.snapshot);
      console.error(`\n(${result.refCount} interactive elements)`);

      if (opts.save) {
        writeFileSync(opts.save, stripRefs(result.snapshot) + '\n');
        logger.success(`Baseline saved to ${opts.save}`);
      }
    },
  );
