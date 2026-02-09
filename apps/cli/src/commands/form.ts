import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const checkCommand = new Command('check')
  .description('Check a checkbox or radio button')
  .argument('<selector>', 'CSS selector or @ref')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'check', params: { selector } });
    console.log('Checked');
  });

export const uncheckCommand = new Command('uncheck')
  .description('Uncheck a checkbox')
  .argument('<selector>', 'CSS selector or @ref')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'uncheck', params: { selector } });
    console.log('Unchecked');
  });

export const selectCommand = new Command('select')
  .description('Select an option in a dropdown')
  .argument('<selector>', 'CSS selector or @ref')
  .argument('<value>', 'Option value to select')
  .action(async (selector: string, value: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'select', params: { selector, value } });
    if (result) console.log(`Selected: ${result.value}`);
  });
