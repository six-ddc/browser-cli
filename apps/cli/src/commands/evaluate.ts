import { Command } from 'commander';
import { fail, sendCommand } from './shared.js';
import { printConsoleLogs } from '../lib/script-runner.js';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += String(chunk);
    });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

export const evalCommand = new Command('eval')
  .description(
    'Evaluate JavaScript in the page context (runs in MAIN world; --stdin or -b base64 input)',
  )
  .argument('[expression]', 'JavaScript expression, or a function when --arg is used')
  .option('-b, --base64', 'Decode expression from base64')
  .option('--stdin', 'Read expression from stdin')
  .option(
    '--arg <json>',
    'JSON argument passed to the expression, which must be a function; repeatable',
    (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
  )
  .action(
    async (
      expression: string | undefined,
      opts: { base64?: boolean; stdin?: boolean; arg?: string[] },
      cmd: Command,
    ) => {
      if (opts.stdin) {
        expression = await readStdin();
      }

      if (!expression) {
        fail(
          cmd,
          'INVALID_ARGS',
          'No expression provided',
          'Pass the expression as an argument, use --stdin, or pipe it in.',
        );
      }

      if (opts.base64) {
        expression = Buffer.from(expression, 'base64').toString('utf-8');
      }

      let args: unknown[] | undefined;
      if (opts.arg?.length) {
        args = opts.arg.map((raw, i) => {
          try {
            return JSON.parse(raw) as unknown;
          } catch (err) {
            fail(
              cmd,
              'INVALID_ARGS',
              `--arg #${i + 1} is not valid JSON: ${(err as Error).message} (got: ${raw})`,
              'Each --arg is a JSON value: --arg \'"text"\' for a string, --arg 42, --arg \'{"k":1}\'.',
            );
          }
        });
      }

      const result = await sendCommand(cmd, {
        action: 'evaluate',
        params: { expression, args },
      });
      if (result) {
        // Print captured console logs to stderr
        if (result.logs && Array.isArray(result.logs)) {
          printConsoleLogs(result.logs);
        }
        const value = result.value;
        if (typeof value === 'string') {
          console.log(value);
        } else {
          console.log(JSON.stringify(value, null, 2));
        }
      }
    },
  );
