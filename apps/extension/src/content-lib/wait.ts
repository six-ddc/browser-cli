/**
 * Wait operations: wait for selector, wait for URL pattern.
 */

import { BrowserCliError, type Command } from '@browser-cli/shared';
import { resolveElements } from './element-ref-store';
import { isElementVisible } from './visibility';

const DEFAULT_TIMEOUT = 10_000;
const POLL_INTERVAL = 100;
const NETWORK_IDLE_WINDOW = 500;

export async function handleWait(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'wait': {
      const { selector, duration, timeout, visible, text, load, fn } = command.params;

      // Duration-based wait (simple time delay)
      if (duration !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, duration));
        return { found: true };
      }

      // Text wait mode
      if (text !== undefined) {
        await waitForText(text, timeout ?? DEFAULT_TIMEOUT);
        return { found: true };
      }

      // Load state wait mode
      if (load !== undefined) {
        await waitForLoadState(load, timeout ?? DEFAULT_TIMEOUT);
        return { found: true };
      }

      // Function wait mode
      if (fn !== undefined) {
        await waitForFunction(fn, timeout ?? DEFAULT_TIMEOUT);
        return { found: true };
      }

      // Selector-based wait
      if (!selector) {
        throw new BrowserCliError(
          'INVALID_ARGS',
          'wait requires one of: selector, duration, text, load, or fn.',
          'Use `wait <selector>`, `wait <ms>`, `wait --text <s>`, `wait --load <state>` or `wait --fn <expr>`.',
        );
      }

      const shouldBeVisible = visible ?? true;
      if (shouldBeVisible) {
        await waitForSelector(selector, timeout ?? DEFAULT_TIMEOUT);
        return { found: true };
      }
      await waitForHidden(selector, timeout ?? DEFAULT_TIMEOUT);
      return { found: false, hidden: true };
    }
    case 'waitForUrl': {
      const { pattern, timeout } = command.params;
      const url = await waitForUrl(pattern, timeout ?? DEFAULT_TIMEOUT);
      return { url };
    }
    default:
      throw new Error(`Unknown wait command: ${(command as { action: string }).action}`);
  }
}

function waitForSelector(selector: string, timeout: number): Promise<void> {
  return pollUntil(
    () => findVisible(selector) !== null,
    timeout,
    () =>
      new BrowserCliError(
        'TIMEOUT',
        `Timeout waiting for selector "${selector}" to become visible after ${timeout}ms. ${describeSelectorState(selector)}`,
        "Run 'snapshot -i' to see what is actually on the page, or raise --timeout if the page is just slow.",
      ),
  );
}

/** `--hidden`: satisfied when no match exists, or every match is invisible. */
function waitForHidden(selector: string, timeout: number): Promise<void> {
  return pollUntil(
    () => findVisible(selector) === null,
    timeout,
    () =>
      new BrowserCliError(
        'TIMEOUT',
        `Timeout waiting for "${selector}" to become hidden after ${timeout}ms — it is still visible.`,
        'Trigger whatever removes or hides it first, or raise --timeout.',
      ),
  );
}

function findVisible(selector: string): Element | null {
  return resolveElements(selector).find((el) => isElementVisible(el)) ?? null;
}

function describeSelectorState(selector: string): string {
  const total = resolveElements(selector).length;
  if (total === 0) return 'No element matches the selector.';
  return `${total} element(s) match the selector but none are visible.`;
}

/**
 * Poll a predicate with a MutationObserver fast path.
 * Resolves as soon as it holds, rejects with `makeError()` on timeout.
 */
function pollUntil(
  predicate: () => boolean,
  timeout: number,
  makeError: () => Error,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (predicate()) {
      resolve();
      return;
    }

    const finish = (fn: () => void) => {
      observer.disconnect();
      clearInterval(poll);
      clearTimeout(timer);
      fn();
    };

    const check = () => {
      if (predicate()) finish(resolve);
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
      characterData: true,
    });

    // Polling fallback (MutationObserver may miss computed style changes)
    const poll = setInterval(check, POLL_INTERVAL);

    const timer = setTimeout(() => {
      finish(() => reject(makeError()));
    }, timeout);
  });
}

