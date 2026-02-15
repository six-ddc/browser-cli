/**
 * `find` command — AgentBrowser-compatible convenience for locating elements
 * and performing actions in a single command.
 *
 * Usage:
 *   find <engine> <value> <action> [action-value]
 *   find role button click
 *   find role button click --name "Submit"
 *   find text "Sign In" click
 *   find text "Sign In"                   # defaults to click
 *   find role button --name "Submit"       # defaults to click
 *   find label "Email" fill "test@test.com"
 *   find xpath "//button[@type='submit']" click
 *   find first ".item" click
 *   find last ".item" click
 *   find nth 2 ".item" click
 */

import { Command } from 'commander';
import { sendCommand } from './shared.js';

/** Semantic locator engines */
const ENGINES = ['role', 'text', 'label', 'placeholder', 'alt', 'title', 'testid', 'xpath'] as const;
type Engine = (typeof ENGINES)[number];

/** Position selectors */
const POSITION_SELECTORS = ['first', 'last', 'nth'] as const;
type PositionSelector = (typeof POSITION_SELECTORS)[number];

/** All supported actions */
const ALL_ACTIONS = new Set([
  'click', 'dblclick', 'fill', 'type', 'hover',
  'check', 'uncheck', 'select', 'press', 'clear', 'focus',
]);

interface ParsedFind {
  selector: string;
  action: string;
  actionValue?: string;
  position?: { type: PositionSelector; index?: number };
}

/**
 * Build a semantic locator string from engine, value, and options.
 */
function buildLocator(engine: Engine, value: string, opts: { name?: string; exact?: boolean }): string {
  if (engine === 'role') {
    let locator = `role=${value}`;
    const brackets: string[] = [];
    if (opts.name) brackets.push(`name="${opts.name}"`);
    if (opts.exact) brackets.push('exact');
    if (brackets.length > 0) locator += `[${brackets.join('][')}]`;
    return locator;
  }

  if (engine === 'xpath') {
    return `xpath=${value}`;
  }

  // For text-based engines: quoted value = exact match
  let locator = `${engine}=${value}`;
  if (opts.exact && !value.startsWith('"')) {
    locator = `${engine}="${value}"`;
  }
  return locator;
}

/**
 * Parse the variadic args into a structured ParsedFind.
 *
 * Patterns:
 *   <engine> <value> <action> [actionValue]
 *   first <selector> <action> [actionValue]
 *   last <selector> <action> [actionValue]
 *   nth <n> <selector> <action> [actionValue]
 */
export function parseFindArgs(args: string[], opts: { name?: string; exact?: boolean }): ParsedFind {
  if (args.length < 2) {
    throw new Error('Usage: find <engine> <value> [action] [action-value]\n  or:  find first|last <selector> [action] [action-value]\n  or:  find nth <n> <selector> [action] [action-value]');
  }

  const first = args[0];

  // Position selectors: first, last, nth
  if (first === 'first' || first === 'last') {
    const [, selector, action, ...rest] = args;
    if (!selector) {
      throw new Error(`Usage: find ${first} <selector> [action] [action-value]`);
    }
    const resolvedAction = action || 'click';
    validateAction(resolvedAction);
    return {
      selector,
      action: resolvedAction,
      actionValue: rest[0],
      position: { type: first as PositionSelector },
    };
  }

  if (first === 'nth') {
    const [, indexStr, selector, action, ...rest] = args;
    if (!indexStr || !selector) {
      throw new Error('Usage: find nth <n> <selector> [action] [action-value]');
    }
    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) {
      throw new Error(`Invalid index: ${indexStr}. Must be a non-negative integer.`);
    }
    const resolvedAction = action || 'click';
    validateAction(resolvedAction);
    return {
      selector,
      action: resolvedAction,
      actionValue: rest[0],
      position: { type: 'nth', index },
    };
  }

  // Semantic locator engines
  const engine = first as Engine;
  if (!ENGINES.includes(engine)) {
    throw new Error(`Unknown engine: "${engine}". Use one of: ${[...ENGINES, ...POSITION_SELECTORS].join(', ')}`);
  }

  const [, value, action, ...rest] = args;
  if (!value) {
    throw new Error(`Usage: find ${engine} <value> [action] [action-value]`);
  }
  const resolvedAction = action || 'click';
  validateAction(resolvedAction);

  const selector = buildLocator(engine, value, opts);
  return {
    selector,
    action: resolvedAction,
    actionValue: rest[0],
  };
}

function validateAction(action: string): void {
  if (!ALL_ACTIONS.has(action)) {
    throw new Error(`Unknown action: "${action}". Use one of: ${[...ALL_ACTIONS].join(', ')}`);
  }
}

/**
 * Build the protocol command from parsed find args.
 */
function buildCommand(parsed: ParsedFind): { action: string; params: Record<string, unknown> } {
  const { selector, action, actionValue, position } = parsed;

  switch (action) {
    case 'fill':
      if (!actionValue) throw new Error('fill requires a value: find ... fill <value>');
      return { action: 'fill', params: { selector, value: actionValue, position } };
    case 'type':
      if (!actionValue) throw new Error('type requires text: find ... type <text>');
      return { action: 'type', params: { selector, text: actionValue, delay: 0, position } };
    case 'select':
      if (!actionValue) throw new Error('select requires a value: find ... select <value>');
      return { action: 'select', params: { selector, value: actionValue, position } };
    case 'press':
      if (!actionValue) throw new Error('press requires a key: find ... press <key>');
      return { action: 'press', params: { selector, key: actionValue, position } };
    case 'click':
      return { action: 'click', params: { selector, button: 'left', position } };
    default:
      return { action, params: { selector, position } };
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
  .description('Find an element by semantic locator and perform an action')
  .argument('<args...>', 'Engine, value, optional action, and optional action-value')
  .option('--name <name>', 'Filter by accessible name (for role engine)')
  .option('--exact', 'Require exact text match')
  .action(async (args: string[], opts: { name?: string; exact?: boolean }, cmd: Command) => {
    const parsed = parseFindArgs(args, opts);
    const command = buildCommand(parsed);

    const result = await sendCommand(cmd, command as Parameters<typeof sendCommand>[1]);

    const label = ACTION_LABELS[parsed.action] || parsed.action;
    if (result && parsed.action === 'select' && result.value) {
      console.log(`${label}: ${result.value}`);
    } else {
      console.log(label);
    }
  });
