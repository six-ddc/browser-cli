import { Command } from 'commander';
import type { FrameDescriptor } from '@browser-cli/shared';
import { sendCommand } from './shared.js';

function printFrame(frame: FrameDescriptor): void {
  console.log(`URL: ${frame.url}`);
  if (frame.title) console.log(`Title: ${frame.title}`);
  if (frame.name) console.log(`Name: ${frame.name}`);
  if (!frame.isMainFrame) {
    console.log(`Depth: ${frame.depth}`);
    console.log(`Parent frame: ${frame.parentFrameId}`);
  }
}

const frameCmd = new Command('frame')
  .description(
    'Switch to iframe by selector or frameId, or "main" for top-level (subcommands: list, current)',
  )
  .argument(
    '[selectorOrKeyword]',
    'Selector or frameId to switch to, or "main" to return to the top frame',
  )
  .action(async (selectorOrKeyword: string | undefined, _opts: unknown, cmd: Command) => {
    if (!selectorOrKeyword) {
      frameCmd.help();
      return;
    }

    if (selectorOrKeyword === 'main') {
      const result = await sendCommand(cmd, {
        action: 'switchFrame',
        params: { main: true },
      });
      if (result) {
        console.log('Switched to main frame');
        printFrame(result.frame);
      }
      return;
    }

    // A bare integer is a frameId from `frame list` — CSS selectors never are
    const asFrameId = /^\d+$/.test(selectorOrKeyword) ? Number(selectorOrKeyword) : undefined;

    const result = await sendCommand(cmd, {
      action: 'switchFrame',
      params: asFrameId != null ? { frameId: asFrameId } : { selector: selectorOrKeyword },
    });

    if (result) {
      const { frame } = result;
      console.log(
        frame.isMainFrame ? 'Switched to main frame' : `Switched to frame ${frame.frameId}`,
      );
      printFrame(frame);
    }
  });

frameCmd
  .command('list')
  .description('List every frame in the page, including nested and cross-origin ones')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'listFrames', params: {} });
    if (!result) return;

    const { frames } = result;
    console.log(`Frames (${frames.length}):\n`);

    for (const frame of frames) {
      const marker = frame.isCurrent ? '→' : ' ';
      const indent = '  '.repeat(frame.depth);
      const tags: string[] = [];
      if (frame.isMainFrame) tags.push('main');
      if (frame.name) tags.push(`name=${frame.name}`);
      if (!frame.reachable) tags.push('unreachable');
      const suffix = tags.length > 0 ? `  (${tags.join(', ')})` : '';
      console.log(
        `${marker} [${String(frame.frameId).padStart(3)}] ${indent}${frame.url}${suffix}`,
      );
    }

    console.log(
      '\nLegend: → = current frame, indentation = nesting depth, [n] = frameId (use with `frame <n>`)',
    );
  });

frameCmd
  .command('current')
  .description('Show which frame commands are currently sent to')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getCurrentFrame', params: {} });
    if (!result) return;

    const { frame } = result;
    console.log(
      frame.isMainFrame ? 'Current frame: main frame (0)' : `Current frame: ${frame.frameId}`,
    );
    printFrame(frame);
  });

export { frameCmd as frameCommand };
