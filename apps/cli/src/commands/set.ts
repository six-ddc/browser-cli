import { Command } from 'commander';
import { sendCommand } from './shared.js';

const setCmd = new Command('set').description('Browser configuration');

setCmd
  .command('viewport <width> <height>')
  .description('Set browser viewport size')
  .action(async (width: string, height: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'setViewport',
      params: { width: parseInt(width, 10), height: parseInt(height, 10) },
    });
    if (result) console.log(`Viewport set to ${result.width}x${result.height}`);
  });

setCmd
  .command('geo <latitude> <longitude>')
  .description('Override geolocation')
  .allowUnknownOption()
  .allowExcessArguments()
  .option('--accuracy <meters>', 'Accuracy in meters', '100')
  .action(async (latitude: string, longitude: string, opts: { accuracy: string }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'setGeo',
      params: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: parseFloat(opts.accuracy),
      },
    });
    console.log(`Geolocation set to (${latitude}, ${longitude})`);
  });

setCmd
  .command('media <colorScheme>')
  .description('Override media preferences (dark/light)')
  .action(async (colorScheme: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'setMedia',
      params: { colorScheme: colorScheme as 'dark' | 'light' },
    });
    console.log(`Media color scheme set to ${colorScheme}`);
  });

setCmd
  .command('headers <json>')
  .description('Set extra HTTP request headers')
  .action(async (json: string, _opts: unknown, cmd: Command) => {
    const headers = JSON.parse(json) as Record<string, string>;
    const result = await sendCommand(cmd, {
      action: 'setHeaders',
      params: { headers },
    });
    if (result) console.log(`Set ${result.ruleCount} header rules`);
  });

export { setCmd as setCommand };
