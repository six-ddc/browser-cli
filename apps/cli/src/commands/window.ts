import { Command } from 'commander';
import { sendCommand } from './shared.js';

const windowCmd = new Command('window')
  .description('Window management')
  .action(async (_opts: unknown, cmd: Command) => {
    // Default: list windows
    const result = await sendCommand(cmd, { action: 'windowList', params: {} });
    if (result) {
      const { windows } = result;
      for (const win of windows) {
        const marker = win.focused ? '→' : ' ';
        console.log(`${marker} [${win.id}] ${win.type} (${win.tabs} tabs)`);
      }
    }
  });

windowCmd
  .command('new [url]')
  .description('Open a new window')
  .action(async (url: string | undefined, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'windowNew', params: { url } });
    if (result) console.log(`Window ${result.windowId}, tab ${result.tabId}: ${result.url}`);
  });

windowCmd
  .command('list')
  .description('List all windows')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'windowList', params: {} });
    if (result) {
      const { windows } = result;
      for (const win of windows) {
        const marker = win.focused ? '→' : ' ';
        console.log(`${marker} [${win.id}] ${win.type} (${win.tabs} tabs)`);
      }
    }
  });

windowCmd
  .command('close [windowId]')
  .description('Close a window (defaults to current)')
  .action(async (windowId: string | undefined, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'windowClose',
      params: { windowId: windowId ? parseInt(windowId, 10) : undefined },
    });
    console.log('Window closed');
  });

export { windowCmd as windowCommand };
