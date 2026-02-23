import { Command } from 'commander';
import { sendCommand } from './shared.js';

const frameCmd = new Command('frame')
  .description('Frame management (switch between main page and iframes)')
  .argument('[selectorOrKeyword]', 'Selector to switch to iframe, or "main" to return to top frame')
  .action(async (selectorOrKeyword: string | undefined, _opts: unknown, cmd: Command) => {
    if (!selectorOrKeyword) {
      frameCmd.help();
      return;
    }

    // "main" keyword switches to main frame
    if (selectorOrKeyword === 'main') {
      const result = await sendCommand(cmd, {
        action: 'switchFrame',
        params: { main: true },
      });
      if (result) {
        const frameInfo = result.frame as {
          index: number;
          name: string | null;
          src: string;
          isMainFrame: boolean;
          isSameOrigin: boolean;
        };
        console.log('Switched to main frame');
        console.log(`URL: ${frameInfo.src}`);
      }
      return;
    }

    // Otherwise it's a selector — switch to that iframe
    const result = await sendCommand(cmd, {
      action: 'switchFrame',
      params: { selector: selectorOrKeyword },
    });

    if (result) {
      const frameInfo = result.frame as {
        index: number;
        name: string | null;
        src: string;
        isMainFrame: boolean;
        isSameOrigin: boolean;
      };
      console.log(`Switched to frame #${frameInfo.index}`);
      if (frameInfo.name) console.log(`Name: ${frameInfo.name}`);
      console.log(`URL: ${frameInfo.src}`);
      console.log(`Same-origin: ${frameInfo.isSameOrigin ? 'Yes' : 'No'}`);
      if (!frameInfo.isSameOrigin) {
        console.log('\nWarning: Cross-origin frame - automation capabilities limited');
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
        frames: Array<{
          index: number;
          name: string | null;
          src: string;
          isMainFrame: boolean;
          isSameOrigin: boolean;
        }>;
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
        frame: {
          index: number;
          name: string | null;
          src: string;
          isMainFrame: boolean;
          isSameOrigin: boolean;
        };
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

export { frameCmd as frameCommand };
