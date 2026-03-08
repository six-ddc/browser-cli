import { Command } from 'commander';
import { sendCommand } from './shared.js';

export const clickCommand = new Command('click')
  .description('Click an element (--button right/middle; --debugger for CDP isTrusted events)')
  .argument('<selector>', 'CSS selector or @ref')
  .option('--button <button>', 'Mouse button: left, right, middle', 'left')
  .option('--debugger', 'Use Chrome DevTools Protocol for trusted events (isTrusted=true)')
  .action(async (selector: string, opts: { button: string; debugger?: true }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'click',
      params: {
        selector,
        button: opts.button as 'left' | 'right' | 'middle',
        debugger: opts.debugger || undefined,
      },
    });
    console.log('Clicked');
  });

export const dblclickCommand = new Command('dblclick')
  .description('Double-click an element (--debugger for CDP isTrusted events)')
  .argument('<selector>', 'CSS selector or @ref')
  .option('--debugger', 'Use Chrome DevTools Protocol for trusted events (isTrusted=true)')
  .action(async (selector: string, opts: { debugger?: true }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'dblclick',
      params: { selector, debugger: opts.debugger || undefined },
    });
    console.log('Double-clicked');
  });

export const hoverCommand = new Command('hover')
  .description('Hover over an element (--debugger for CDP dispatch, activates CSS :hover)')
  .argument('<selector>', 'CSS selector or @ref')
  .option('--debugger', 'Use Chrome DevTools Protocol for trusted events (isTrusted=true)')
  .action(async (selector: string, opts: { debugger?: true }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'hover',
      params: { selector, debugger: opts.debugger || undefined },
    });
    console.log('Hovered');
  });

export const fillCommand = new Command('fill')
  .description('Fill an input, replacing content (works with React/Vue; --debugger for CDP)')
  .argument('<selector>', 'CSS selector or @ref')
  .argument('<value>', 'Value to fill')
  .option('--debugger', 'Use Chrome DevTools Protocol for trusted events (isTrusted=true)')
  .action(async (selector: string, value: string, opts: { debugger?: true }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'fill',
      params: { selector, value, debugger: opts.debugger || undefined },
    });
    console.log('Filled');
  });

export const typeCommand = new Command('type')
  .description('Type text character by character (--delay ms between keys; --debugger for CDP)')
  .argument('<selector>', 'CSS selector or @ref')
  .argument('<text>', 'Text to type')
  .option('--delay <ms>', 'Delay between keystrokes in ms', '0')
  .option('--debugger', 'Use Chrome DevTools Protocol for trusted events (isTrusted=true)')
  .action(
    async (
      selector: string,
      text: string,
      opts: { delay: string; debugger?: true },
      cmd: Command,
    ) => {
      const delay = parseInt(opts.delay, 10);
      await sendCommand(cmd, {
        action: 'type',
        params: { selector, text, delay, debugger: opts.debugger || undefined },
      });
      console.log('Typed');
    },
  );

export const pressCommand = new Command('press')
  .description(
    'Press a key or combo like Enter, Tab, Control+a (alias: key; -s to target element; --debugger)',
  )
  .argument('<key>', 'Key to press (e.g., Enter, Escape, Tab)')
  .alias('key')
  .option(
    '-s, --selector <selector>',
    'Target element (CSS selector or @ref); defaults to document.activeElement',
  )
  .option('--debugger', 'Use Chrome DevTools Protocol for trusted events (isTrusted=true)')
  .action(async (key: string, opts: { selector?: string; debugger?: true }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'press',
      params: { key, selector: opts.selector, debugger: opts.debugger || undefined },
    });
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

export const keydownCommand = new Command('keydown')
  .description('Press a key down (without releasing)')
  .argument('<key>', 'Key to press down (e.g., Shift, Control)')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'keydown', params: { key } });
    console.log('Key down');
  });

export const keyupCommand = new Command('keyup')
  .description('Release a key')
  .argument('<key>', 'Key to release (e.g., Shift, Control)')
  .action(async (key: string, _opts: unknown, cmd: Command) => {
    await sendCommand(cmd, { action: 'keyup', params: { key } });
    console.log('Key up');
  });
