/**
 * Console capture via MAIN world injection.
 * Patches console.log/warn/error/info/debug in the page context
 * and relays entries back to the content script via postMessage.
 */

import type { Command, ConsoleEntry } from '@browser-cli/shared';

const CONSOLE_MSG_TYPE = 'browser-cli-console';

let entries: ConsoleEntry[] = [];
let initialized = false;

function initCapture() {
  if (initialized) return;
  initialized = true;

  // Listen for console messages from MAIN world
  window.addEventListener('message', (event) => {
    if (event.data?.type === CONSOLE_MSG_TYPE) {
      entries.push({
        level: event.data.level,
        args: event.data.args,
        timestamp: event.data.timestamp,
      });
    }
  });

  // Inject console patcher into MAIN world
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      if (window.__browserCliConsolePatched) return;
      window.__browserCliConsolePatched = true;

      const TYPE = ${JSON.stringify(CONSOLE_MSG_TYPE)};
      const levels = ['log', 'warn', 'error', 'info', 'debug'];
      const original = {};

      levels.forEach(level => {
        original[level] = console[level].bind(console);
        console[level] = function(...args) {
          original[level](...args);
          try {
            // Serialize args (handle non-serializable values)
            const serialized = args.map(arg => {
              try {
                if (typeof arg === 'object') return JSON.parse(JSON.stringify(arg));
                return arg;
              } catch {
                return String(arg);
              }
            });
            window.postMessage({
              type: TYPE,
              level: level,
              args: serialized,
              timestamp: Date.now(),
            }, '*');
          } catch {}
        };
      });
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();
}

export async function handleConsole(command: Command): Promise<unknown> {
  initCapture();

  switch (command.action) {
    case 'getConsole': {
      const { level, clear } = command.params as {
        level?: string;
        clear?: boolean;
      };

      let result = [...entries];
      if (level) {
        result = result.filter((e) => e.level === level);
      }

      if (clear) {
        entries = [];
      }

      return { entries: result };
    }
    case 'getErrors': {
      return { errors: entries.filter((e) => e.level === 'error') };
    }
    default:
      throw new Error(`Unknown console command: ${(command as { action: string }).action}`);
  }
}
