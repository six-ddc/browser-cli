/**
 * Tests for shadow-DOM piercing queries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  composedContains,
  deepQuerySelector,
  deepQuerySelectorAll,
  getShadowRoot,
  hasShadowCombinator,
  joinShadowPath,
  searchRoots,
  shadowHostOf,
  shadowRootsUnder,
} from '../src/content-lib/deep-query';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  delete (globalThis as { chrome?: unknown }).chrome;
});

/** Attach a shadow root to a fresh host appended to `parent`. */
function attachHost(parent: ParentNode, id: string, html: string, mode: ShadowRootMode = 'open') {
  const host = document.createElement('div');
  host.id = id;
  parent.append(host);
  const shadow = host.attachShadow({ mode });
  shadow.innerHTML = html;
  return { host, shadow };
}

// ─── getShadowRoot ─────────────────────────────────────────────────

describe('getShadowRoot', () => {
  it('returns the open shadow root', () => {
    const { host, shadow } = attachHost(document.body, 'host', '<span>hi</span>');
    expect(getShadowRoot(host)).toBe(shadow);
  });

  it('returns null for an element without a shadow root', () => {
    document.body.innerHTML = '<div id="plain"></div>';
    expect(getShadowRoot(document.getElementById('plain')!)).toBeNull();
  });

  it('returns null for a closed shadow root when chrome.dom is unavailable', () => {
    const { host } = attachHost(document.body, 'host', '<span id="inner">hi</span>', 'closed');
    expect(getShadowRoot(host)).toBeNull();
  });

  it('returns a closed shadow root through chrome.dom when available', () => {
    const { host, shadow } = attachHost(
      document.body,
      'host',
      '<span id="inner">hi</span>',
      'closed',
    );
    (globalThis as { chrome?: unknown }).chrome = {
      dom: { openOrClosedShadowRoot: (el: Element) => (el === host ? shadow : null) },
    };

    expect(getShadowRoot(host)).toBe(shadow);
    expect(deepQuerySelector('#inner')?.textContent).toBe('hi');
  });

  it('never exposes the extension overlay host', () => {
    const overlay = document.createElement('browser-cli-overlay');
    document.body.append(overlay);
    const shadow = overlay.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div class="badge">Browser-CLI</div>';

    expect(getShadowRoot(overlay)).toBeNull();
    expect(deepQuerySelectorAll('.badge')).toEqual([]);
  });

  it('swallows chrome.dom failures', () => {
    const { host } = attachHost(document.body, 'host', '<span></span>', 'closed');
    (globalThis as { chrome?: unknown }).chrome = {
      dom: {
        openOrClosedShadowRoot: () => {
          throw new Error('not allowed');
        },
      },
    };

    expect(getShadowRoot(host)).toBeNull();
  });
});

// ─── shadowRootsUnder / searchRoots ────────────────────────────────

describe('shadowRootsUnder', () => {
  it('yields nested shadow roots depth-first', () => {
    const outer = attachHost(document.body, 'outer', '');
    const inner = attachHost(outer.shadow, 'inner', '<span>deep</span>');
    const sibling = attachHost(document.body, 'sibling', '<span>flat</span>');

    expect([...shadowRootsUnder(document.body)]).toEqual([
      outer.shadow,
      inner.shadow,
      sibling.shadow,
    ]);
  });

  it('yields nothing on a page without shadow roots', () => {
    document.body.innerHTML = '<div><span>plain</span></div>';
    expect([...shadowRootsUnder(document.body)]).toEqual([]);
  });

  it('searchRoots puts the root first', () => {
    const { shadow } = attachHost(document.body, 'host', '<span></span>');
    expect(searchRoots(document.body)).toEqual([document.body, shadow]);
  });
});

// ─── deepQuerySelectorAll ──────────────────────────────────────────

