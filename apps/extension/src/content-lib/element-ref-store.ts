/**
 * Element reference store for the current page.
 * Maps @e1, @e2, etc. to CSS selectors.
 * Re-generated on each snapshot call.
 *
 * Also resolves semantic locators (role=button, text=Submit, xpath=//button, etc.)
 */

import {
  BrowserCliError,
  isElementRef,
  isSemanticLocator,
  parseSemanticLocator,
} from '@browser-cli/shared';
import { resolveSemanticLocator } from './semantic-locators';
import { describeElement } from './element-describe';
import {
  deepQuerySelector,
  deepQuerySelectorAll,
  joinShadowPath,
  shadowHostOf,
} from './deep-query';

interface RefEntry {
  ref: string;
  selector: string;
  element: WeakRef<Element>;
  identity: {
    tagName: string;
    ariaLabel: string;
    role: string;
    textSnippet: string; // first 40 chars of trimmed textContent
  };
}

export interface ResolveOptions {
  /** Fail on multiple matches / stale refs instead of silently picking one. */
  strict?: boolean;
}

export interface Position {
  type: 'first' | 'last' | 'nth';
  index?: number;
}

let refCounter = 0;
let refMap = new Map<string, RefEntry>();
/** URL the current ref generation was captured on — refs do not survive navigation. */
let refPageUrl = '';

/** Clear all refs (called before new snapshot) */
export function clearRefs(): void {
  refCounter = 0;
  refMap = new Map();
  refPageUrl = location.href;
}

/** Register an element and return its ref */
export function registerElement(element: Element, selector: string): string {
  refCounter++;
  const ref = `@e${refCounter}`;
  refMap.set(ref, {
    ref,
    selector,
    element: new WeakRef(element),
    identity: {
      tagName: element.tagName,
      ariaLabel: element.getAttribute('aria-label') || '',
      role: element.getAttribute('role') || '',
      textSnippet: (element.textContent || '').trim().slice(0, 40),
    },
  });
  return ref;
}

/** Get current ref count */
export function getRefCount(): number {
  return refCounter;
}

/** Resolve a selector (may be @e1, semantic locator, or CSS selector) to a DOM element */
export function resolveElement(
  selectorOrRef: string,
  position?: Position,
  options?: ResolveOptions,
): Element | null {
  // Handle element refs (@e1, @e2, etc.)
  if (isElementRef(selectorOrRef)) {
    return resolveRef(selectorOrRef, options);
  }

  // Handle semantic locators (role=button, text=Submit, xpath=//button, etc.)
  if (isSemanticLocator(selectorOrRef)) {
    const locator = parseSemanticLocator(selectorOrRef);
    if (!locator) {
      if (options?.strict) {
        throw new BrowserCliError(
          'INVALID_ARGS',
          `Could not parse semantic locator "${selectorOrRef}".`,
          'Use one of: text=..., role=name[name="..."], label=..., placeholder=..., testid=..., xpath=...',
        );
      }
      return null;
    }

    const elements = resolveSemanticLocator(locator);
    assertSingleMatch(selectorOrRef, elements, position, options);
    return applyPositionFilter(elements, position);
  }

  // Plain CSS selector
  const elements = queryCss(selectorOrRef, options);
  assertSingleMatch(selectorOrRef, elements, position, options);
  if (position) {
    return applyPositionFilter(elements, position);
  }
  // Prefer the first element with non-zero dimensions (skip hidden duplicates)
  const visible = elements.find((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  });
  return visible || elements[0] || null;
}

function queryCss(selector: string, options?: ResolveOptions): Element[] {
  try {
    return deepQuerySelectorAll(selector);
  } catch {
    if (options?.strict) {
      throw new BrowserCliError(
        'INVALID_ARGS',
        `Invalid CSS selector: "${selector}".`,
        'Check the selector syntax, or use a semantic locator such as text=..., role=..., label=...',
      );
    }
    return [];
  }
}

