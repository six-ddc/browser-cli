import { Command } from 'commander';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runScript, ScriptStepError } from '../lib/script-runner.js';
import { getRootOpts } from './shared.js';
import { logger } from '../util/logger.js';

/**
 * Parse raw args (from after `--`) into a key-value record.
 *   --name foo  → { name: 'foo' }
 *   --verbose   → { verbose: true }
 *   -n foo      → { n: 'foo' }
 */
function parseScriptArgs(raw: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i] as string;
    const next: string | undefined = raw[i + 1];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (next !== undefined && !next.startsWith('-')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      if (next !== undefined && !next.startsWith('-')) {
        result[key] = next;
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

export const scriptCommand = new Command('script')
  .description('Run a multi-step browser automation script')
  .argument('<file>', 'Path to script file (.js or .mjs), or "-" for stdin')
  .argument('[scriptArgs...]', 'Arguments passed to the script (use -- to separate)')
  .option('-t, --timeout <ms>', 'Per-command timeout in milliseconds')
  .option('-c, --call <name>', 'Call a named export instead of default')
  .option('-l, --list', 'List all exported functions in the script')
  .action(
    async (
      file: string,
      passedArgs: string[],
      opts: { timeout?: string; call?: string; list?: boolean },
      cmd: Command,
    ) => {
      const rootOpts = getRootOpts(cmd);
      const timeout = opts.timeout ? Number(opts.timeout) : undefined;

      if (timeout !== undefined && Number.isNaN(timeout)) {
        logger.error('Invalid --timeout value — must be a number');
        process.exit(1);
      }

      let tabId: number | undefined;
      if (rootOpts.tab) {
        tabId = Number(rootOpts.tab);
        if (Number.isNaN(tabId)) {
          logger.error(`Invalid --tab value "${rootOpts.tab}" — must be a numeric tab ID`);
          process.exit(1);
        }
      }

      // Parse script args passed after `--` (Commander puts them in passedArgs)
      const scriptArgs = parseScriptArgs(passedArgs);

      // Handle stdin: read from stdin, write to temp file, clean up after
      let scriptFile = file;
      let tmpFile: string | undefined;
      if (file === '-') {
        const source = readFileSync(0, 'utf-8');
        if (!source.trim()) {
          logger.error('No script provided on stdin');
          process.exit(1);
        }
        tmpFile = join(
          tmpdir(),
          `browser-cli-script-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
        );
        writeFileSync(tmpFile, source, 'utf-8');
        scriptFile = tmpFile;
      }

      try {
        const result = await runScript(scriptFile, {
          sessionId: rootOpts.session,
          tabId,
          timeout,
          scriptArgs,
          call: opts.call,
          list: opts.list,
        });

        if (result !== undefined && result !== null) {
          if (rootOpts.json) {
            console.log(JSON.stringify({ success: true, data: result }, null, 2));
          } else if (opts.list && Array.isArray(result)) {
            console.log((result as string[]).join(', '));
          } else if (typeof result === 'string') {
            console.log(result);
          } else {
            console.log(JSON.stringify(result, null, 2));
          }
        } else if (rootOpts.json) {
          console.log(JSON.stringify({ success: true }, null, 2));
        }
      } catch (err) {
        if (rootOpts.json) {
          const payload: Record<string, unknown> = { success: false };
          if (err instanceof ScriptStepError) {
            payload.step = err.stepIndex;
            payload.action = err.action;
            payload.params = err.params;
            payload.error = err.cause;
          } else {
            payload.error = { message: (err as Error).message };
          }
          console.log(JSON.stringify(payload, null, 2));
          process.exit(1);
        }

        if (err instanceof ScriptStepError) {
          logger.error(err.message);
        } else {
          logger.error((err as Error).message);
        }
        process.exit(1);
      } finally {
        if (tmpFile) {
          try {
            unlinkSync(tmpFile);
          } catch {
            /* ignore cleanup errors */
          }
        }
      }
    },
  );
