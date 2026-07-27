import type { Command } from 'commander';

// Lifecycle
import { startCommand, stopCommand, statusCommand, listCommand } from './lifecycle.js';
// Navigation
import { navigateCommand, backCommand, forwardCommand, reloadCommand } from './navigate.js';
// Interaction
import {
  clickCommand,
  dblclickCommand,
  hoverCommand,
  fillCommand,
  typeCommand,
  pressCommand,
  clearCommand,
  focusCommand,
  keydownCommand,
  keyupCommand,
} from './interact.js';
// Drag
import { dragCommand } from './drag.js';
// Mouse
import { mouseCommand } from './mouse.js';
// Window
import { windowCommand } from './window.js';
// Browser Config
import { setCommand } from './set.js';
// Form
import { checkCommand, uncheckCommand, selectCommand, formCommand } from './form.js';
import { uploadCommand } from './upload.js';
// Scroll
import { scrollCommand, scrollIntoViewCommand } from './scroll.js';
// Data queries
import { getCommand, isCommand } from './query.js';
// Snapshot
import { snapshotCommand } from './snapshot.js';
// Screenshot
import { screenshotCommand } from './screenshot.js';
// Wait
import { waitCommand, waitForUrlCommand } from './wait.js';
// Evaluate
import { evalCommand } from './evaluate.js';
// Console
import { consoleCommand, errorsCommand } from './console.js';
// Debugging
import { cdpCommand } from './cdp.js';
import { downloadCommand } from './download.js';
import { logsCommand } from './logs.js';
import { doctorCommand } from './doctor.js';
// Tabs
import { tabCommand } from './tab.js';
// Cookies
import { cookiesCommand } from './cookies.js';
// Storage
import { storageCommand } from './storage.js';
// Dialog
import { dialogCommand } from './dialog.js';
// Highlight
import { highlightCommand } from './highlight.js';
// Frame
import { frameCommand } from './frame.js';
// Network
import { networkCommand } from './network.js';
// State
import { stateCommand } from './state.js';
// Find
import { findCommand } from './find.js';
// Markdown
import { markdownCommand } from './markdown.js';
// Bookmarks
import { bookmarkCommand } from './bookmark.js';
// History
import { historyCommand } from './history.js';
// Container
import { containerCommand } from './container.js';
// Script
import { scriptCommand } from './script.js';
// Verify
import { verifyCommand } from './verify.js';
// Batch / REPL
import { batchCommand } from './batch.js';
import { replCommand } from './repl.js';
// MCP
import { mcpCommand } from './mcp.js';

/**
 * Single source of truth for command registration AND categorization.
 * help-generator.ts reads this directly — no separate category list to maintain.
 *
 * To add a new command: import it, then add it to the appropriate category below.
 */
export const commandCategories: Array<{ name: string; commands: Command[] }> = [
  { name: 'Lifecycle', commands: [startCommand, stopCommand, statusCommand, listCommand] },
  { name: 'Navigation', commands: [navigateCommand, backCommand, forwardCommand, reloadCommand] },
  {
    name: 'Interaction',
    commands: [
      clickCommand,
      dblclickCommand,
      hoverCommand,
      fillCommand,
      typeCommand,
      pressCommand,
      clearCommand,
      focusCommand,
      keydownCommand,
      keyupCommand,
      dragCommand,
    ],
  },
  { name: 'Mouse', commands: [mouseCommand] },
  {
    name: 'Form',
    commands: [checkCommand, uncheckCommand, selectCommand, formCommand, uploadCommand],
  },
  { name: 'Scroll', commands: [scrollCommand, scrollIntoViewCommand] },
  { name: 'Data Queries', commands: [getCommand, isCommand] },
  { name: 'Snapshot', commands: [snapshotCommand] },
  { name: 'Screenshot', commands: [screenshotCommand] },
  { name: 'Wait', commands: [waitCommand, waitForUrlCommand] },
  { name: 'Evaluate', commands: [evalCommand] },
  { name: 'Console', commands: [consoleCommand, errorsCommand] },
  { name: 'Debugging', commands: [cdpCommand, logsCommand, doctorCommand] },
  { name: 'Downloads', commands: [downloadCommand] },
  { name: 'Tabs', commands: [tabCommand] },
  { name: 'Cookies', commands: [cookiesCommand] },
  { name: 'Storage', commands: [storageCommand] },
  { name: 'Dialog', commands: [dialogCommand] },
  { name: 'Highlight', commands: [highlightCommand] },
  { name: 'Frame', commands: [frameCommand] },
  { name: 'Network', commands: [networkCommand] },
  { name: 'Window', commands: [windowCommand] },
  { name: 'Browser Config', commands: [setCommand] },
  { name: 'State', commands: [stateCommand] },
  { name: 'Find', commands: [findCommand] },
  { name: 'Markdown', commands: [markdownCommand] },
  { name: 'Bookmarks', commands: [bookmarkCommand] },
  { name: 'History', commands: [historyCommand] },
  { name: 'Container', commands: [containerCommand] },
  { name: 'Script', commands: [scriptCommand] },
  { name: 'Verify', commands: [verifyCommand] },
  { name: 'Batch', commands: [batchCommand, replCommand] },
  { name: 'MCP', commands: [mcpCommand] },
];

export function registerCommands(program: Command): void {
  for (const category of commandCategories) {
    for (const cmd of category.commands) {
      program.addCommand(cmd);
    }
  }
}
