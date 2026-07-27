/**
 * Actionability gate: every interaction must refuse an element a real user
 * could not have acted on, and say why with a code + hint.
 *
 * jsdom has no layout engine, so the size and occlusion checks are inert here;
 * they are exercised by the e2e suite. What is covered: the not-found /
 * hidden / disabled / readonly paths and the --force escape hatch.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { BrowserCliError } from '@browser-cli/shared';
import {
  ensureActionable,
  isElementEnabled,
  requireElement,
} from '../src/content-lib/actionability';
import { clearRefs } from '../src/content-lib/element-ref-store';

beforeEach(() => {
  document.body.innerHTML = '';
  clearRefs();
});

function expectError(fn: () => unknown): BrowserCliError {
  try {
    fn();
  } catch (err) {
    return err as BrowserCliError;
  }
  throw new Error('expected the call to throw');
}

describe('requireElement', () => {
  it('throws ELEMENT_NOT_FOUND with page context and a snapshot hint', () => {
    const err = expectError(() => requireElement('#nope'));
    expect(err.code).toBe('ELEMENT_NOT_FOUND');
    expect(err.message).toContain('#nope');
    expect(err.message).toContain(location.href);
    expect(err.hint).toContain('snapshot -i');
  });

  it('returns the element when exactly one matches', () => {
    document.body.innerHTML = '<button id="go">Go</button>';
    expect(requireElement('#go').id).toBe('go');
  });

  it('is strict: refuses an ambiguous selector', () => {
    document.body.innerHTML = '<b class="x">1</b><b class="x">2</b>';
    expect(expectError(() => requireElement('.x')).code).toBe('MULTIPLE_MATCHES');
  });
});

describe('ensureActionable — visibility', () => {
  it('rejects display:none with ELEMENT_NOT_VISIBLE', () => {
    document.body.innerHTML = '<button id="b" style="display:none">Go</button>';
    const err = expectError(() => ensureActionable(document.getElementById('b')!, '#b'));
    expect(err.code).toBe('ELEMENT_NOT_VISIBLE');
    expect(err.message).toContain('display:none');
    expect(err.hint).toContain('wait');
  });

  it('rejects visibility:hidden', () => {
    document.body.innerHTML = '<button id="b" style="visibility:hidden">Go</button>';
    expect(expectError(() => ensureActionable(document.getElementById('b')!, '#b')).code).toBe(
      'ELEMENT_NOT_VISIBLE',
    );
  });

  it('rejects opacity:0', () => {
    document.body.innerHTML = '<button id="b" style="opacity:0">Go</button>';
    expect(expectError(() => ensureActionable(document.getElementById('b')!, '#b')).code).toBe(
      'ELEMENT_NOT_VISIBLE',
    );
  });

  it('is not bypassed by --force', () => {
    document.body.innerHTML = '<button id="b" style="display:none">Go</button>';
    expect(
      expectError(() => ensureActionable(document.getElementById('b')!, '#b', { force: true }))
        .code,
    ).toBe('ELEMENT_NOT_VISIBLE');
  });
});

describe('ensureActionable — enabled', () => {
  it('rejects a natively disabled control', () => {
    document.body.innerHTML = '<button id="b" disabled>Go</button>';
    const err = expectError(() => ensureActionable(document.getElementById('b')!, '#b'));
    expect(err.code).toBe('ELEMENT_DISABLED');
    expect(err.message).toContain('disabled attribute');
    expect(err.hint).toContain('--force');
  });

  it('rejects aria-disabled="true"', () => {
    document.body.innerHTML = '<div id="b" role="button" aria-disabled="true">Go</div>';
    const err = expectError(() => ensureActionable(document.getElementById('b')!, '#b'));
    expect(err.code).toBe('ELEMENT_DISABLED');
    expect(err.message).toContain('aria-disabled');
  });

  it('rejects a control inside a disabled fieldset', () => {
    document.body.innerHTML = '<fieldset disabled><button id="b">Go</button></fieldset>';
    const err = expectError(() => ensureActionable(document.getElementById('b')!, '#b'));
    expect(err.code).toBe('ELEMENT_DISABLED');
    expect(err.message).toContain('fieldset');
  });

  it('rejects readonly only when the action writes text', () => {
    document.body.innerHTML = '<input id="i" readonly value="x">';
    const el = document.getElementById('i')!;

    expect(() => ensureActionable(el, '#i')).not.toThrow();

    const err = expectError(() => ensureActionable(el, '#i', { requireEditable: true }));
    expect(err.code).toBe('ELEMENT_DISABLED');
    expect(err.message).toContain('readonly');
  });

  it('--force skips the disabled check', () => {
    document.body.innerHTML = '<button id="b" disabled>Go</button>';
    expect(() =>
      ensureActionable(document.getElementById('b')!, '#b', { force: true }),
    ).not.toThrow();
  });

  it('accepts an ordinary enabled element', () => {
    document.body.innerHTML = '<button id="b">Go</button>';
    expect(() => ensureActionable(document.getElementById('b')!, '#b')).not.toThrow();
  });
});

describe('isElementEnabled', () => {
  it('reports aria-disabled and disabled fieldsets, not just the DOM property', () => {
    document.body.innerHTML = `
      <button id="plain">a</button>
      <button id="native" disabled>b</button>
      <div id="aria" role="button" aria-disabled="true">c</div>
      <fieldset disabled><input id="inset"></fieldset>
    `;
    expect(isElementEnabled(document.getElementById('plain')!)).toBe(true);
    expect(isElementEnabled(document.getElementById('native')!)).toBe(false);
    expect(isElementEnabled(document.getElementById('aria')!)).toBe(false);
    expect(isElementEnabled(document.getElementById('inset')!)).toBe(false);
  });
});
