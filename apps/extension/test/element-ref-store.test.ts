/**
 * Tests for element reference store: clearRefs, registerElement, getRefCount,
 * resolveElement, resolveElements, generateSelector.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearRefs,
  registerElement,
  getRefCount,
  resolveElement,
  resolveElements,
  generateSelector,
} from '../src/content-lib/element-ref-store';

beforeEach(() => {
  document.body.innerHTML = '';
  clearRefs();
});

// ─── clearRefs / registerElement / getRefCount ──────────────────────

describe('clearRefs / registerElement / getRefCount', () => {
  it('clearRefs resets counter to 0', () => {
    document.body.innerHTML = '<div id="d">test</div>';
    const el = document.getElementById('d')!;
    registerElement(el, '#d');
    expect(getRefCount()).toBe(1);

    clearRefs();
    expect(getRefCount()).toBe(0);
  });

  it('registerElement returns @e1, @e2, @e3 sequentially', () => {
    document.body.innerHTML = '<div id="a">A</div><div id="b">B</div><div id="c">C</div>';
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const c = document.getElementById('c')!;

    expect(registerElement(a, '#a')).toBe('@e1');
    expect(registerElement(b, '#b')).toBe('@e2');
    expect(registerElement(c, '#c')).toBe('@e3');
  });

  it('getRefCount returns current count', () => {
    document.body.innerHTML = '<div id="a">A</div><div id="b">B</div>';
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;

    expect(getRefCount()).toBe(0);
    registerElement(a, '#a');
    expect(getRefCount()).toBe(1);
    registerElement(b, '#b');
    expect(getRefCount()).toBe(2);
  });

  it('after clearRefs, next registerElement returns @e1 again', () => {
    document.body.innerHTML = '<div id="a">A</div><div id="b">B</div>';
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;

    registerElement(a, '#a');
    registerElement(b, '#b');
    expect(getRefCount()).toBe(2);

    clearRefs();
    const ref = registerElement(a, '#a');
    expect(ref).toBe('@e1');
  });

  it('registerElement stores element and selector', () => {
    document.body.innerHTML = '<div id="d">test</div>';
    const el = document.getElementById('d')!;
    const ref = registerElement(el, '#d');

    const resolved = resolveElement(ref);
    expect(resolved).toBe(el);
  });
});

// ─── resolveElement ─────────────────────────────────────────────────

describe('resolveElement', () => {
  it('resolves @e1 ref to registered element', () => {
    document.body.innerHTML = '<div id="d">test</div>';
    const el = document.getElementById('d')!;
    registerElement(el, '#d');

    expect(resolveElement('@e1')).toBe(el);
  });

  it('returns null for unknown ref @e99', () => {
    expect(resolveElement('@e99')).toBeNull();
  });

  it('resolves plain CSS selector via document.querySelector', () => {
    document.body.innerHTML = '<span class="target">hello</span>';
    const el = document.querySelector('.target')!;

    expect(resolveElement('.target')).toBe(el);
  });

  it('resolves with position={type:"first"} — returns first match', () => {
    document.body.innerHTML = '<p>One</p><p>Two</p><p>Three</p>';
    const first = document.querySelectorAll('p')[0];

    expect(resolveElement('p', { type: 'first' })).toBe(first);
  });

  it('resolves with position={type:"last"} — returns last match', () => {
    document.body.innerHTML = '<p>One</p><p>Two</p><p>Three</p>';
    const last = document.querySelectorAll('p')[2];

    expect(resolveElement('p', { type: 'last' })).toBe(last);
  });

  it('resolves with position={type:"nth", index:2} — returns second match (1-based)', () => {
    document.body.innerHTML = '<p>One</p><p>Two</p><p>Three</p>';
    const second = document.querySelectorAll('p')[1];

    expect(resolveElement('p', { type: 'nth', index: 2 })).toBe(second);
  });

  it('returns null for no match', () => {
    expect(resolveElement('.nonexistent')).toBeNull();
  });

  it('falls back to CSS selector when element is removed from DOM', () => {
    document.body.innerHTML = '<div id="d">original</div>';
    const el = document.getElementById('d')!;
    registerElement(el, '#d');

    // Remove from DOM — WeakRef.deref() may still return the element,
    // but isConnected will be false, so it falls back to querySelector
    el.remove();
    document.body.innerHTML = '<div id="d">replacement</div>';

    const resolved = resolveElement('@e1');
    expect(resolved).not.toBeNull();
    expect(resolved!.textContent).toBe('replacement');
  });
});

// ─── resolveElements ────────────────────────────────────────────────

describe('resolveElements', () => {
  it('returns array for CSS selector', () => {
    document.body.innerHTML = '<p>One</p><p>Two</p><p>Three</p>';

    const result = resolveElements('p');
    expect(result).toHaveLength(3);
  });

  it('returns single-element array for ref', () => {
    document.body.innerHTML = '<div id="d">test</div>';
    const el = document.getElementById('d')!;
    registerElement(el, '#d');

    const result = resolveElements('@e1');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(el);
  });

  it('returns empty array for non-matching ref', () => {
    const result = resolveElements('@e99');
    expect(result).toEqual([]);
  });

  it('returns empty array for non-matching CSS selector', () => {
    const result = resolveElements('.nonexistent');
    expect(result).toEqual([]);
  });
});

// ─── generateSelector ──────────────────────────────────────────────

describe('generateSelector', () => {
  it('element with id returns #id', () => {
    document.body.innerHTML = '<div id="myDiv">test</div>';
    const el = document.getElementById('myDiv')!;

    expect(generateSelector(el)).toBe('#myDiv');
  });

  it('nested element without id returns tag path with nth-of-type', () => {
    document.body.innerHTML = `
      <div>
        <span>first</span>
        <span>second</span>
      </div>
    `;
    const second = document.querySelectorAll('span')[1];

    const selector = generateSelector(second);
    // Should contain nth-of-type since there are sibling spans
    expect(selector).toContain('span:nth-of-type(2)');
    // The selector should be able to find the element
    expect(document.querySelector(selector)).toBe(second);
  });

  it('element with parent that has id returns #parentId > child', () => {
    document.body.innerHTML = '<div id="parent"><span>child</span></div>';
    const child = document.querySelector('span')!;

    const selector = generateSelector(child);
    expect(selector).toBe('#parent > span');
    expect(document.querySelector(selector)).toBe(child);
  });
});
