/**
 * Tests for element reference store: clearRefs, registerElement, getRefCount,
 * resolveElement, resolveElements, generateSelector.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { BrowserCliError } from '@browser-cli/shared';
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

  it('falls back to CSS selector when the replacement has the same identity', () => {
    document.body.innerHTML = '<div id="d">original</div>';
    const el = document.getElementById('d')!;
    registerElement(el, '#d');

    // Remove from DOM — WeakRef.deref() may still return the element,
    // but isConnected will be false, so it falls back to querySelector
    el.remove();
    document.body.innerHTML = '<div id="d">original</div>';

    const resolved = resolveElement('@e1');
    expect(resolved).not.toBeNull();
    expect(resolved!.textContent).toBe('original');
  });

  it('refuses the CSS fallback when the replacement has different text', () => {
    document.body.innerHTML = '<div id="d">original</div>';
    const el = document.getElementById('d')!;
    registerElement(el, '#d');

    el.remove();
    document.body.innerHTML = '<div id="d">replacement</div>';

    expect(resolveElement('@e1')).toBeNull();
  });

  it('refuses the CSS fallback for short text too (re-rendered list rows)', () => {
    document.body.innerHTML = '<button id="b">Next</button>';
    const el = document.getElementById('b')!;
    registerElement(el, '#b');

    el.remove();
    document.body.innerHTML = '<button id="b">Prev</button>';

    expect(resolveElement('@e1')).toBeNull();
  });
});

// ─── strict mode ────────────────────────────────────────────────────

describe('resolveElement (strict)', () => {
  it('throws MULTIPLE_MATCHES when a CSS selector matches more than one element', () => {
    document.body.innerHTML = '<button class="b">One</button><button class="b">Two</button>';

    try {
      resolveElement('.b', undefined, { strict: true });
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as BrowserCliError;
      expect(e.code).toBe('MULTIPLE_MATCHES');
      expect(e.message).toContain('matched 2 elements');
      expect(e.message).toContain('One');
      expect(e.hint).toContain('--nth');
    }
  });

  it('does not throw on multiple matches when a position filter is given', () => {
    document.body.innerHTML = '<button class="b">One</button><button class="b">Two</button>';

    const el = resolveElement('.b', { type: 'last' }, { strict: true });
    expect(el?.textContent).toBe('Two');
  });

  it('does not throw on a single match', () => {
    document.body.innerHTML = '<button class="b">Only</button>';
    expect(resolveElement('.b', undefined, { strict: true })?.textContent).toBe('Only');
  });

  it('throws ELEMENT_NOT_FOUND with the ref count for an unregistered ref', () => {
    document.body.innerHTML = '<div id="d">x</div>';
    registerElement(document.getElementById('d')!, '#d');

    try {
      resolveElement('@e9', undefined, { strict: true });
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as BrowserCliError;
      expect(e.code).toBe('ELEMENT_NOT_FOUND');
      expect(e.message).toContain('@e1..@e1');
      expect(e.hint).toContain('snapshot -i');
    }
  });

  it('throws STALE_REF when the ref target is gone', () => {
    document.body.innerHTML = '<div id="d">original</div>';
    const el = document.getElementById('d')!;
    registerElement(el, '#d');
    el.remove();
    document.body.innerHTML = '<div id="d">replacement</div>';

    try {
      resolveElement('@e1', undefined, { strict: true });
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as BrowserCliError;
      expect(e.code).toBe('STALE_REF');
      expect(e.hint).toContain('snapshot -i');
    }
  });

  it('throws STALE_REF once the page URL differs from the snapshot URL', () => {
    document.body.innerHTML = '<div id="d">x</div>';
    registerElement(document.getElementById('d')!, '#d');

    history.pushState({}, '', '/another-route');
    try {
      resolveElement('@e1', undefined, { strict: true });
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as BrowserCliError;
      expect(e.code).toBe('STALE_REF');
      expect(e.message).toContain('another-route');
    }
  });

  it('throws INVALID_ARGS for a malformed CSS selector', () => {
    try {
      resolveElement('div[', undefined, { strict: true });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as BrowserCliError).code).toBe('INVALID_ARGS');
    }
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

// ─── shadow DOM ────────────────────────────────────────────────────

describe('shadow DOM', () => {
  /** Attach a shadow root to a fresh host appended to `parent`. */
  function attachHost(parent: ParentNode, id: string, html: string) {
    const host = document.createElement('div');
    host.id = id;
    parent.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = html;
    return { host, shadow };
  }

  it('resolveElement finds an element inside a shadow root', () => {
    const { shadow } = attachHost(document.body, 'host', '<span id="inner">shadow text</span>');

    expect(resolveElement('#inner')).toBe(shadow.getElementById('inner'));
  });

  it('resolveElements counts light and shadow matches', () => {
    document.body.innerHTML = '<p class="dup">light</p>';
    attachHost(document.body, 'host', '<p class="dup">shadow</p>');

    expect(resolveElements('.dup')).toHaveLength(2);
  });

  it('strict mode reports matches that straddle a shadow boundary', () => {
    document.body.innerHTML = '<p class="dup">light</p>';
    attachHost(document.body, 'host', '<p class="dup">shadow</p>');

    try {
      resolveElement('.dup', undefined, { strict: true });
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as BrowserCliError;
      expect(e.code).toBe('MULTIPLE_MATCHES');
      expect(e.message).toContain('matched 2 elements');
    }
  });

  it('resolveElement accepts an explicit piercing path', () => {
    const { shadow } = attachHost(document.body, 'host', '<span id="inner">deep</span>');

    expect(resolveElement('#host >>> #inner')).toBe(shadow.getElementById('inner'));
  });

  it('generateSelector emits a piercing path that resolves back', () => {
    const { shadow } = attachHost(document.body, 'host', '<span id="inner">deep</span>');
    const inner = shadow.getElementById('inner')!;

    const selector = generateSelector(inner);
    expect(selector).toBe('#host >>> #inner');
    expect(resolveElement(selector)).toBe(inner);
  });

  it('generateSelector walks nested shadow roots', () => {
    const outer = attachHost(document.body, 'outer', '');
    const inner = attachHost(outer.shadow, 'inner', '<button>Go</button>');
    const button = inner.shadow.querySelector('button')!;

    const selector = generateSelector(button);
    expect(selector).toBe('#outer >>> #inner >>> button');
    expect(resolveElement(selector)).toBe(button);
  });

  it('generateSelector disambiguates siblings at the top of a shadow tree', () => {
    const { shadow } = attachHost(document.body, 'host', '<p>one</p><p>two</p>');
    const second = shadow.querySelectorAll('p')[1];

    const selector = generateSelector(second);
    expect(selector).toBe('#host >>> p:nth-of-type(2)');
    expect(resolveElement(selector)).toBe(second);
  });

  it('a ref registered inside a shadow root survives a re-render via its selector', () => {
    const { shadow } = attachHost(document.body, 'host', '<span id="inner">keep</span>');
    const inner = shadow.getElementById('inner')!;
    registerElement(inner, generateSelector(inner));

    inner.remove();
    shadow.innerHTML = '<span id="inner">keep</span>';

    expect(resolveElement('@e1')).toBe(shadow.getElementById('inner'));
  });
});
