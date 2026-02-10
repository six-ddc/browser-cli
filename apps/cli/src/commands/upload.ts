import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const uploadCommand = new Command('upload')
  .description('Upload file(s) to a file input element')
  .argument('<selector>', 'CSS selector or @ref for the file input')
  .argument('<files...>', 'File path(s) to upload (supports data URLs, blob URLs, or local paths)')
  .option('--clear', 'Clear existing files before upload', false)
  .action(async (selector: string, files: string[], opts: { clear: boolean }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'upload',
      params: {
        selector,
        files: files.length === 1 ? files[0] : files,
        clear: opts.clear,
      },
    });

    if (result) {
      console.log(`Uploaded ${result.fileCount} file(s)`);
    }
  });
