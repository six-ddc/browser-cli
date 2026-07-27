/**
 * Actionability checks run before every interaction, so a command that reports
 * success actually reached the element a user would have hit.
 *
 * visible → enabled → scrolled into view → not occluded.
 */

import { BrowserCliError } from '@browser-cli/shared';
import { composedContains } from './deep-query';
import { describeElement, pageContext } from './element-describe';
import { resolveElement, type Position, type ResolveOptions } from './element-ref-store';
import { hasLayoutEngine, isElementVisible } from './visibility';

export interface ActionabilityOptions {
  /** Skip the enabled and occlusion checks (`--force`). */
  force?: boolean;
  /** Also reject readonly inputs (fill/type/clear). */
  requireEditable?: boolean;
  /** Skip the occlusion check for actions that do not depend on hit-testing. */
  skipOcclusion?: boolean;
}

/** Resolve a selector to exactly one element, or throw a structured error. */
export function requireElement(
  selector: string,
  position?: Position,
  options?: ResolveOptions,
): Element {
  const el = resolveElement(selector, position, { strict: true, ...options });
  if (!el) {
    throw new BrowserCliError(
      'ELEMENT_NOT_FOUND',
      `Element not found: ${selector}. ${pageContext()}`,
      "Run 'snapshot -i' to list the interactive elements currently on the page, then use one of the reported @eN refs or a semantic locator (text=..., role=...).",
    );
  }
  return el;
}

/** Resolve and verify the element can actually be acted upon. */
export function requireActionable(
  selector: string,
  position?: Position,
  options?: ActionabilityOptions,
): Element {
  const el = requireElement(selector, position);
  ensureActionable(el, selector, options);
  return el;
}

export function ensureActionable(
  el: Element,
  selector: string,
  options?: ActionabilityOptions,
): void {
  if (!isElementVisible(el)) {
    throw new BrowserCliError(
      'ELEMENT_NOT_VISIBLE',
      `Element is not visible: ${selector} → ${describeElement(el)}. ${describeHidden(el)}`,
      "Wait for it to appear ('wait <selector>'), open the container that reveals it, or re-run 'snapshot -i' to find the visible equivalent.",
    );
  }

  if (!options?.force) {
    assertEnabled(el, selector, options?.requireEditable);
  }

  if (hasLayoutEngine()) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  }

  if (!options?.force && !options?.skipOcclusion) {
    assertNotOccluded(el, selector);
  }
}

function describeHidden(el: Element): string {
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return 'Computed style is display:none.';
  if (style.visibility === 'hidden' || style.visibility === 'collapse') {
    return `Computed style is visibility:${style.visibility}.`;
  }
  if (style.opacity === '0') return 'Computed style is opacity:0.';
  if (!el.isConnected) return 'It is detached from the document.';
  return 'Its bounding box is 0x0.';
}

function isNativelyDisabled(el: Element): boolean {
  return 'disabled' in el && (el as unknown as { disabled: boolean }).disabled;
}

/** Native `disabled`, `aria-disabled`, or an ancestor `<fieldset disabled>`. */
export function isElementEnabled(el: Element): boolean {
  if (isNativelyDisabled(el)) return false;
  if (el.getAttribute('aria-disabled') === 'true') return false;
  if (el.closest('fieldset[disabled]') !== null) return false;
  return true;
}

function assertEnabled(el: Element, selector: string, requireEditable?: boolean): void {
  const nativelyDisabled = isNativelyDisabled(el);
  const ariaDisabled = el.getAttribute('aria-disabled') === 'true';
  const inDisabledFieldset = el.closest('fieldset[disabled]') !== null;

  if (nativelyDisabled || ariaDisabled || inDisabledFieldset) {
    const reason = nativelyDisabled
      ? 'the disabled attribute is set'
      : ariaDisabled
        ? 'aria-disabled="true" is set'
        : 'it is inside a disabled <fieldset>';
    throw new BrowserCliError(
      'ELEMENT_DISABLED',
      `Element is disabled: ${selector} → ${describeElement(el)} (${reason}).`,
      'Satisfy whatever the page requires to enable it (fill the form, accept terms, …), or pass --force to interact anyway.',
    );
  }

  if (requireEditable && 'readOnly' in el && (el as unknown as { readOnly: boolean }).readOnly) {
    throw new BrowserCliError(
      'ELEMENT_DISABLED',
      `Element is readonly: ${selector} → ${describeElement(el)}.`,
      'A readonly field cannot be typed into. Use the control that populates it (date picker, dropdown, …), or pass --force.',
    );
  }
}

function assertNotOccluded(el: Element, selector: string): void {
  if (!hasLayoutEngine()) return;

  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  // Element centre outside the viewport (taller than the viewport, sticky
  // layout, …) — hit-testing would return nothing, which is not an occlusion.
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;

  const stack = document.elementsFromPoint(x, y);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- elementsFromPoint is absent in some runtimes
  if (!stack || stack.length === 0) return;

  // elementsFromPoint retargets shadow content to its host, so a hit on a host
  // that composes `el` still means the click lands in `el`.
  const index = stack.findIndex(
    (node) => node === el || el.contains(node) || composedContains(node, el),
  );
  if (index === 0) return;

  const blocker = stack[0];
  // An ancestor painting on top means the element itself is still what a click
  // would land in — only foreign elements count as occluders.
  if (index > 0 && blocker.contains(el)) return;

  throw new BrowserCliError(
    'ELEMENT_OCCLUDED',
    `Element ${selector} → ${describeElement(el)} is covered by ${describeElement(blocker)} at its centre point (${Math.round(x)}, ${Math.round(y)}).`,
    'Dismiss the overlay first (cookie/consent banner, modal, sticky header) — try clicking its close control — then retry. Use --force to dispatch the event on the element regardless.',
  );
}
