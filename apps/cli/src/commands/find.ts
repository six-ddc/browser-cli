/**
 * `find` command — locate an element by any selector and perform an action.
 *
 * Usage:
 *   find <selector> [action] [action-value]
 *   find <selector> [action] [action-value] --first|--last|--nth <n>
 *
 * Selector can be:
 *   - CSS selector:        '#submit', '.item', 'button[type="submit"]'
 *   - Semantic locator:    'role=button[name="Submit"]', 'text=Sign In', 'label=Email'
 *   - Element ref:         @e1, @e2
 *
 * Examples:
 *   find 'role=button[name="Submit"]' click
 *   find 'text=Sign In'                      # defaults to click
 *   find 'label=Email' fill user@test.com
 *   find '#submit' click
 *   find '.item' click --nth 2
 *   find '.item' click --last
 *   find @e1 fill "hello world"
 */

import { Command } from 'commander';
import { sendCommand } from './shared.js';

/** All supported actions */
const ALL_ACTIONS = new Set([
  'click',
  'dblclick',
  'fill',
  'type',
  'hover',
  'check',
  'uncheck',
  'select',
  'press',
  'clear',
  'focus',
]);

/**
 * Build the protocol command from parsed find args.
 * Exported for unit testing.
 */
export function buildCommand(
  selector: string,
  action: string,
  actionValue: string | undefined,
  position?: { type: 'first' | 'last' | 'nth'; index?: number },
  force?: boolean,
): { action: string; params: Record<string, unknown> } {
  switch (action) {
    case 'fill':
      if (!actionValue) throw new Error('fill requires a value: find <selector> fill <value>');
      return { action: 'fill', params: { selector, value: actionValue, position, force } };
    case 'type':
      if (!actionValue) throw new Error('type requires text: find <selector> type <text>');
      return { action: 'type', params: { selector, text: actionValue, delay: 0, position, force } };
    case 'select':
      if (!actionValue) throw new Error('select requires a value: find <selector> select <value>');
      return { action: 'select', params: { selector, value: actionValue, position, force } };
    case 'press':
      if (!actionValue) throw new Error('press requires a key: find <selector> press <key>');
      return { action: 'press', params: { selector, key: actionValue, position, force } };
    case 'click':
      return { action: 'click', params: { selector, button: 'left', position, force } };
    default:
      return { action, params: { selector, position, force } };
  }
}

/** Action verb → past tense for output */
const ACTION_LABELS: Record<string, string> = {
  click: 'Clicked',
  dblclick: 'Double-clicked',
  fill: 'Filled',
  type: 'Typed',
  hover: 'Hovered',
  check: 'Checked',
  uncheck: 'Unchecked',
  select: 'Selected',
  press: 'Pressed',
  clear: 'Cleared',
  focus: 'Focused',
};

export const findCommand = new Command('find')
  .description(
    'Find by CSS/semantic locator/XPath and act (default: click; --first/--last/--nth to pick match)',
  )
  .argument(
    '<selector>',
    'CSS selector, semantic locator (text=Submit, role=button[name="X"]), or @ref',
  )
  .argument('[action]', `Action to perform: ${[...ALL_ACTIONS].join(', ')} (default: click)`)
  .argument('[value]', 'Value for fill, type, select, press actions')
  .option('--first', 'Target first matching element')
  .option('--last', 'Target last matching element')
  .option('--nth <n>', 'Target nth matching element (1-based)', (v) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < 1) throw new Error(`--nth requires a positive integer, got: ${v}`);
    return n;
  })
  .option('--force', 'Skip the disabled and occlusion checks')
  .action(
    async (
      selector: string,
      action: string | undefined,
      value: string | undefined,
      opts: { first?: boolean; last?: boolean; nth?: number; force?: boolean },
      cmd: Command,
    ) => {
      const resolvedAction = action ?? 'click';
      if (!ALL_ACTIONS.has(resolvedAction)) {
        throw new Error(
          `Unknown action: "${resolvedAction}". Use one of: ${[...ALL_ACTIONS].join(', ')}`,
        );
      }

      let position: { type: 'first' | 'last' | 'nth'; index?: number } | undefined;
      if (opts.first) position = { type: 'first' };
      else if (opts.last) position = { type: 'last' };
      else if (opts.nth !== undefined) position = { type: 'nth', index: opts.nth };

      const command = buildCommand(selector, resolvedAction, value, position, opts.force);
      const result = await sendCommand(cmd, command as Parameters<typeof sendCommand>[1]);

      const label = ACTION_LABELS[resolvedAction] || resolvedAction;
      if (result && resolvedAction === 'select' && 'value' in result && result.value) {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- result.value is a string at runtime from select action
        console.log(`${label}: ${result.value}`);
      } else {
        console.log(label);
      }
    },
  );
