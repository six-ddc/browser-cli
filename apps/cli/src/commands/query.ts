import { Command } from 'commander';
import { sendCommand } from './shared.js';

const getCmd = new Command('get')
  .description('Get data from an element');

getCmd
  .command('text <selector>')
  .description('Get text content of an element')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getText', params: { selector } });
    if (result) console.log(result.text);
  });

getCmd
  .command('html <selector>')
  .description('Get innerHTML of an element')
  .option('--outer', 'Get outerHTML instead')
  .action(async (selector: string, opts: { outer?: boolean }, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getHtml', params: { selector, outer: opts.outer } });
    if (result) console.log(result.html);
  });

getCmd
  .command('value <selector>')
  .description('Get value of an input element')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getValue', params: { selector } });
    if (result) console.log(result.value);
  });

getCmd
  .command('attr <selector> <attribute>')
  .description('Get an attribute value')
  .action(async (selector: string, attribute: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getAttribute', params: { selector, attribute } });
    if (result) console.log(result.value ?? 'null');
  });

getCmd
  .command('url')
  .description('Get the current page URL')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getUrl', params: {} });
    if (result) console.log(result.url);
  });

getCmd
  .command('title')
  .description('Get the current page title')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getTitle', params: {} });
    if (result) console.log(result.title);
  });

getCmd
  .command('count <selector>')
  .description('Count matching elements')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'count', params: { selector } });
    if (result) console.log(result.count);
  });

getCmd
  .command('box <selector>')
  .description('Get bounding box of an element')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'boundingBox', params: { selector } });
    if (result) console.log(`x=${result.x} y=${result.y} w=${result.width} h=${result.height}`);
  });

export { getCmd as getCommand };

// is commands
const isCmd = new Command('is')
  .description('Check element state');

isCmd
  .command('visible <selector>')
  .description('Check if an element is visible')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'isVisible', params: { selector } });
    if (result) console.log(result.visible);
  });

isCmd
  .command('enabled <selector>')
  .description('Check if an element is enabled')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'isEnabled', params: { selector } });
    if (result) console.log(result.enabled);
  });

isCmd
  .command('checked <selector>')
  .description('Check if a checkbox/radio is checked')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'isChecked', params: { selector } });
    if (result) console.log(result.checked);
  });

export { isCmd as isCommand };
