/**
 * Batched form fill: control-type dispatch and per-field error handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleFormFill } from '../src/content-lib/form-fill';
import type { Command } from '@browser-cli/shared';

beforeEach(() => {
  document.body.innerHTML = '';
});

function fillFields(
  fields: Array<{ selector: string; value: string | boolean | number }>,
  opts: { continueOnError?: boolean } = {},
) {
  return handleFormFill({ action: 'formFill', params: { fields, ...opts } } as Command);
}

describe('control type dispatch', () => {
  it('fills text inputs and textareas', async () => {
    document.body.innerHTML = '<input id="user" /><textarea id="bio"></textarea>';

    const result = await fillFields([
      { selector: '#user', value: 'alice' },
      { selector: '#bio', value: 'hello' },
    ]);

    expect(result.fields.map((f) => f.action)).toEqual(['fill', 'fill']);
    expect((document.getElementById('user') as HTMLInputElement).value).toBe('alice');
    expect((document.getElementById('bio') as HTMLTextAreaElement).value).toBe('hello');
    expect(result.filled).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('drives a <select> by option value or by visible text', async () => {
    document.body.innerHTML = `
      <select id="a"><option value="jp">Japan</option><option value="us">USA</option></select>
      <select id="b"><option value="jp">Japan</option><option value="us">USA</option></select>`;

    const result = await fillFields([
      { selector: '#a', value: 'us' },
      { selector: '#b', value: 'Japan' },
    ]);

    expect(result.fields.map((f) => f.action)).toEqual(['select', 'select']);
    expect((document.getElementById('a') as HTMLSelectElement).value).toBe('us');
    expect((document.getElementById('b') as HTMLSelectElement).value).toBe('jp');
  });

  it('checks and unchecks checkboxes from the value truthiness', async () => {
    document.body.innerHTML =
      '<input id="a" type="checkbox" /><input id="b" type="checkbox" checked />';

    const result = await fillFields([
      { selector: '#a', value: true },
      { selector: '#b', value: false },
    ]);

    expect(result.fields.map((f) => f.action)).toEqual(['check', 'uncheck']);
    expect((document.getElementById('a') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('b') as HTMLInputElement).checked).toBe(false);
  });

  it('treats radio buttons as checkables', async () => {
    document.body.innerHTML = '<input id="r" type="radio" name="g" />';
    const result = await fillFields([{ selector: '#r', value: true }]);

    expect(result.fields[0].action).toBe('check');
    expect((document.getElementById('r') as HTMLInputElement).checked).toBe(true);
  });

  it.each([
    ['false', false],
    ['0', false],
    ['no', false],
    ['off', false],
    ['', false],
    ['true', true],
    ['yes', true],
    ['on', true],
  ])('reads the checkbox string %j as %s', async (value, expected) => {
    document.body.innerHTML = '<input id="cb" type="checkbox" checked />';
    await fillFields([{ selector: '#cb', value }]);
    expect((document.getElementById('cb') as HTMLInputElement).checked).toBe(expected);
  });

  it('reads a numeric checkbox value as a flag', async () => {
    document.body.innerHTML =
      '<input id="a" type="checkbox" /><input id="b" type="checkbox" checked />';
    await fillFields([
      { selector: '#a', value: 1 },
      { selector: '#b', value: 0 },
    ]);
    expect((document.getElementById('a') as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById('b') as HTMLInputElement).checked).toBe(false);
  });

  it('stringifies a numeric value for a text input', async () => {
    document.body.innerHTML = '<input id="age" />';
    await fillFields([{ selector: '#age', value: 42 }]);
    expect((document.getElementById('age') as HTMLInputElement).value).toBe('42');
  });

  it('applies fields in the order given', async () => {
    document.body.innerHTML = '<input id="x" />';
    await fillFields([
      { selector: '#x', value: 'first' },
      { selector: '#x', value: 'second' },
    ]);
    expect((document.getElementById('x') as HTMLInputElement).value).toBe('second');
  });
});

describe('error handling', () => {
  it('aborts on the first failure and says how far it got', async () => {
    document.body.innerHTML = '<input id="a" /><input id="c" />';

    await expect(
      fillFields([
        { selector: '#a', value: 'one' },
        { selector: '#missing', value: 'two' },
        { selector: '#c', value: 'three' },
      ]),
    ).rejects.toThrow(/1 of 3 fields/);

    expect((document.getElementById('a') as HTMLInputElement).value).toBe('one');
    expect((document.getElementById('c') as HTMLInputElement).value).toBe('');
  });

  it('carries the underlying error code through the abort', async () => {
    document.body.innerHTML = '<input id="a" />';
    await expect(fillFields([{ selector: '#missing', value: 'x' }])).rejects.toMatchObject({
      code: 'ELEMENT_NOT_FOUND',
    });
  });

  it('continues past a failure with --continue-on-error and tallies both', async () => {
    document.body.innerHTML = '<input id="a" /><input id="c" />';

    const result = await fillFields(
      [
        { selector: '#a', value: 'one' },
        { selector: '#missing', value: 'two' },
        { selector: '#c', value: 'three' },
      ],
      { continueOnError: true },
    );

    expect(result.filled).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.fields[1].error?.code).toBe('ELEMENT_NOT_FOUND');
    expect(result.fields[1].action).toBeUndefined();
    expect((document.getElementById('c') as HTMLInputElement).value).toBe('three');
  });

  it('reports a type mismatch when a value targets an unfillable element', async () => {
    document.body.innerHTML = '<div id="d">not a field</div>';

    const result = await fillFields([{ selector: '#d', value: 'x' }], { continueOnError: true });

    expect(result.failed).toBe(1);
    expect(result.fields[0].error?.code).toBe('ELEMENT_TYPE_MISMATCH');
  });

  it('reports an unmatched <select> option without touching the value', async () => {
    document.body.innerHTML = '<select id="s"><option value="jp">Japan</option></select>';

    const result = await fillFields([{ selector: '#s', value: 'Mars' }], {
      continueOnError: true,
    });

    expect(result.fields[0].error?.code).toBe('ELEMENT_NOT_FOUND');
    expect(result.fields[0].error?.message).toContain('Japan');
    expect((document.getElementById('s') as HTMLSelectElement).value).toBe('jp');
  });
});
