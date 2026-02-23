import { Command } from 'commander';
import { sendCommand } from './shared.js';

const tabCmd = new Command('tab')
  .description('Tab management')
  .argument('[tabId]', 'Tab ID to switch to (or subcommand)')
  .action(async (tabId: string | undefined, _opts: unknown, cmd: Command) => {
    // If tabId is a number, switch to that tab
    if (tabId && !isNaN(parseInt(tabId, 10))) {
      const result = await sendCommand(cmd, {
        action: 'tabSwitch',
        params: { tabId: parseInt(tabId, 10) },
      });
      if (result) console.log(`Switched to tab ${result.tabId}: ${result.title}`);
      return;
    }

    // Default: list tabs (when no args or unrecognized arg)
    if (!tabId) {
      const result = await sendCommand(cmd, { action: 'tabList', params: {} });
      if (result) {
        const { tabs } = result;
        for (const tab of tabs) {
          const marker = tab.active ? '→' : ' ';
          console.log(`${marker} [${tab.id}] ${tab.title}`);
          console.log(`   ${tab.url}`);
        }
      }
    }
  });

tabCmd
  .command('new [url]')
  .description('Open a new tab')
  .action(async (url: string | undefined, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'tabNew', params: { url } });
    if (result) console.log(`Tab ${result.tabId}: ${result.url}`);
  });

tabCmd
  .command('list')
  .description('List all tabs')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'tabList', params: {} });
    if (result) {
      const tabs = result.tabs as Array<{
        id: number;
        url: string;
        title: string;
        active: boolean;
      }>;
      for (const tab of tabs) {
        const marker = tab.active ? '→' : ' ';
        console.log(`${marker} [${tab.id}] ${tab.title}`);
        console.log(`   ${tab.url}`);
      }
    }
  });

tabCmd
  .command('close [tabId]')
  .description('Close a tab (defaults to active)')
  .action(async (tabId: string | undefined, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'tabClose',
      params: { tabId: tabId ? parseInt(tabId, 10) : undefined },
    });
    console.log('Tab closed');
  });

export { tabCmd as tabCommand };
