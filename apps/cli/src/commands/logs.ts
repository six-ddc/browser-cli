import { Command } from 'commander';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { getDaemonLogPath } from '../util/paths.js';
import { getRootOpts, fail, requireInt } from './shared.js';

const MAX_READ_BYTES = 5 * 1024 * 1024; // 5MB

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Read up to MAX_READ_BYTES from the end of a file and split into lines. */
function readTail(filePath: string): string[] {
  const size = statSync(filePath).size;
  const start = Math.max(0, size - MAX_READ_BYTES);
  const buf = readFileSync(filePath);
  const content = buf.subarray(start).toString('utf-8');
  const lines = content.split('\n');
  // Drop trailing empty line from a final newline
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function lastN(lines: string[], n: number): string[] {
  return n >= lines.length ? lines : lines.slice(lines.length - n);
}

export const logsCommand = new Command('logs')
  .description('Show daemon log output')
  .option('-n, --lines <n>', 'Number of lines to show', '100')
  .option('-f, --follow', 'Follow log output (poll for new lines)')
  .action(async (opts: { lines: string; follow?: boolean }, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);
    const n = requireInt(cmd, opts.lines, '-n/--lines', { min: 1 }) ?? 100;
    const path = getDaemonLogPath();

    if (opts.follow && rootOpts.json) {
      fail(
        cmd,
        'INVALID_ARGS',
        '--follow cannot be used with --json',
        'Drop --json when using --follow, or drop --follow to get a single JSON snapshot.',
      );
    }

    if (!existsSync(path)) {
      if (rootOpts.json) {
        console.log(JSON.stringify({ success: true, data: { path, lines: [] } }));
        return;
      }
      console.log(`No daemon log yet at ${path}. Start the daemon with: browser-cli start`);
      return;
    }

    if (opts.follow) {
      // Print existing tail first, then poll for growth.
      const lines = readTail(path);
      const initial = lastN(lines, Number.isNaN(n) ? 100 : n);
      for (const line of initial) console.log(line);

      let offset = statSync(path).size;
      const state = { stopped: false };
      const onStop = () => {
        state.stopped = true;
      };
      process.on('SIGINT', onStop);
      process.on('SIGTERM', onStop);

      while (!state.stopped) {
        await sleep(300);
        if (!existsSync(path)) continue;
        const size = statSync(path).size;
        if (size < offset) {
          // File was rotated/truncated — re-read from the start.
          offset = 0;
        }
        if (size > offset) {
          const buf = readFileSync(path);
          const chunk = buf.subarray(offset).toString('utf-8');
          offset = size;
          const chunkLines = chunk.split('\n');
          if (chunkLines[chunkLines.length - 1] === '') chunkLines.pop();
          for (const line of chunkLines) console.log(line);
        }
      }
      return;
    }

    const lines = readTail(path);
    const selected = lastN(lines, Number.isNaN(n) ? 100 : n);

    if (rootOpts.json) {
      console.log(JSON.stringify({ success: true, data: { path, lines: selected } }));
      return;
    }

    for (const line of selected) console.log(line);
  });
