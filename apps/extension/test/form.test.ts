/**
 * Tests for form operations: check, uncheck, select.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleForm } from '../src/content-lib/form';
import type { Command } from '@browser-cli/shared';

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─── check ──────────────────────────────────────────────────────────

describe('check', () => {
  it('checks an unchecked checkbox', async () => {
    document.body.innerHTML = '<input id="cb" type="checkbox" />';
    const cb = document.getElementById('cb') as HTMLInputElement;
    expect(cb.checked).toBe(false);

    const result = await handleForm({
      action: 'check',
      params: { selector: '#cb' },
    } as Command);

    expect(result).toEqual({ checked: true });
    expect(cb.checked).toBe(true);
  });

  it('already checked checkbox stays checked', async () => {
    document.body.innerHTML = '<input id="cb" type="checkbox" checked />';
    const cb = document.getElementById('cb') as HTMLInputElement;
    expect(cb.checked).toBe(true);

    const result = await handleForm({
      action: 'check',
      params: { selector: '#cb' },
    } as Command);

    expect(result).toEqual({ checked: true });
    expect(cb.checked).toBe(true);
  });

  it('dispatches input and change events when checking', async () => {
    document.body.innerHTML = '<input id="cb" type="checkbox" />';
    const cb = document.getElementById('cb')!;
    const events: string[] = [];
    cb.addEventListener('input', () => events.push('input'));
    cb.addEventListener('change', () => events.push('change'));

    await handleForm({
      action: 'check',
      params: { selector: '#cb' },
    } as Command);

    expect(events).toEqual(['input', 'change']);
  });

  it('does not dispatch events if already checked', async () => {
    document.body.innerHTML = '<input id="cb" type="checkbox" checked />';
    const cb = document.getElementById('cb')!;
    const events: string[] = [];
    cb.addEventListener('input', () => events.push('input'));
    cb.addEventListener('change', () => events.push('change'));

    await handleForm({
      action: 'check',
      params: { selector: '#cb' },
    } as Command);

    expect(events).toEqual([]);
  });

  it('throws "Element not found" for missing selector', async () => {
    await expect(
      handleForm({
        action: 'check',
        params: { selector: '#nonexistent' },
      } as Command),
    ).rejects.toThrow('Element not found');
  });

  it('throws for non-checkable input (type=text)', async () => {
    document.body.innerHTML = '<input id="txt" type="text" />';

    await expect(
      handleForm({
        action: 'check',
        params: { selector: '#txt' },
      } as Command),
    ).rejects.toThrow('not a checkbox or radio');
  });

  it('works with radio buttons', async () => {
    document.body.innerHTML = '<input id="rb" type="radio" />';
    const rb = document.getElementById('rb') as HTMLInputElement;

    const result = await handleForm({
      action: 'check',
      params: { selector: '#rb' },
    } as Command);

    expect(result).toEqual({ checked: true });
    expect(rb.checked).toBe(true);
  });
});

// ─── uncheck ────────────────────────────────────────────────────────

describe('uncheck', () => {
  it('unchecks a checked checkbox', async () => {
    document.body.innerHTML = '<input id="cb" type="checkbox" checked />';
    const cb = document.getElementById('cb') as HTMLInputElement;
    expect(cb.checked).toBe(true);

    const result = await handleForm({
      action: 'uncheck',
      params: { selector: '#cb' },
    } as Command);

    expect(result).toEqual({ unchecked: true });
    expect(cb.checked).toBe(false);
  });

  it('already unchecked stays unchecked', async () => {
    document.body.innerHTML = '<input id="cb" type="checkbox" />';
    const cb = document.getElementById('cb') as HTMLInputElement;
    expect(cb.checked).toBe(false);

    const result = await handleForm({
      action: 'uncheck',
      params: { selector: '#cb' },
    } as Command);

    expect(result).toEqual({ unchecked: true });
    expect(cb.checked).toBe(false);
  });

  it('dispatches input and change events when unchecking', async () => {
    document.body.innerHTML = '<input id="cb" type="checkbox" checked />';
    const cb = document.getElementById('cb')!;
    const events: string[] = [];
    cb.addEventListener('input', () => events.push('input'));
    cb.addEventListener('change', () => events.push('change'));

    await handleForm({
      action: 'uncheck',
      params: { selector: '#cb' },
    } as Command);

    expect(events).toEqual(['input', 'change']);
  });

  it('throws for non-input elements', async () => {
    document.body.innerHTML = '<div id="d">Not input</div>';

    await expect(
      handleForm({
        action: 'uncheck',
        params: { selector: '#d' },
      } as Command),
    ).rejects.toThrow('not an <input>');
  });
});

// ─── select ─────────────────────────────────────────────────────────

describe('select', () => {
  const selectHtml = `
    <select id="sel">
      <option value="opt1">Option One</option>
      <option value="opt2" label="Label Two">Option Two</option>
      <option value="opt3">Option Three</option>
    </select>
  `;

  it('selects by value', async () => {
    document.body.innerHTML = selectHtml;

    const result = await handleForm({
      action: 'select',
      params: { selector: '#sel', value: 'opt2' },
    } as Command);

    expect(result).toEqual({ selected: true, value: 'opt2' });
    expect((document.getElementById('sel') as HTMLSelectElement).value).toBe('opt2');
  });

  it('selects by text content when value does not match', async () => {
    document.body.innerHTML = selectHtml;

    const result = await handleForm({
      action: 'select',
      params: { selector: '#sel', value: 'Option Three' },
    } as Command);

    expect(result).toEqual({ selected: true, value: 'opt3' });
  });

  it('selects by label when value and text do not match', async () => {
    document.body.innerHTML = selectHtml;

    const result = await handleForm({
      action: 'select',
      params: { selector: '#sel', value: 'Label Two' },
    } as Command);

    expect(result).toEqual({ selected: true, value: 'opt2' });
  });

  it('dispatches input and change events', async () => {
    document.body.innerHTML = selectHtml;
    const sel = document.getElementById('sel')!;
    const events: string[] = [];
    sel.addEventListener('input', () => events.push('input'));
    sel.addEventListener('change', () => events.push('change'));

    await handleForm({
      action: 'select',
      params: { selector: '#sel', value: 'opt1' },
    } as Command);

    expect(events).toEqual(['input', 'change']);
  });

  it('throws "Element not found" for missing selector', async () => {
    await expect(
      handleForm({
        action: 'select',
        params: { selector: '#nonexistent', value: 'x' },
      } as Command),
    ).rejects.toThrow('Element not found');
  });

  it('throws for non-select element', async () => {
    document.body.innerHTML = '<input id="inp" />';

    await expect(
      handleForm({
        action: 'select',
        params: { selector: '#inp', value: 'x' },
      } as Command),
    ).rejects.toThrow('not a <select>');
  });

  it('throws "No option matching" for invalid value with available options', async () => {
    document.body.innerHTML = selectHtml;

    await expect(
      handleForm({
        action: 'select',
        params: { selector: '#sel', value: 'nonexistent' },
      } as Command),
    ).rejects.toThrow(/No option matching "nonexistent".*Available options/);
  });
});
