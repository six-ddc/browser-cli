import type { Command } from 'commander';

// Lifecycle
import { startCommand, stopCommand, closeCommand, statusCommand } from './lifecycle.js';
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
import { checkCommand, uncheckCommand, selectCommand } from './form.js';
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

export function registerCommands(program: Command): void {
  // Lifecycle
  program.addCommand(startCommand);
  program.addCommand(stopCommand);
  program.addCommand(closeCommand);
  program.addCommand(statusCommand);

  // Navigation
  program.addCommand(navigateCommand);
  program.addCommand(backCommand);
  program.addCommand(forwardCommand);
  program.addCommand(reloadCommand);

  // Interaction
  program.addCommand(clickCommand);
  program.addCommand(dblclickCommand);
  program.addCommand(hoverCommand);
  program.addCommand(fillCommand);
  program.addCommand(typeCommand);
  program.addCommand(pressCommand);
  program.addCommand(clearCommand);
  program.addCommand(focusCommand);
  program.addCommand(keydownCommand);
  program.addCommand(keyupCommand);
  program.addCommand(dragCommand);

  // Mouse
  program.addCommand(mouseCommand);

  // Form
  program.addCommand(checkCommand);
  program.addCommand(uncheckCommand);
  program.addCommand(selectCommand);
  program.addCommand(uploadCommand);

  // Scroll
  program.addCommand(scrollCommand);
  program.addCommand(scrollIntoViewCommand);

  // Data queries
  program.addCommand(getCommand);
  program.addCommand(isCommand);

  // Snapshot
  program.addCommand(snapshotCommand);

  // Screenshot
  program.addCommand(screenshotCommand);

  // Wait
  program.addCommand(waitCommand);
  program.addCommand(waitForUrlCommand);

  // Evaluate
  program.addCommand(evalCommand);

  // Console
  program.addCommand(consoleCommand);
  program.addCommand(errorsCommand);

  // Tabs
  program.addCommand(tabCommand);

  // Cookies
  program.addCommand(cookiesCommand);

  // Storage
  program.addCommand(storageCommand);

  // Dialog
  program.addCommand(dialogCommand);

  // Highlight
  program.addCommand(highlightCommand);

  // Frame
  program.addCommand(frameCommand);

  // Network
  program.addCommand(networkCommand);

  // Window
  program.addCommand(windowCommand);

  // Browser Config
  program.addCommand(setCommand);

  // State
  program.addCommand(stateCommand);

  // Find (AgentBrowser-compatible)
  program.addCommand(findCommand);

  // Markdown
  program.addCommand(markdownCommand);
}