describe('deepQuerySelectorAll', () => {
  it('finds elements inside an open shadow root', () => {
    attachHost(document.body, 'host', '<span id="inner">shadow text</span>');
    const found = deepQuerySelectorAll('#inner');

    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('shadow text');
  });

  it('returns light DOM matches before shadow matches', () => {
    document.body.innerHTML = '<p class="dup">light</p>';
    attachHost(document.body, 'host', '<p class="dup">shadow</p>');

    expect(deepQuerySelectorAll('.dup').map((el) => el.textContent)).toEqual(['light', 'shadow']);
  });

  it('descends into nested shadow roots', () => {
    const outer = attachHost(document.body, 'outer', '');
    attachHost(outer.shadow, 'inner', '<button class="go">Deep</button>');

    expect(deepQuerySelectorAll('.go')).toHaveLength(1);
  });

  it('stops at the requested limit', () => {
    document.body.innerHTML = '<p class="dup">a</p>';
    attachHost(document.body, 'host', '<p class="dup">b</p><p class="dup">c</p>');

    expect(deepQuerySelectorAll('.dup', { limit: 2 })).toHaveLength(2);
    expect(deepQuerySelectorAll('.dup')).toHaveLength(3);
  });

  it('scopes the search to the given root', () => {
    const other = attachHost(document.body, 'other', '<span class="x">outside</span>');
    const scope = document.createElement('section');
    document.body.append(scope);
    attachHost(scope, 'inside', '<span class="x">inside</span>');

    const found = deepQuerySelectorAll('.x', { root: scope });
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('inside');
    expect(other.shadow.querySelector('.x')).not.toBeNull();
  });

  it('throws on an invalid selector', () => {
    expect(() => deepQuerySelectorAll(':::bad')).toThrow();
  });

  it('deepQuerySelector returns the first match or null', () => {
    attachHost(document.body, 'host', '<span id="inner">x</span>');
    expect(deepQuerySelector('#inner')).not.toBeNull();
    expect(deepQuerySelector('#missing')).toBeNull();
  });
});

// ─── piercing paths (`>>>`) ────────────────────────────────────────

describe('shadow piercing paths', () => {
  it('hasShadowCombinator detects the separator', () => {
    expect(hasShadowCombinator('#host >>> #inner')).toBe(true);
    expect(hasShadowCombinator('#host > div')).toBe(false);
  });

  it('resolves a host >>> inner path', () => {
    attachHost(document.body, 'host', '<span id="inner">deep</span>');

    const found = deepQuerySelectorAll(joinShadowPath('#host', '#inner'));
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('deep');
  });

  it('resolves a multi-level path', () => {
    const outer = attachHost(document.body, 'outer', '');
    attachHost(outer.shadow, 'inner', '<span id="leaf">deep</span>');

    const found = deepQuerySelectorAll('#outer >>> #inner >>> #leaf');
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe('deep');
  });

  it('returns nothing when an intermediate host has no shadow root', () => {
    document.body.innerHTML = '<div id="host"><span id="inner">light</span></div>';
    expect(deepQuerySelectorAll('#host >>> #inner')).toEqual([]);
  });

  it('returns nothing when the leaf segment does not match', () => {
    attachHost(document.body, 'host', '<span id="inner">deep</span>');
    expect(deepQuerySelectorAll('#host >>> #other')).toEqual([]);
  });

  it('applies the limit to path results', () => {
    attachHost(document.body, 'host', '<p class="dup">a</p><p class="dup">b</p>');
    expect(deepQuerySelectorAll('#host >>> .dup', { limit: 1 })).toHaveLength(1);
  });
});

// ─── shadowHostOf / composedContains ───────────────────────────────

describe('shadowHostOf', () => {
  it('returns the host for a node inside a shadow root', () => {
    const { host, shadow } = attachHost(document.body, 'host', '<span id="inner">x</span>');
    expect(shadowHostOf(shadow.getElementById('inner')!)).toBe(host);
  });

  it('returns null for a light DOM node', () => {
    document.body.innerHTML = '<div id="plain"></div>';
    expect(shadowHostOf(document.getElementById('plain')!)).toBeNull();
  });
});

describe('composedContains', () => {
  it('crosses shadow boundaries', () => {
    const { host, shadow } = attachHost(document.body, 'host', '<span id="inner">x</span>');
    const inner = shadow.getElementById('inner')!;

    expect(host.contains(inner)).toBe(false);
    expect(composedContains(host, inner)).toBe(true);
    expect(composedContains(document.body, inner)).toBe(true);
  });

  it('is false for unrelated elements', () => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;

    expect(composedContains(a, b)).toBe(false);
  });
});
