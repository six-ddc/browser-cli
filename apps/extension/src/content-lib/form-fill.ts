/**
 * Batched form fill: one protocol round-trip drives many fields, picking
 * fill / check / uncheck / select per control type.
 */

import { BrowserCliError, protocolError } from '@browser-cli/shared';
import type { Command, FormFillFieldResult, FormFillResult } from '@browser-cli/shared';
import { requireActionable } from './actionability';
import { handleInteraction } from './dom-interact';
import { handleForm } from './form';

type FieldValue = string | boolean | number;

/** Which primitive a control type maps to. */
function primitiveFor(el: Element): 'fill' | 'check' | 'select' {
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    return 'check';
  }
  return 'fill';
}

function isTruthy(value: FieldValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return !['', 'false', '0', 'no', 'off', 'unchecked'].includes(value.trim().toLowerCase());
}

export async function handleFormFill(command: Command): Promise<FormFillResult> {
  if (command.action !== 'formFill') {
    throw new Error(`Unknown form-fill command: ${(command as { action: string }).action}`);
  }
  const { fields, force, continueOnError } = command.params;

  const results: FormFillFieldResult[] = [];
  let failed = 0;

  for (const field of fields) {
    const { selector } = field;
    const value = field.value as FieldValue;
    try {
      const el = requireActionable(selector, undefined, { force, skipOcclusion: true });
      const primitive = primitiveFor(el);

      if (primitive === 'select') {
        await handleForm({ action: 'select', params: { selector, value: String(value), force } });
        results.push({ selector, action: 'select', value: String(value) });
      } else if (primitive === 'check') {
        const shouldCheck = isTruthy(value);
        await handleForm({
          action: shouldCheck ? 'check' : 'uncheck',
          params: { selector, force },
        });
        results.push({
          selector,
          action: shouldCheck ? 'check' : 'uncheck',
          value: String(shouldCheck),
        });
      } else {
        await handleInteraction({
          action: 'fill',
          params: { selector, value: String(value), force },
        });
        results.push({ selector, action: 'fill', value: String(value) });
      }
    } catch (err) {
      failed++;
      const structured =
        err instanceof BrowserCliError
          ? err.toProtocolError()
          : protocolError('UNKNOWN', (err as Error).message);
      if (!continueOnError) {
        throw new BrowserCliError(
          structured.code,
          `Field "${selector}" failed after ${results.length} of ${fields.length} fields: ${structured.message}`,
          structured.hint ??
            'Fields before this one were already applied. Fix the selector and re-run, or pass --continue-on-error to apply the rest.',
        );
      }
      results.push({ selector, value: String(value), error: structured });
    }
  }

  return { fields: results, filled: results.length - failed, failed };
}
