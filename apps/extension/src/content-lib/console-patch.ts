/**
 * Console + page-error capture, patched directly into the MAIN world.
 *
 * IMPORTANT: `installConsoleCapture` must stay fully self-contained. It is
 * used two ways:
 *   1. As the `main()` of a MAIN-world content script (Chrome, Firefox MV3).
 *   2. Stringified via `installConsoleCapture.toString()` and eval'd in the
 *      page's MAIN world as a fallback (Firefox MV2 / CSP-restricted pages).
 * For (2) to work, the function body must not reference any module-scope
 * variable, import, or TypeScript type alias — only globals and things it
 * declares itself.
 */

declare global {
  interface Window {
    __browserCliConsolePatched?: boolean;
    __browserCliConsoleEntries?: unknown[];
    __browserCliConsoleRead?: (
      level?: string,
      limit?: number,
      clear?: boolean,
    ) => { entries: unknown[]; dropped: number };
  }
}

export function installConsoleCapture(): void {
  if (window.__browserCliConsolePatched) return;
  window.__browserCliConsolePatched = true;

  interface BufferEntry {
    level: string;
    args: unknown[];
    timestamp: number;
    stack?: string;
    source?: string;
  }

  const MAX_ENTRIES = 1000;
  const buffer: BufferEntry[] = [];
  let dropped = 0;

  // Kept for backward compatibility with older eval-based readers.
  window.__browserCliConsoleEntries = buffer;

  function truncate(value: string): string {
    if (value.length > 2000) {
      return value.slice(0, 2000) + '…[truncated]';
    }
    return value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function serializeArg(arg: any): unknown {
    if (arg instanceof Error) {
      return {
        __error: true,
        name: arg.name,
        message: truncate(arg.message),
        stack: arg.stack,
      };
    }
    if (typeof arg === 'string') {
      return truncate(arg);
    }
    if (arg !== null && typeof arg === 'object') {
      try {
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return String(arg);
      }
    }
    return arg;
  }

  function pushEntry(entry: BufferEntry): void {
    buffer.push(entry);
    if (buffer.length > MAX_ENTRIES) {
      buffer.shift();
      dropped += 1;
    }
  }

  const levels: Array<'log' | 'warn' | 'error' | 'info' | 'debug'> = [
    'log',
    'warn',
    'error',
    'info',
    'debug',
  ];

  levels.forEach((level) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = console[level].bind(console) as (...args: any[]) => void;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console[level] = function (...args: any[]) {
      original(...args);
      try {
        const serialized = args.map(serializeArg);
        pushEntry({ level, args: serialized, timestamp: Date.now() });
      } catch {
        // ignore serialization failures
      }
    };
  });

  window.addEventListener('error', (event) => {
    try {
      const stack = event.error && event.error.stack ? String(event.error.stack) : undefined;
      const source = event.filename
        ? `${event.filename}:${String(event.lineno)}:${String(event.colno)}`
        : undefined;
      pushEntry({
        level: 'pageerror',
        args: [event.message],
        timestamp: Date.now(),
        stack,
        source,
      });
    } catch {
      // ignore
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason: unknown = event.reason;
      let message: string;
      let stack: string | undefined;
      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else {
        try {
          message = JSON.stringify(reason);
        } catch {
          message = String(reason);
        }
      }
      pushEntry({
        level: 'pageerror',
        args: ['Unhandled promise rejection: ' + message],
        timestamp: Date.now(),
        stack,
      });
    } catch {
      // ignore
    }
  });

  window.__browserCliConsoleRead = (level?: string, limit?: number, clear?: boolean) => {
    let result = buffer.slice();
    if (level) {
      result = result.filter((e) => e.level === level);
    }
    if (typeof limit === 'number' && limit >= 0) {
      result = result.slice(Math.max(0, result.length - limit));
    }
    const out = { entries: result, dropped };
    if (clear) {
      buffer.length = 0;
      dropped = 0;
    }
    return out;
  };
}
