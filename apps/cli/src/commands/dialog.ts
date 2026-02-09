import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const dialogCommand = new Command('dialog')
  .description('Handle page dialogs (alert, confirm, prompt)');

dialogCommand
  .command('accept')
  .description('Auto-accept the next dialog (confirm → true, prompt → text)')
  .argument('[text]', 'Text to enter for prompt dialogs')
  .action(async (text: string | undefined, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'dialogAccept', params: { text } });
    console.log('Dialog will be auto-accepted');
  });

dialogCommand
  .command('dismiss')
  .description('Auto-dismiss the next dialog (confirm → false, prompt → null)')
  .action(async (_opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'dialogDismiss', params: {} });
    console.log('Dialog will be auto-dismissed');
  });
