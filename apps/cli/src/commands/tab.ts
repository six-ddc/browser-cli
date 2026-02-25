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
  .option('--container <name>', 'Open tab in Firefox container (Firefox only)')
  .action(async (url: string | undefined, opts: { container?: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'tabNew',
      params: { url, container: opts.container },
    });
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

const tabGroupCmd = new Command('group')
  .description('Group tabs together (Chrome only)')
  .argument('<tabIds...>', 'Tab IDs to group')
  .action(async (tabIds: string[], _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'tabGroupCreate',
      params: { tabIds: tabIds.map((id) => parseInt(id, 10)) },
    });
    if (result) console.log(`Group ${result.groupId} created with ${result.tabCount} tab(s)`);
  });

tabGroupCmd
  .command('update <groupId>')
  .description('Update a tab group title, color, or collapsed state (Chrome only)')
  .option('--title <title>', 'Group title')
  .option(
    '--color <color>',
    'Group color: grey, blue, red, yellow, green, pink, purple, cyan, orange',
  )
  .option('--collapse', 'Collapse the group')
  .option('--expand', 'Expand the group')
  .action(
    async (
      groupId: string,
      opts: { title?: string; color?: string; collapse?: boolean; expand?: boolean },
      _extra: unknown,
      cmd: Command,
    ) => {
      const collapsed = opts.collapse ? true : opts.expand ? false : undefined;
      type GroupColor =
        | 'grey'
        | 'blue'
        | 'red'
        | 'yellow'
        | 'green'
        | 'pink'
        | 'purple'
        | 'cyan'
        | 'orange';
      const result = await sendCommand(cmd, {
        action: 'tabGroupUpdate',
        params: {
          groupId: parseInt(groupId, 10),
          title: opts.title,
          color: opts.color as GroupColor | undefined,
          collapsed,
        },
      });
      if (result) console.log(`Group ${result.groupId}: "${result.title ?? ''}" (${result.color})`);
    },
  );

tabCmd.addCommand(tabGroupCmd);

tabCmd
  .command('groups')
  .description('List all tab groups (Chrome only)')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'tabGroupList', params: {} });
    if (result) {
      const { groups } = result;
      if (groups.length === 0) {
        console.log('No tab groups');
        return;
      }
      for (const g of groups) {
        console.log(
          `[${g.id}] "${g.title ?? ''}" (${g.color}) — ${g.tabCount} tab(s)${g.collapsed ? ' [collapsed]' : ''}`,
        );
      }
    }
  });

tabCmd
  .command('ungroup <tabIds...>')
  .description('Remove tabs from their group (Chrome only)')
  .action(async (tabIds: string[], _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'tabUngroup',
      params: { tabIds: tabIds.map((id) => parseInt(id, 10)) },
    });
    if (result) console.log(`Removed ${result.ungrouped} tab(s) from group`);
  });

export { tabCmd as tabCommand };
