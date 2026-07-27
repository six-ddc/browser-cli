import { Command } from 'commander';
import { sendCommand, fail } from './shared.js';

const cdpCommand = new Command('cdp')
  .description('Send a raw Chrome DevTools Protocol command (Chrome only, escape hatch)')
  .argument('<method>', 'CDP method name, e.g. "Page.navigate" or "DOM.getDocument"')
  .option('--params <json>', 'JSON-encoded params object for the CDP method')
  .action(async (method: string, opts: { params?: string }, cmd: Command) => {
    let params: Record<string, unknown> | undefined;
    if (opts.params !== undefined) {
      try {
        const parsed: unknown = JSON.parse(opts.params);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('not an object');
        }
        params = parsed as Record<string, unknown>;
      } catch {
        fail(
          cmd,
          'INVALID_ARGS',
          `--params must be a JSON object, e.g. --params '{"expression":"1+1"}' (got: ${opts.params})`,
          'Pass a valid JSON object string for --params.',
        );
      }
    }

    const result = await sendCommand(cmd, {
      action: 'cdp',
      params: { method, params },
    });

    if (result) {
      console.log(JSON.stringify(result.result, null, 2));
    }
  });

export { cdpCommand };
