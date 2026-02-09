/**
 * Element reference store for the current page.
 * Maps @e1, @e2, etc. to CSS selectors.
 * Re-generated on each snapshot call.
 */

import { isElementRef } from '@browser-cli/shared';

interface RefEntry {
  ref: string;
  selector: string;
  element: WeakRef<Element>;
}

let refCounter = 0;
let refMap = new Map<string, RefEntry>();

/** Clear all refs (called before new snapshot) */
export function clearRefs(): void {
  refCounter = 0;
  refMap = new Map();
}

/** Register an element and return its ref */
export function registerElement(element: Element, selector: string): string {
  refCounter++;
  const ref = `@e${refCounter}`;
  refMap.set(ref, { ref, selector, element: new WeakRef(element) });
  return ref;
}

/** Get current ref count */
export function getRefCount(): number {
  return refCounter;
}

/** Resolve a selector (may be @e1 or a CSS selector) to a DOM element */
export function resolveElement(selectorOrRef: string): Element | null {
  if (isElementRef(selectorOrRef)) {
    const entry = refMap.get(selectorOrRef);
    if (!entry) return null;

    // Try the weak ref first
    const el = entry.element.deref();
    if (el && el.isConnected) return el;

    // Fall back to CSS selector
    return document.querySelector(entry.selector);
  }

  // Plain CSS selector
  return document.querySelector(selectorOrRef);
}

/** Resolve to all matching elements (for count, etc.) */
export function resolveElements(selectorOrRef: string): Element[] {
  if (isElementRef(selectorOrRef)) {
    const el = resolveElement(selectorOrRef);
    return el ? [el] : [];
  }
  return Array.from(document.querySelectorAll(selectorOrRef));
}

/** Generate a unique CSS selector for an element */
export function generateSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try to build a unique path
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    // Add nth-of-type for disambiguation
    const parent: Element | null = current.parentElement;
    if (parent) {
      const tag = current.tagName;
      const siblings = Array.from(parent.children).filter(
        (s: Element) => s.tagName === tag,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = parent;
  }

  return parts.join(' > ');
}
