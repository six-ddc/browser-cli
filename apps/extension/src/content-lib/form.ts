/**
 * Form operations: check, uncheck, select.
 */

import { BrowserCliError, type Command } from '@browser-cli/shared';
import { requireActionable } from './actionability';
import { describeElement } from './element-describe';
import type { Position } from './element-ref-store';

// eslint-disable-next-line @typescript-eslint/require-await -- async for caller contract
export async function handleForm(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'check': {
      const { selector, position, force } = command.params;
      const el = requireCheckable(selector, position, force);
      if (!el.checked) {
        el.checked = true;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { checked: true };
    }
    case 'uncheck': {
      const { selector, position, force } = command.params;
      const el = requireCheckable(selector, position, force);
      if (el.checked) {
        el.checked = false;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { unchecked: true };
    }
    case 'select': {
      const { selector, value, position, force } = command.params;
      const el = requireActionable(selector, position, { force, skipOcclusion: true });
      if (!(el instanceof HTMLSelectElement)) {
        throw new BrowserCliError(
          'ELEMENT_TYPE_MISMATCH',
          `Element is not a <select>: ${selector} → ${describeElement(el)}.`,
          "For a custom (non-native) dropdown, click it open and then click the option — 'snapshot -i' after opening shows the options.",
        );
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
        const available = Array.from(el.options)
          .map((o) => `"${o.text}" (value="${o.value}")`)
          .join(', ');
        throw new BrowserCliError(
          'ELEMENT_NOT_FOUND',
          `No option matching "${value}" in <select> ${selector}. Available options: ${available}`,
          'Pass one of the listed option labels or values exactly.',
        );
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { selected: true, value: el.value };
    }
    default:
      throw new Error(`Unknown form command: ${(command as { action: string }).action}`);
  }
}

function requireCheckable(
  selector: string,
  position?: Position,
  force?: boolean,
): HTMLInputElement {
  const el = requireActionable(selector, position, { force });
  if (!(el instanceof HTMLInputElement) || (el.type !== 'checkbox' && el.type !== 'radio')) {
    throw new BrowserCliError(
      'ELEMENT_TYPE_MISMATCH',
      `Element is not a checkbox or radio input: ${selector} → ${describeElement(el)}.`,
      'For a custom toggle, use `click` instead; `check`/`uncheck` only drive native checkbox/radio inputs.',
    );
  }
  return el;
}
