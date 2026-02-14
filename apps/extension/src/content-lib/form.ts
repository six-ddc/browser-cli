/**
 * Form operations: check, uncheck, select.
 */

import type { Command } from '@browser-cli/shared';
import { resolveElement } from './element-ref-store';

export async function handleForm(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'check': {
      const el = requireCheckable((command.params as { selector: string }).selector);
      if (!el.checked) {
        el.checked = true;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { checked: true };
    }
    case 'uncheck': {
      const el = requireCheckable((command.params as { selector: string }).selector);
      if (el.checked) {
        el.checked = false;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { unchecked: true };
    }
    case 'select': {
      const { selector, value } = command.params as { selector: string; value: string };
      const el = resolveElement(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      if (!(el instanceof HTMLSelectElement)) {
        throw new Error(`Element is not a <select>: ${selector}`);
      }

      // Try matching by value first, then by text/label (like Playwright's selectOption)
      let matched = false;
      for (const option of el.options) {
        if (option.value === value) {
          el.value = option.value;
          matched = true;
          break;
        }
      }
      if (!matched) {
        for (const option of el.options) {
          if (option.text === value || option.label === value) {
            el.value = option.value;
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        const available = Array.from(el.options).map(o => `"${o.text}" (value="${o.value}")`).join(', ');
        throw new Error(`No option matching "${value}" in <select>. Available options: ${available}`);
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { selected: true, value: el.value };
    }
    default:
      throw new Error(`Unknown form command: ${(command as { action: string }).action}`);
  }
}

function requireCheckable(selector: string): HTMLInputElement {
  const el = resolveElement(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Element is not an <input>: ${selector}`);
  }
  if (el.type !== 'checkbox' && el.type !== 'radio') {
    throw new Error(`Element is not a checkbox or radio: ${selector}`);
  }
  return el;
}