function resolveRef(ref: string, options?: ResolveOptions): Element | null {
  const entry = refMap.get(ref);
  if (!entry) {
    if (!options?.strict) return null;
    const count = refCounter;
    throw new BrowserCliError(
      'ELEMENT_NOT_FOUND',
      `Element ref ${ref} is not registered on ${location.href}. ${
        count === 0
          ? 'No snapshot has been taken on this page yet.'
          : `The current snapshot registered ${count} ref(s) (@e1..@e${count}).`
      }`,
      "Run 'snapshot -i' to capture the page and get valid @eN refs.",
    );
  }

  // Refs belong to the page they were captured on. A SPA route change keeps the
  // content script alive but replaces the DOM, so compare URLs before trusting them.
  if (refPageUrl && location.href !== refPageUrl) {
    if (!options?.strict) return null;
    throw new BrowserCliError(
      'STALE_REF',
      `Element ref ${ref} was captured on ${refPageUrl} but the page is now ${location.href}.`,
      "The page navigated since the last snapshot. Run 'snapshot -i' again to get fresh refs.",
    );
  }

  // Try the weak ref first
  const el = entry.element.deref();
  if (el && el.isConnected) return el;

  // Fall back to CSS selector, but verify identity to avoid silently hitting a different element
  const found = deepQuerySelector(entry.selector);
  if (found && matchesIdentity(found, entry.identity)) return found;

  if (!options?.strict) return null;
  throw new BrowserCliError(
    'STALE_REF',
    `Element ref ${ref} (${entry.identity.tagName.toLowerCase()}, selector "${entry.selector}") is no longer in the DOM.`,
    "The page content changed since the last snapshot. Run 'snapshot -i' again to get fresh refs.",
  );
}

function assertSingleMatch(
  selector: string,
  elements: Element[],
  position: Position | undefined,
  options?: ResolveOptions,
): void {
  if (!options?.strict || position || elements.length <= 1) return;
  const preview = elements
    .slice(0, 3)
    .map((el, i) => `  ${i + 1}. ${describeElement(el)}`)
    .join('\n');
  throw new BrowserCliError(
    'MULTIPLE_MATCHES',
    `Selector "${selector}" matched ${elements.length} elements:\n${preview}${
      elements.length > 3 ? `\n  ... and ${elements.length - 3} more` : ''
    }`,
    'Narrow the selector, or pick one with --first / --last / --nth <n>.',
  );
}

/** Apply position filter to an array of elements */
function applyPositionFilter(elements: Element[], position?: Position): Element | null {
  if (!position) return elements[0] || null;

  switch (position.type) {
    case 'first':
      return elements[0] || null;
    case 'last':
      return elements[elements.length - 1] || null;
    case 'nth':
      if (position.index === undefined) return null;
      // nth is 1-based from user perspective, but arrays are 0-based
      return elements[position.index - 1] || null;
    default:
      return elements[0] || null;
  }
}

/** Resolve to all matching elements (for count, etc.) */
export function resolveElements(selectorOrRef: string): Element[] {
  // Handle element refs (@e1, @e2, etc.)
  if (isElementRef(selectorOrRef)) {
    const el = resolveElement(selectorOrRef);
    return el ? [el] : [];
  }

  // Handle semantic locators (role=button, text=Submit, xpath=//button, etc.)
  if (isSemanticLocator(selectorOrRef)) {
    const locator = parseSemanticLocator(selectorOrRef);
    if (!locator) return [];

    return resolveSemanticLocator(locator);
  }

  // Plain CSS selector
  return queryCss(selectorOrRef);
}

/** Check if a DOM element matches a stored identity fingerprint */
function matchesIdentity(el: Element, identity: RefEntry['identity']): boolean {
  if (el.tagName !== identity.tagName) return false;
  // aria-label is the strongest signal — must match exactly if non-empty
  if (identity.ariaLabel && el.getAttribute('aria-label') !== identity.ariaLabel) return false;
  // role must match if non-empty
  if (identity.role && el.getAttribute('role') !== identity.role) return false;
  // Text is compared for every ref, not just long ones: a short label ("Next",
  // "Delete") is exactly the case where a re-rendered list hands back the wrong row.
  const elText = (el.textContent || '').trim().slice(0, 40);
  if (elText !== identity.textSnippet) return false;
  return true;
}

/**
 * Generate a selector that resolves back to this element. Elements inside a
 * shadow root get a piercing path (`#host >>> #inner`), since their ids and
 * ancestors are scoped to the shadow tree and invisible to document queries.
 */
export function generateSelector(element: Element): string {
  const host = shadowHostOf(element);
  const local = generateLocalSelector(element);
  return host ? joinShadowPath(generateSelector(host), local) : local;
}

/** Selector for an element within its own tree (document or one shadow root). */
function generateLocalSelector(element: Element): string {
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

    // Add nth-of-type for disambiguation. The top element of a shadow tree has
    // no parentElement, so fall back to the shadow root for sibling lookup.
    const parent: Element | null = current.parentElement;
    const siblingScope: ParentNode | null = parent ?? current.parentNode;
    if (siblingScope) {
      const tag = current.tagName;
      const siblings = Array.from(siblingScope.children).filter((s: Element) => s.tagName === tag);
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
