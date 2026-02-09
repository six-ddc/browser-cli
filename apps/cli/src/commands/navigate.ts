import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const navigateCommand = new Command('navigate')
  .alias('goto')
  .alias('open')
  .description('Navigate to a URL')
  .argument('<url>', 'URL to navigate to')
  .action(async (url: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'navigate', params: { url } });
    if (result) console.log(`${result.title}\n${result.url}`);
  });

export const backCommand = new Command('back')
  .description('Go back in browser history')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'goBack', params: {} });
    if (result) console.log(`${result.title}\n${result.url}`);
  });

export const forwardCommand = new Command('forward')
  .description('Go forward in browser history')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'goForward', params: {} });
    if (result) console.log(`${result.title}\n${result.url}`);
  });

export const reloadCommand = new Command('reload')
  .description('Reload the current page')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'reload', params: {} });
    if (result) console.log(`${result.title}\n${result.url}`);
  });

export const urlCommand = new Command('url')
  .description('Get the current page URL')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getUrl', params: {} });
    if (result) console.log(result.url);
  });

export const titleCommand = new Command('title')
  .description('Get the current page title')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getTitle', params: {} });
    if (result) console.log(result.title);
  });
