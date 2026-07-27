import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { sendCommand, getRootOpts, fail, requireInt } from './shared.js';
import { logger } from '../util/logger.js';
import { stripRefs, formatUnifiedDiff } from '@browser-cli/shared';
import { wrapPageContent } from '../lib/boundaries.js';

export const snapshotCommand = new Command('snapshot')
  .description(
    'Get accessibility tree snapshot (-i interactive, -c compact, -C cursor, -d depth, -s selector, -f role filter)',
  )
  .option('-i, --interactive', 'Only show interactive elements (drops body text nodes)')
  .option('-c, --compact', 'Compact output (drop pure-structure nodes)')
  .option('-C, --cursor', 'Include cursor-interactive elements (cursor:pointer)')
  .option('-d, --depth <n>', 'Max tree depth (0 reports the page node alone)')
  .option('-s, --selector <selector>', 'Scope snapshot to a specific element')
  .option('-f, --filter <role>', 'Only show nodes with this ARIA role (and their ancestors)')
  .option('--max-chars <n>', 'Cap total output size in characters (default 40000)')
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
        maxChars?: string;
        save?: string;
        base?: string;
      },
      cmd: Command,
    ) => {
      const rootOpts = getRootOpts(cmd);

      const snapshotParams = {
        interactive: opts.interactive,
        compact: opts.compact,
        cursor: opts.cursor,
        depth: requireInt(cmd, opts.depth, '-d/--depth'),
        selector: opts.selector,
        filter: opts.filter,
        maxChars: requireInt(cmd, opts.maxChars, '--max-chars'),
      };

      // Take the snapshot once; --base and --save both operate on this result.
      // skipJson only when this command owns the output — plain `--json` keeps
      // the standard sendCommand envelope (including its error path).
      const ownsOutput = !!(opts.save ?? opts.base);
      const result = await sendCommand(
        cmd,
        { action: 'snapshot', params: snapshotParams },
        { skipJson: ownsOutput },
      );
      if (!result) return;

      const saveBaseline = () => {
        if (!opts.save) return;
        writeFileSync(opts.save, stripRefs(result.snapshot) + '\n');
      };

      // --- Diff mode: report changes against the baseline, then optionally refresh it ---
      if (opts.base) {
        let baseline: string;
        try {
          baseline = readFileSync(opts.base, 'utf-8');
        } catch {
          fail(
            cmd,
            'INVALID_ARGS',
            `Failed to read baseline file: ${opts.base}`,
            'Check the --base path, or run without --base first and save one with --save.',
          );
        }

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

        saveBaseline();

        if (rootOpts.json) {
          console.log(
            JSON.stringify(
              { diff, summary, refCount: result.refCount, ...(opts.save && { saved: opts.save }) },
              null,
              2,
            ),
          );
          return;
        }

        if (diff) {
          console.log(wrapPageContent(diff));
          console.error(
            `\n(${summary.added} added, ${summary.removed} removed, ${summary.changed} changed; ${result.refCount} interactive elements)`,
          );
        } else {
          console.error('No changes detected.');
        }
        if (opts.save) logger.success(`Baseline saved to ${opts.save}`);
        return;
      }

      // --- Normal / Save mode ---
      saveBaseline();

      if (rootOpts.json) {
        console.log(
          JSON.stringify(
            {
              success: true,
              data: { ...result, ...(opts.save && { saved: opts.save }) },
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(wrapPageContent(result.snapshot));
      console.error(`\n(${result.refCount} interactive elements)`);
      if (opts.save) logger.success(`Baseline saved to ${opts.save}`);
    },
  );
