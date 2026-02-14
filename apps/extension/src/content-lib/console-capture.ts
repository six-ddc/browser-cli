/**
 * Console capture via background script's chrome.scripting.executeScript.
 * Patches console.log/warn/error/info/debug in the MAIN world
 * and stores entries on window.__browserCliConsoleEntries.
 * Reads entries back via another executeScript call.
 * This approach bypasses CSP restrictions that block inline <script> injection.
 */

import type { Command, ConsoleEntry } from '@browser-cli/shared';

/**
 * Initialize the console patcher in the MAIN world via background script.
 * Sends a message to the background to use chrome.scripting.executeScript.
 */
async function ensurePatched(): Promise<void> {
  // Check if already patched by reading the flag from MAIN world
  const checkResponse = await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: '!!window.__browserCliConsolePatched',
  });

  if (checkResponse?.result) return;

  // Inject the console patcher into MAIN world
  await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: `(function() {
      if (window.__browserCliConsolePatched) return;
      window.__browserCliConsolePatched = true;
      window.__browserCliConsoleEntries = [];

      var levels = ['log', 'warn', 'error', 'info', 'debug'];
      var original = {};

      levels.forEach(function(level) {
        original[level] = console[level].bind(console);
        console[level] = function() {
          var args = Array.prototype.slice.call(arguments);
          original[level].apply(console, args);
          try {
            var serialized = args.map(function(arg) {
              try {
                if (typeof arg === 'object') return JSON.parse(JSON.stringify(arg));
                return arg;
              } catch(e) {
                return String(arg);
              }
            });
            window.__browserCliConsoleEntries.push({
              level: level,
              args: serialized,
              timestamp: Date.now(),
            });
          } catch(e) {}
        };
      });
    })()`,
  });
}

/**
 * Read console entries from the MAIN world via background script.
 */
async function readEntries(level?: string, clear?: boolean): Promise<ConsoleEntry[]> {
  const expr = clear
    ? `(function() {
        var entries = window.__browserCliConsoleEntries || [];
        window.__browserCliConsoleEntries = [];
        return entries;
      })()`
    : `window.__browserCliConsoleEntries || []`;

  const response = await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: `JSON.stringify(${expr})`,
  });

  let entries: ConsoleEntry[] = [];
  try {
    entries = JSON.parse(response?.result || '[]');
  } catch {
    entries = [];
  }

  if (level) {
    entries = entries.filter((e: ConsoleEntry) => e.level === level);
  }

  return entries;
}

export async function handleConsole(command: Command): Promise<unknown> {
  await ensurePatched();

  switch (command.action) {
    case 'getConsole': {
      const { level, clear } = command.params as {
        level?: string;
        clear?: boolean;
      };

      const entries = await readEntries(level, clear);
      return { entries };
    }
    case 'getErrors': {
      const entries = await readEntries('error');
      return { errors: entries };
    }
    default:
      throw new Error(`Unknown console command: ${(command as { action: string }).action}`);
  }
}
