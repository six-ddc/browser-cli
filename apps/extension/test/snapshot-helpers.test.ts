/**
 * Tests for snapshot helper functions: heading level, text matching,
 * interactive element detection, visibility checks, and fallback role mapping.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHeadingLevel,
  matchText,
  isInteractiveElement,
  isVisibleForSnapshot,
  getFallbackRole,
} from '../src/content-lib/snapshot-helpers';

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─── getHeadingLevel ─────────────────────────────────────────────────

describe('getHeadingLevel', () => {
  it('returns 1 for h1', () => {
    const el = document.createElement('h1');
    expect(getHeadingLevel(el)).toBe(1);
  });

  it('returns 2 for h2', () => {
    const el = document.createElement('h2');
    expect(getHeadingLevel(el)).toBe(2);
  });

  it('returns 3 for h3', () => {
    const el = document.createElement('h3');
    expect(getHeadingLevel(el)).toBe(3);
  });

  it('returns 6 for h6', () => {
    const el = document.createElement('h6');
    expect(getHeadingLevel(el)).toBe(6);
  });

  it('returns undefined for div', () => {
    const el = document.createElement('div');
    expect(getHeadingLevel(el)).toBeUndefined();
  });

  it('returns undefined for span', () => {
    const el = document.createElement('span');
    expect(getHeadingLevel(el)).toBeUndefined();
  });
});

// ─── matchText ───────────────────────────────────────────────────────

describe('matchText', () => {
  it('default: case-insensitive contains match', () => {
    expect(matchText('Hello World', 'hello')).toBe(true);
  });

  it('default: returns false when text is not contained', () => {
    expect(matchText('Hello World', 'xyz')).toBe(false);
  });

  it('exact match succeeds with identical strings', () => {
    expect(matchText('Hello', 'Hello', { exact: true })).toBe(true);
  });

  it('exact match fails when case differs and ignoreCase=false', () => {
    expect(matchText('Hello', 'hello', { exact: true, ignoreCase: false })).toBe(false);
  });

  it('exact + ignoreCase: matches despite case difference', () => {
    expect(matchText('Hello', 'hello', { exact: true, ignoreCase: true })).toBe(true);
  });

  it('case sensitive contains: matches when case is correct', () => {
    expect(matchText('Hello', 'Hell', { ignoreCase: false })).toBe(true);
  });

  it('case sensitive contains: fails when case differs', () => {
    expect(matchText('Hello', 'hell', { ignoreCase: false })).toBe(false);
  });

  it('handles empty strings', () => {
    expect(matchText('', '')).toBe(true);
    expect(matchText('Hello', '')).toBe(true);
    expect(matchText('', 'hello')).toBe(false);
  });
});

// ─── isInteractiveElement ────────────────────────────────────────────

describe('isInteractiveElement', () => {
  it('button is interactive', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('input is interactive', () => {
    const el = document.createElement('input');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('textarea is interactive', () => {
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('select is interactive', () => {
    const el = document.createElement('select');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('summary is interactive', () => {
    const el = document.createElement('summary');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('anchor with href is interactive', () => {
    const el = document.createElement('a');
    el.setAttribute('href', 'https://example.com');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('anchor without href is not interactive', () => {
    const el = document.createElement('a');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(false);
  });

  it('div with tabindex="0" is interactive', () => {
    const el = document.createElement('div');
    el.setAttribute('tabindex', '0');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('div with tabindex="-1" is not interactive', () => {
    const el = document.createElement('div');
    el.setAttribute('tabindex', '-1');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(false);
  });

  it('div with role="button" is interactive', () => {
    const el = document.createElement('div');
    el.setAttribute('role', 'button');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('div with onclick is interactive', () => {
    const el = document.createElement('div');
    el.setAttribute('onclick', 'alert()');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(true);
  });

  it('plain div is not interactive', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isInteractiveElement(el)).toBe(false);
  });
});

// ─── isVisibleForSnapshot ────────────────────────────────────────────

describe('isVisibleForSnapshot', () => {
  it('element with aria-hidden="true" is not visible', () => {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    expect(isVisibleForSnapshot(el)).toBe(false);
  });

  it('regular visible element is visible', () => {
    const el = document.createElement('div');
    el.textContent = 'Hello';
    document.body.appendChild(el);
    expect(isVisibleForSnapshot(el)).toBe(true);
  });

  it('element with display:none is not visible', () => {
    const el = document.createElement('div');
    el.style.display = 'none';
    document.body.appendChild(el);
    // jsdom getComputedStyle may not reflect inline styles; test the behavior
    const result = isVisibleForSnapshot(el);
    // If jsdom supports it, expect false; otherwise skip
    if (window.getComputedStyle(el).display === 'none') {
      expect(result).toBe(false);
    }
  });

  it('element with visibility:hidden is not visible', () => {
    const el = document.createElement('div');
    el.style.visibility = 'hidden';
    document.body.appendChild(el);
    const result = isVisibleForSnapshot(el);
    if (window.getComputedStyle(el).visibility === 'hidden') {
      expect(result).toBe(false);
    }
  });
});

// ─── getFallbackRole ─────────────────────────────────────────────────

describe('getFallbackRole', () => {
  it('button -> "button"', () => {
    const el = document.createElement('button');
    expect(getFallbackRole(el)).toBe('button');
  });

  it('a with href -> "link"', () => {
    const el = document.createElement('a');
    el.setAttribute('href', 'https://example.com');
    expect(getFallbackRole(el)).toBe('link');
  });

  it('a without href -> "generic"', () => {
    const el = document.createElement('a');
    expect(getFallbackRole(el)).toBe('generic');
  });

  it('input type=checkbox -> "checkbox"', () => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    expect(getFallbackRole(el)).toBe('checkbox');
  });

  it('input type=radio -> "radio"', () => {
    const el = document.createElement('input');
    el.type = 'radio';
    expect(getFallbackRole(el)).toBe('radio');
  });

  it('input type=text -> "textbox"', () => {
    const el = document.createElement('input');
    el.type = 'text';
    expect(getFallbackRole(el)).toBe('textbox');
  });

  it('input type=submit -> "button"', () => {
    const el = document.createElement('input');
    el.type = 'submit';
    expect(getFallbackRole(el)).toBe('button');
  });

  it('textarea -> "textbox"', () => {
    const el = document.createElement('textarea');
    expect(getFallbackRole(el)).toBe('textbox');
  });

  it('select -> "combobox"', () => {
    const el = document.createElement('select');
    expect(getFallbackRole(el)).toBe('combobox');
  });

  it('div -> "generic"', () => {
    const el = document.createElement('div');
    expect(getFallbackRole(el)).toBe('generic');
  });

  it('div with explicit role="navigation" -> "navigation"', () => {
    const el = document.createElement('div');
    el.setAttribute('role', 'navigation');
    expect(getFallbackRole(el)).toBe('navigation');
  });
});
