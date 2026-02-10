/**
 * Wait operations: wait for selector, wait for URL pattern.
 */

import type { Command } from '@browser-cli/shared';

const DEFAULT_TIMEOUT = 10_000;
const POLL_INTERVAL = 100;

export async function handleWait(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'wait': {
      const { selector, duration, timeout, visible, text, load, fn } = command.params as {
        selector?: string;
        duration?: number;
        timeout?: number;
        visible?: boolean;
        text?: string;
        load?: 'load' | 'domcontentloaded' | 'networkidle';
        fn?: string;
      };

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
        throw new Error('Provide selector, duration, text, load, or fn');
      }

      await waitForSelector(selector, {
        timeout: timeout ?? DEFAULT_TIMEOUT,
        visible: visible ?? true,
      });
      return { found: true };
    }
    case 'waitForUrl': {
      const { pattern, timeout } = command.params as {
        pattern: string;
        timeout?: number;
      };
      const url = await waitForUrl(pattern, timeout ?? DEFAULT_TIMEOUT);
      return { url };
    }
    default:
      throw new Error(`Unknown wait command: ${(command as { action: string }).action}`);
  }
}

function waitForSelector(
  selector: string,
  options: { timeout: number; visible: boolean },
): Promise<Element> {
  return new Promise((resolve, reject) => {
    // Check immediately
    const existing = checkSelector(selector, options.visible);
    if (existing) {
      resolve(existing);
      return;
    }

    // Use MutationObserver + polling
    const observer = new MutationObserver(() => {
      const el = checkSelector(selector, options.visible);
      if (el) {
        observer.disconnect();
        clearInterval(poll);
        clearTimeout(timer);
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });

    // Polling fallback (MutationObserver may miss computed style changes)
    const poll = setInterval(() => {
      const el = checkSelector(selector, options.visible);
      if (el) {
        observer.disconnect();
        clearInterval(poll);
        clearTimeout(timer);
        resolve(el);
      }
    }, POLL_INTERVAL);

    const timer = setTimeout(() => {
      observer.disconnect();
      clearInterval(poll);
      reject(new Error(`Timeout waiting for selector "${selector}" after ${options.timeout}ms`));
    }, options.timeout);
  });
}

function checkSelector(selector: string, requireVisible: boolean): Element | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  if (requireVisible && !isVisible(el)) return null;
  return el;
}

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function waitForUrl(pattern: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const regex = new RegExp(pattern);

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
      reject(new Error(`Timeout waiting for URL pattern "${pattern}" after ${timeout}ms`));
    }, timeout);
  });
}

function waitForText(text: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check immediately
    if (document.body.innerText.includes(text)) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.body.innerText.includes(text)) {
        observer.disconnect();
        clearInterval(poll);
        clearTimeout(timer);
        resolve();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const poll = setInterval(() => {
      if (document.body.innerText.includes(text)) {
        observer.disconnect();
        clearInterval(poll);
        clearTimeout(timer);
        resolve();
      }
    }, POLL_INTERVAL);

    const timer = setTimeout(() => {
      observer.disconnect();
      clearInterval(poll);
      reject(new Error(`Timeout waiting for text "${text}" after ${timeout}ms`));
    }, timeout);
  });
}

function waitForLoadState(
  state: 'load' | 'domcontentloaded' | 'networkidle',
  timeout: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for load state "${state}" after ${timeout}ms`));
    }, timeout);

    if (state === 'domcontentloaded') {
      if (document.readyState !== 'loading') {
        clearTimeout(timer);
        resolve();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      }
    } else if (state === 'load') {
      if (document.readyState === 'complete') {
        clearTimeout(timer);
        resolve();
      } else {
        window.addEventListener('load', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      }
    } else if (state === 'networkidle') {
      // Approximate networkidle: wait for load then an additional 500ms of no new requests
      const checkIdle = () => {
        clearTimeout(timer);
        // Give a small buffer after load for pending requests
        setTimeout(() => resolve(), 500);
      };

      if (document.readyState === 'complete') {
        checkIdle();
      } else {
        window.addEventListener('load', checkIdle, { once: true });
      }
    }
  });
}

function waitForFunction(expression: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const messageId = `browser-cli-waitfn-${Date.now()}-${Math.random()}`;

    const poll = setInterval(() => {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === messageId) {
          window.removeEventListener('message', handler);
          if (event.data.result) {
            clearInterval(poll);
            clearTimeout(timer);
            resolve();
          }
        }
      };
      window.addEventListener('message', handler);

      // Inject evaluation into MAIN world
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            const __result = !!(${expression});
            window.postMessage({ type: ${JSON.stringify(messageId)}, result: __result }, '*');
          } catch(e) {
            window.postMessage({ type: ${JSON.stringify(messageId)}, result: false }, '*');
          }
        })();
      `;
      document.documentElement.appendChild(script);
      script.remove();
    }, POLL_INTERVAL);

    const timer = setTimeout(() => {
      clearInterval(poll);
      reject(new Error(`Timeout waiting for function "${expression}" after ${timeout}ms`));
    }, timeout);
  });
}
