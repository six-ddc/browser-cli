import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { sendCommand } from './shared.js';

/** Simple MIME type lookup by extension */
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.csv': 'text/csv',
    '.xml': 'application/xml',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.webm': 'video/webm',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export const uploadCommand = new Command('upload')
  .description('Upload file(s) to a file input element')
  .argument('<selector>', 'CSS selector or @ref for the file input')
  .argument('<files...>', 'File path(s) to upload (supports data URLs, blob URLs, or local paths)')
  .option('--clear', 'Clear existing files before upload', false)
  .action(async (selector: string, files: string[], opts: { clear: boolean }, cmd: Command) => {
    // Convert local file paths to data URLs so the extension can access them
    const resolvedFiles = files.map((f) => {
      // Already a data URL or blob URL — pass through
      if (f.startsWith('data:') || f.startsWith('blob:')) return f;

      // Local file path — read and convert to data URL
      const absPath = resolve(f);
      if (!existsSync(absPath)) {
        console.error(`Error: File not found: ${absPath}`);
        process.exit(1);
      }
      const content = readFileSync(absPath);
      const mimeType = getMimeType(absPath);
      const fileName = basename(absPath);
      const base64 = content.toString('base64');
      return `data:${mimeType};name=${encodeURIComponent(fileName)};base64,${base64}`;
    });

    const result = await sendCommand(cmd, {
      action: 'upload',
      params: {
        selector,
        files: resolvedFiles.length === 1 ? (resolvedFiles[0] ?? resolvedFiles) : resolvedFiles,
        clear: opts.clear,
      },
    });

    if (result) {
      console.log(`Uploaded ${result.fileCount} file(s)`);
    }
  });
