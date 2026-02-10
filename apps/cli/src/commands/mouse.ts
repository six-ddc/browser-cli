import { Command } from 'commander';
import { sendCommand } from './shared.js';

const mouseCmd = new Command('mouse')
  .description('Low-level mouse control');

mouseCmd
  .command('move <x> <y>')
  .description('Move mouse to coordinates')
  .action(async (x: string, y: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'mouseMove',
      params: { x: parseFloat(x), y: parseFloat(y) },
    });
    console.log(`Mouse moved to (${x}, ${y})`);
  });

mouseCmd
  .command('down [button]')
  .description('Press mouse button down')
  .action(async (button: string | undefined, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'mouseDown',
      params: { button: (button as 'left' | 'right' | 'middle') || undefined },
    });
    console.log('Mouse down');
  });

mouseCmd
  .command('up [button]')
  .description('Release mouse button')
  .action(async (button: string | undefined, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'mouseUp',
      params: { button: (button as 'left' | 'right' | 'middle') || undefined },
    });
    console.log('Mouse up');
  });

mouseCmd
  .command('wheel <deltaY> [deltaX]')
  .description('Scroll mouse wheel')
  .action(async (deltaY: string, deltaX: string | undefined, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'mouseWheel',
      params: {
        deltaY: parseFloat(deltaY),
        deltaX: deltaX ? parseFloat(deltaX) : undefined,
      },
    });
    console.log('Mouse wheel scrolled');
  });

export { mouseCmd as mouseCommand };