function waitForUrl(pattern: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const regex = patternToRegex(pattern);

    // Check immediately
    if (regex.test(location.href)) {
      resolve(location.href);
      return;
    }

    const poll = setInterval(() => {
      if (regex.test(location.href)) {
        clearInterval(poll);
        clearTimeout(timer);
        resolve(location.href);
      }
    }, POLL_INTERVAL);

    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(
        new BrowserCliError(
          'TIMEOUT',
          `Timeout waiting for URL pattern "${pattern}" after ${timeout}ms. Current URL: ${location.href}`,
          'Check the pattern (globs are matched as substrings, e.g. `**/secure*`), or raise --timeout.',
        ),
      );
    }, timeout);
  });
}

function waitForText(text: string, timeout: number): Promise<void> {
  return pollUntil(
    () => document.body.textContent.includes(text),
    timeout,
    () =>
      new BrowserCliError(
        'TIMEOUT',
        `Timeout waiting for text "${text}" after ${timeout}ms.`,
        "Confirm the exact wording with 'markdown' or 'get text body'; the match is case-sensitive and substring-based.",
      ),
  );
}

function waitForLoadState(
  state: 'load' | 'domcontentloaded' | 'networkidle',
  timeout: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        new BrowserCliError(
          'TIMEOUT',
          `Timeout waiting for load state "${state}" after ${timeout}ms (document.readyState=${document.readyState}).`,
          state === 'networkidle'
            ? 'The page keeps issuing requests (polling, analytics, streaming). Wait for a concrete element instead: `wait <selector>`.'
            : 'Raise --timeout, or wait for a concrete element instead: `wait <selector>`.',
        ),
      );
    }, timeout);

    if (state === 'domcontentloaded') {
      if (document.readyState !== 'loading') {
        done();
      } else {
        document.addEventListener('DOMContentLoaded', done, { once: true });
      }
      return;
    }

    if (state === 'load') {
      if (document.readyState === 'complete') {
        done();
      } else {
        window.addEventListener('load', done, { once: true });
      }
      return;
    }

    // networkidle: after load, require a quiet window with no new resource entries.
    // The overall timeout stays armed until the quiet window is actually observed.
    const waitForQuiet = () => {
      if (settled) return;
      let lastActivity = performance.now();

      let observer: PerformanceObserver | undefined;
      try {
        observer = new PerformanceObserver(() => {
          lastActivity = performance.now();
        });
        observer.observe({ type: 'resource', buffered: false });
      } catch {
        // PerformanceObserver unavailable — fall back to a fixed quiet period
        observer = undefined;
      }

      const idlePoll = setInterval(() => {
        if (settled) {
          clearInterval(idlePoll);
          observer?.disconnect();
          return;
        }
        if (performance.now() - lastActivity >= NETWORK_IDLE_WINDOW) {
          clearInterval(idlePoll);
          observer?.disconnect();
          done();
        }
      }, POLL_INTERVAL);
    };

    if (document.readyState === 'complete') {
      waitForQuiet();
    } else {
      window.addEventListener('load', waitForQuiet, { once: true });
    }
  });
}

function waitForFunction(expression: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      void (async () => {
        try {
          // Use background script to evaluate in MAIN world (bypasses CSP)
          const response: { result?: unknown } | undefined = await browser.runtime.sendMessage({
            type: 'browser-cli-eval-in-main',
            expression: `!!(${expression})`,
          });
          if (response?.result) {
            clearInterval(poll);
            clearTimeout(timer);
            resolve();
          }
        } catch {
          // Ignore errors during polling
        }
      })();
    }, POLL_INTERVAL);

    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(
        new BrowserCliError(
          'TIMEOUT',
          `Timeout waiting for function "${expression}" to return truthy after ${timeout}ms.`,
          "Verify the expression with 'eval' first — it is evaluated in the page's MAIN world and errors during polling are swallowed.",
        ),
      );
    }, timeout);
  });
}

/**
 * Convert a pattern to a RegExp. Supports:
 * - Glob patterns (containing `*` or `**`): `**` → `.*`, `*` → `[^/]*`
 * - Regular expressions (passed through as-is if valid regex)
 */
function patternToRegex(pattern: string): RegExp {
  // If it looks like a glob pattern (contains unescaped * or **), convert to regex
  if (pattern.includes('*')) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars (except *)
      .replace(/\*\*/g, '\0') // placeholder for **
      .replace(/\*/g, '[^/]*') // * → match non-slash
      .replace(/\0/g, '.*'); // ** → match anything
    return new RegExp(escaped);
  }
  // Otherwise treat as regex
  return new RegExp(pattern);
}
