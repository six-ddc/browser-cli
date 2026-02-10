/**
 * Wait operations: wait for selector, wait for URL pattern.
 */

import type { Command } from '@browser-cli/shared';

const DEFAULT_TIMEOUT = 10_000;
const POLL_INTERVAL = 100;

export async function handleWait(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'wait': {
      const { selector, duration, timeout, visible } = command.params as {
        selector?: string;
        duration?: number;
        timeout?: number;
        visible?: boolean;
      };

      // Duration-based wait (simple time delay)
      if (duration !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, duration));
        return { found: true };
      }

      // Selector-based wait
      if (!selector) {
        throw new Error('Either selector or duration must be provided');
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
