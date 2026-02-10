import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const clickCommand = new Command('click')
  .description('Click an element')
  .argument('<selector>', 'CSS selector or @ref')
  .option('--button <button>', 'Mouse button: left, right, middle', 'left')
  .action(async (selector: string, opts: { button: string }, cmd: Command) => {
    await sendCommand(cmd, { action: 'click', params: { selector, button: opts.button as 'left' | 'right' | 'middle' } });
    console.log('Clicked');
  });

export const dblclickCommand = new Command('dblclick')
  .description('Double-click an element')
  .argument('<selector>', 'CSS selector or @ref')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'dblclick', params: { selector } });
    console.log('Double-clicked');
  });

export const hoverCommand = new Command('hover')
  .description('Hover over an element')
  .argument('<selector>', 'CSS selector or @ref')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'hover', params: { selector } });
    console.log('Hovered');
  });

export const fillCommand = new Command('fill')
  .description('Fill an input with a value (replaces current content)')
  .argument('<selector>', 'CSS selector or @ref')
  .argument('<value>', 'Value to fill')
  .action(async (selector: string, value: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'fill', params: { selector, value } });
    console.log('Filled');
  });

export const typeCommand = new Command('type')
  .description('Type text into an element (character by character)')
  .argument('<selector>', 'CSS selector or @ref')
  .argument('<text>', 'Text to type')
  .option('--delay <ms>', 'Delay between keystrokes in ms', '0')
  .action(async (selector: string, text: string, opts: { delay: string }, cmd: Command) => {
    const delay = parseInt(opts.delay, 10);
    await sendCommand(cmd, { action: 'type', params: { selector, text, delay } });
    console.log('Typed');
  });

export const pressCommand = new Command('press')
  .description('Press a key')
  .argument('<key>', 'Key to press (e.g., Enter, Escape, Tab)')
  .alias('key')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'press', params: { key } });
    console.log('Pressed');
  });

export const clearCommand = new Command('clear')
  .description('Clear an input field')
  .argument('<selector>', 'CSS selector or @ref')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'clear', params: { selector } });
    console.log('Cleared');
  });

export const focusCommand = new Command('focus')
  .description('Focus an element')
  .argument('<selector>', 'CSS selector or @ref')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'focus', params: { selector } });
    console.log('Focused');
  });
