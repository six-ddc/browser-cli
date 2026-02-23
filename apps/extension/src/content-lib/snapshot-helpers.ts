/**
 * Snapshot helper functions extracted for reuse.
 * These provide core utilities for ARIA role mapping and accessible name computation.
 */

import { getRole as getAriaRoleFromLib } from 'aria-api';
import { computeAccessibleName } from 'dom-accessibility-api';

/**
 * Get ARIA role of an element using W3C-compliant aria-api library.
 * Handles both explicit role attributes and implicit semantic roles.
 *
 * @param el - DOM element
 * @returns ARIA role name (e.g., 'button', 'link', 'textbox') or 'generic'
 */
export function getAriaRole(el: Element): string {
  try {
    const role = getAriaRoleFromLib(el);
    return role || 'generic';
  } catch (error) {
    // Fallback for test environments that don't support all CSS selectors
    // (e.g., jsdom doesn't support namespace selectors like [*|href])
    console.warn('aria-api failed, using fallback role detection:', error);
    return getFallbackRole(el);
  }
}

/**
 * Fallback role detection for environments where aria-api doesn't work.
 * Covers the most common HTML elements.
 */
export function getFallbackRole(el: Element): string {
  // Check explicit role attribute first
  const explicitRole = el.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'button':
      return 'button';
    case 'a':
      return el.hasAttribute('href') ? 'link' : 'generic';
    case 'input': {
      const type = (el as HTMLInputElement).type;
      switch (type) {
        case 'button':
        case 'submit':
        case 'reset':
          return 'button';
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        default:
          return 'textbox';
      }
    }
    case 'textarea':
      return 'textbox';
    case 'select':
      return 'combobox';
    default:
      return 'generic';
  }
}

/**
 * Compute accessible name using W3C Accessible Name and Description Computation 1.2.
 * Handles aria-label, aria-labelledby, labels, placeholders, and text content.
 *
 * @param el - DOM element
 * @returns Accessible name string (empty if none found)
 */
export function getAccessibleName(el: Element): string {
  try {
    const name = computeAccessibleName(el);
    return name.trim();
  } catch (error) {
    // Fallback to simple text content if library fails
    console.warn('Accessible name computation failed, using fallback:', error);
    return el.textContent?.trim() || '';
  }
}

/**
 * Get heading level from heading element (h1-h6).
 */
export function getHeadingLevel(el: Element): number | undefined {
  const tag = el.tagName.toLowerCase();
  const match = tag.match(/^h([1-6])$/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Check if element is interactive (should receive focus/clicks).
 */
export function isInteractiveElement(el: Element, options?: { cursor?: boolean }): boolean {
  const tag = el.tagName.toLowerCase();

  // Standard interactive elements
  if (['button', 'input', 'textarea', 'select', 'summary'].includes(tag)) return true;
  if (tag === 'a' && el.hasAttribute('href')) return true;

  // tabindex makes an element interactive
  if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;

  // Elements with interactive roles
  const role = el.getAttribute('role');
  if (role) {
    const interactiveRoles = [
      'button',
      'link',
      'tab',
      'menuitem',
      'checkbox',
      'radio',
      'textbox',
      'searchbox',
      'combobox',
      'slider',
      'spinbutton',
      'switch',
    ];
    if (interactiveRoles.includes(role.toLowerCase())) return true;
  }

  // onclick attribute
  if (el.hasAttribute('onclick')) return true;

  // cursor: pointer — only when cursor flag is enabled
  if (options?.cursor) {
    const style = window.getComputedStyle(el);
    if (style.cursor === 'pointer' && tag !== 'html' && tag !== 'body') return true;
  }

  return false;
}

/**
 * Check if element is visible for snapshot purposes.
 */
export function isVisibleForSnapshot(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;

  // Don't filter by opacity=0 for snapshot — could be transition state

  // Check aria-hidden
  if (el.getAttribute('aria-hidden') === 'true') return false;

  return true;
}

/**
 * Match text content with various matching strategies.
 */
export function matchText(
  actualText: string,
  expectedText: string,
  options: {
    exact?: boolean;
    ignoreCase?: boolean;
  } = {},
): boolean {
  const { exact = false, ignoreCase = true } = options;

  let actual = actualText;
  let expected = expectedText;

  if (ignoreCase) {
    actual = actual.toLowerCase();
    expected = expected.toLowerCase();
  }

  if (exact) {
    return actual === expected;
  }

  // Contains match
  return actual.includes(expected);
}
