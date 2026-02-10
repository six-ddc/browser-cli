import { Command } from 'commander';
import { sendCommand } from './shared.js';

const frameCmd = new Command('frame')
  .description('Frame management (switch between main page and iframes)');

frameCmd
  .command('switch')
  .description('Switch to an iframe')
  .option('-s, --selector <selector>', 'CSS selector to find the iframe')
  .option('-n, --name <name>', 'Frame name attribute')
  .option('-u, --url <url>', 'Frame URL (partial match)')
  .option('-i, --index <index>', 'Frame index (0-based)', parseInt)
  .option('-m, --main', 'Switch to main/top frame')
  .action(async (opts: { selector?: string; name?: string; url?: string; index?: number; main?: boolean }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'switchFrame',
      params: {
        selector: opts.selector,
        name: opts.name,
        url: opts.url,
        index: opts.index,
        main: opts.main,
      },
    });

    if (result) {
      const frameInfo = result.frame as { index: number; name: string | null; src: string; isMainFrame: boolean; isSameOrigin: boolean };
      if (frameInfo.isMainFrame) {
        console.log('Switched to main frame');
        console.log(`URL: ${frameInfo.src}`);
      } else {
        console.log(`Switched to frame #${frameInfo.index}`);
        if (frameInfo.name) console.log(`Name: ${frameInfo.name}`);
        console.log(`URL: ${frameInfo.src}`);
        console.log(`Same-origin: ${frameInfo.isSameOrigin ? 'Yes' : 'No'}`);
        if (!frameInfo.isSameOrigin) {
          console.log('\nWarning: Cross-origin frame - automation capabilities limited');
        }
      }
    }
  });

frameCmd
  .command('list')
  .description('List all frames in the page')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'listFrames', params: {} });

    if (result) {
      const { currentFrame, frames } = result as {
        currentFrame: number;
        frames: Array<{ index: number; name: string | null; src: string; isMainFrame: boolean; isSameOrigin: boolean }>;
      };

      console.log(`Found ${frames.length} frame(s):\n`);

      for (const frame of frames) {
        const marker = frame.index === currentFrame ? '→' : ' ';
        const typeLabel = frame.isMainFrame ? '[MAIN]' : '[IFRAME]';
        const originLabel = frame.isSameOrigin ? '✓' : '✗';

        console.log(`${marker} ${typeLabel} Frame #${frame.index} ${originLabel}`);
        if (frame.name) console.log(`   Name: ${frame.name}`);
        console.log(`   URL: ${frame.src}`);
        console.log('');
      }

      console.log('Legend: → = current frame, ✓ = same-origin, ✗ = cross-origin');
    }
  });

frameCmd
  .command('current')
  .description('Show current frame info')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getCurrentFrame', params: {} });

    if (result) {
      const { frameIndex, frame } = result as {
        frameIndex: number;
        frame: { index: number; name: string | null; src: string; isMainFrame: boolean; isSameOrigin: boolean };
      };

      console.log(`Current frame: #${frameIndex}`);
      if (frame.isMainFrame) {
        console.log('Type: Main frame');
      } else {
        console.log('Type: Iframe');
        if (frame.name) console.log(`Name: ${frame.name}`);
        console.log(`Same-origin: ${frame.isSameOrigin ? 'Yes' : 'No'}`);
      }
      console.log(`URL: ${frame.src}`);
    }
  });

// Shortcut: browser-cli frame --main
frameCmd
  .option('-m, --main', 'Switch to main frame (shortcut)')
  .option('-s, --selector <selector>', 'Switch to iframe by selector (shortcut)')
  .option('-n, --name <name>', 'Switch to iframe by name (shortcut)')
  .option('-u, --url <url>', 'Switch to iframe by URL (shortcut)')
  .option('-i, --index <index>', 'Switch to iframe by index (shortcut)', parseInt)
  .action(async (opts: { main?: boolean; selector?: string; name?: string; url?: string; index?: number }) => {
    // If no subcommand and no options, show help
    if (!opts.main && !opts.selector && !opts.name && !opts.url && opts.index === undefined) {
      frameCmd.help();
      return;
    }

    // Otherwise, execute switch command
    const result = await sendCommand(frameCmd, {
      action: 'switchFrame',
      params: {
        selector: opts.selector,
        name: opts.name,
        url: opts.url,
        index: opts.index,
        main: opts.main,
      },
    });

    if (result) {
      const frameInfo = result.frame as { index: number; name: string | null; src: string; isMainFrame: boolean; isSameOrigin: boolean };
      if (frameInfo.isMainFrame) {
        console.log('Switched to main frame');
      } else {
        console.log(`Switched to frame #${frameInfo.index}`);
        if (frameInfo.name) console.log(`Name: ${frameInfo.name}`);
        console.log(`Same-origin: ${frameInfo.isSameOrigin ? 'Yes' : 'No'}`);
      }
      console.log(`URL: ${frameInfo.src}`);
    }
  });

export { frameCmd as frameCommand };
