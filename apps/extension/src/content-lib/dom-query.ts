/**
 * DOM query operations: getText, getHtml, getValue, getAttribute,
 * isVisible, isEnabled, isChecked, count, boundingBox.
 */

import type { Command } from '@browser-cli/shared';
import { isElementEnabled, requireElement } from './actionability';
import { resolveElement, resolveElements } from './element-ref-store';
import { isElementVisible } from './visibility';

// eslint-disable-next-line @typescript-eslint/require-await -- async for caller contract
export async function handleQuery(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'getText': {
      const el = requireElement(command.params.selector, command.params.position);
      return { text: renderedText(el) };
    }
    case 'getHtml': {
      const el = requireElement(command.params.selector, command.params.position);
      const outer = 'outer' in command.params && command.params.outer;
      return { html: outer ? el.outerHTML : el.innerHTML };
    }
    case 'getValue': {
      const el = requireElement(
        command.params.selector,
        command.params.position,
      ) as HTMLInputElement;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- value may be undefined at runtime
      return { value: el.value ?? '' };
    }
    case 'getAttribute': {
      const el = requireElement(command.params.selector, command.params.position);
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
      return { enabled: isElementEnabled(el) };
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
      const el = requireElement(command.params.selector, command.params.position);
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

/**
 * What a user would see and copy: innerText honours display:none and
 * text-transform, unlike textContent. jsdom has no innerText, so fall back.
 */
function renderedText(el: Element): string {
  const rendered: string | undefined = (el as HTMLElement).innerText;
  const raw = typeof rendered === 'string' ? rendered : el.textContent;
  return raw
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
