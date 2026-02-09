import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const evalCommand = new Command('eval')
  .description('Evaluate JavaScript in the page context')
  .argument('<expression>', 'JavaScript expression')
  .action(async (expression: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'evaluate', params: { expression } });
    if (result) {
      const value = result.value;
      if (typeof value === 'string') {
        console.log(value);
      } else {
        console.log(JSON.stringify(value, null, 2));
      }
    }
  });
