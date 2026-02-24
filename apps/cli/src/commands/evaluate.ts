import { Command } from 'commander';
import { sendCommand } from './shared.js';

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
  .description('Evaluate JavaScript in the page context')
  .argument('[expression]', 'JavaScript expression')
  .option('-b, --base64', 'Decode expression from base64')
  .option('--stdin', 'Read expression from stdin')
  .action(
    async (
      expression: string | undefined,
      opts: { base64?: boolean; stdin?: boolean },
      cmd: Command,
    ) => {
      if (opts.stdin) {
        expression = await readStdin();
      }

      if (!expression) {
        console.error('Error: no expression provided. Use an argument, --stdin, or pipe input.');
        process.exit(1);
      }

      if (opts.base64) {
        expression = Buffer.from(expression, 'base64').toString('utf-8');
      }

      const result = await sendCommand(cmd, {
        action: 'evaluate',
        params: {
          expression,
        },
      });
      if (result) {
        const value = result.value;
        if (typeof value === 'string') {
          console.log(value);
        } else {
          console.log(JSON.stringify(value, null, 2));
        }
      }
    },
  );
