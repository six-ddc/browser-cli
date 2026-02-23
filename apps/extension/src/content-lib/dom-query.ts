/**
 * DOM query operations: getText, getHtml, getValue, getAttribute,
 * isVisible, isEnabled, isChecked, count, boundingBox.
 */

import type { Command } from '@browser-cli/shared';
import { resolveElement, resolveElements } from './element-ref-store';

// eslint-disable-next-line @typescript-eslint/require-await -- async for caller contract
export async function handleQuery(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'getText': {
      const el = requireElement(command.params.selector);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null at runtime
      return { text: el.textContent?.trim() ?? '' };
    }
    case 'getHtml': {
      const el = requireElement(command.params.selector);
      const outer = 'outer' in command.params && command.params.outer;
      return { html: outer ? el.outerHTML : el.innerHTML };
    }
    case 'getValue': {
      const el = requireElement(command.params.selector) as HTMLInputElement;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- value may be undefined at runtime
      return { value: el.value ?? '' };
    }
    case 'getAttribute': {
      const el = requireElement(command.params.selector);
      const { attribute: attr } = command.params;
      return { value: el.getAttribute(attr) };
    }
    case 'isVisible': {
      const el = resolveElement(command.params.selector);
      if (!el) return { visible: false };
      return { visible: isElementVisible(el) };
    }
    case 'isEnabled': {
      const el = resolveElement(command.params.selector);
      if (!el) return { enabled: false };
      return { enabled: !(el as HTMLInputElement).disabled };
    }
    case 'isChecked': {
      const el = resolveElement(command.params.selector);
      if (!el) return { checked: false };
      return { checked: (el as HTMLInputElement).checked };
    }
    case 'count': {
      const elements = resolveElements(command.params.selector);
      return { count: elements.length };
    }
    case 'boundingBox': {
      const el = requireElement(command.params.selector);
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }
    default:
      throw new Error(`Unknown query command: ${(command as { action: string }).action}`);
  }
}

function requireElement(selector: string): Element {
  const el = resolveElement(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
}
