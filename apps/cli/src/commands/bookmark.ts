import { Command } from 'commander';
import { sendCommand } from './shared.js';

const bookmarkCmd = new Command('bookmark')
  .description('Bookmark management')
  .argument('[search]', 'Search bookmarks by keyword')
  .action(async (search: string | undefined, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'bookmarkList',
      params: { query: search },
    });
    if (result) {
      const { bookmarks } = result;
      if (bookmarks.length === 0) {
        console.log('No bookmarks found');
        return;
      }
      for (const b of bookmarks) {
        console.log(`[${b.id}] ${b.title}`);
        console.log(`    ${b.url}`);
      }
    }
  });

bookmarkCmd
  .command('add <url> [title]')
  .description('Add a bookmark')
  .action(async (url: string, title: string | undefined, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'bookmarkAdd',
      params: { url, title },
    });
    if (result) console.log(`Bookmark added: [${result.id}] ${result.title}`);
  });

bookmarkCmd
  .command('remove <id>')
  .description('Remove a bookmark by ID')
  .action(async (id: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'bookmarkRemove',
      params: { id },
    });
    console.log(`Bookmark ${id} removed`);
  });

export { bookmarkCmd as bookmarkCommand };
