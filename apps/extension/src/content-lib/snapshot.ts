/**
 * Accessibility snapshot: DOM walk → ARIA role → accessible name → ref assignment.
 * Produces a text tree similar to agent-browser's snapshot output.
 */

import type { SnapshotNode, SnapshotOptions } from '@browser-cli/shared';
import { serializeSnapshot } from '@browser-cli/shared';
import type { SnapshotParams } from '@browser-cli/shared';
import {
  clearRefs,
  registerElement,
  generateSelector,
  getRefCount,
} from './element-ref-store';

export async function handleSnapshot(params: SnapshotParams): Promise<{
  snapshot: string;
  refCount: number;
}> {
  const options: SnapshotOptions = {
    interactive: params.interactive,
    compact: params.compact,
    depth: params.depth,
  };

  // Clear existing refs
  clearRefs();

  // Build the tree
  const root = buildSnapshotTree(document.body, options, 0);
  const nodes = root ? [wrapPage(root)] : [];

  const snapshot = serializeSnapshot(nodes, { compact: options.compact });
  return { snapshot, refCount: getRefCount() };
}

function wrapPage(bodyNode: SnapshotNode): SnapshotNode {
  return {
    role: 'page',
    name: document.title || '',
    children: bodyNode.children,
    url: location.href,
  };
}

function buildSnapshotTree(
  element: Element,
  options: SnapshotOptions,
  depth: number,
): SnapshotNode | null {
  if (options.depth && depth > options.depth) return null;

  // Skip invisible elements
  if (!isVisibleForSnapshot(element)) return null;

  // Skip script, style, noscript, etc.
  const tag = element.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'link', 'meta', 'br', 'hr'].includes(tag)) return null;

  const role = getAriaRole(element);
  const name = getAccessibleName(element);
  const isInteractive = isInteractiveElement(element);

  // Assign ref if interactive
  let ref: string | undefined;
  if (isInteractive) {
    ref = registerElement(element, generateSelector(element));
  }

  // Build children
  const children: SnapshotNode[] = [];
  for (const child of element.children) {
    const childNode = buildSnapshotTree(child, options, depth + 1);
    if (childNode) children.push(childNode);
  }

  // Handle text nodes
  if (children.length === 0 && !name && !ref) {
    const text = element.textContent?.trim();
    if (!text) return null;
  }

  // Skip non-semantic containers that only have one child with the same name
  if (
    !ref &&
    !name &&
    children.length === 1 &&
    role === 'generic' &&
    !options.interactive
  ) {
    return children[0];
  }

  // In interactive mode, skip non-interactive nodes without interactive children
  if (options.interactive && !isInteractive) {
    const hasInteractiveChild = children.some(hasInteractiveDescendant);
    if (!hasInteractiveChild && !ref) return null;
  }

  const node: SnapshotNode = {
    role: role || 'generic',
    name: name || '',
    children,
  };

  if (ref) node.ref = ref;

  // Add extra properties
  const level = getHeadingLevel(element);
  if (level) node.level = level;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.value) node.value = element.value;
    if (element.disabled) node.disabled = true;
    if (element.required) node.required = true;
  }

  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      node.checked = element.checked;
    }
  }

  if (element instanceof HTMLDetailsElement) {
    node.expanded = element.open;
  }

  if (tag === 'a' && element.getAttribute('href')) {
    node.url = (element as HTMLAnchorElement).href;
  }

  return node;
}

function hasInteractiveDescendant(node: SnapshotNode): boolean {
  if (node.ref) return true;
  return node.children.some(hasInteractiveDescendant);
}

/** Map HTML elements to ARIA roles */
function getAriaRole(el: Element): string {
  // Explicit role attribute
  const explicitRole = el.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'a':
      return el.hasAttribute('href') ? 'link' : 'generic';
    case 'button':
      return 'button';
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
        case 'range':
          return 'slider';
        case 'search':
          return 'searchbox';
        case 'number':
        case 'email':
        case 'tel':
        case 'url':
        case 'text':
        case 'password':
        default:
          return 'textbox';
      }
    }
    case 'textarea':
      return 'textbox';
    case 'select':
      return 'combobox';
    case 'option':
      return 'option';
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    case 'img':
      return 'img';
    case 'nav':
      return 'navigation';
    case 'main':
      return 'main';
    case 'header':
      return 'banner';
    case 'footer':
      return 'contentinfo';
    case 'aside':
      return 'complementary';
    case 'form':
      return 'form';
    case 'table':
      return 'table';
    case 'thead':
    case 'tbody':
    case 'tfoot':
      return 'rowgroup';
    case 'tr':
      return 'row';
    case 'th':
      return 'columnheader';
    case 'td':
      return 'cell';
    case 'ul':
    case 'ol':
      return 'list';
    case 'li':
      return 'listitem';
    case 'section':
      return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
        ? 'region'
        : 'generic';
    case 'p':
      return 'paragraph';
    case 'dialog':
      return 'dialog';
    case 'details':
      return 'group';
    case 'summary':
      return 'button';
    default:
      return 'generic';
  }
}

/** Compute accessible name (simplified W3C algorithm) */
function getAccessibleName(el: Element): string {
  // aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  const tag = el.tagName.toLowerCase();

  // <img alt="...">
  if (tag === 'img') {
    return el.getAttribute('alt') || '';
  }

  // <input> with <label>
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    const id = el.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label) return label.textContent?.trim() || '';
    }
    // Wrapping label
    const parentLabel = el.closest('label');
    if (parentLabel) {
      // Get text excluding the input itself
      const clone = parentLabel.cloneNode(true) as Element;
      clone.querySelectorAll('input, textarea, select').forEach((n) => n.remove());
      return clone.textContent?.trim() || '';
    }
    // placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder;
    // title
    const title = el.getAttribute('title');
    if (title) return title;
    return '';
  }

  // <button>, <a>, headings, etc. — use text content
  if (['button', 'a', 'summary', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    return el.textContent?.trim() || '';
  }

  // For option elements
  if (tag === 'option') {
    return (el as HTMLOptionElement).label || el.textContent?.trim() || '';
  }

  // title attribute as fallback
  const title = el.getAttribute('title');
  if (title) return title;

  // For text-only elements (paragraph, etc.), use text content
  if (['p', 'li', 'td', 'th', 'span', 'label', 'legend', 'caption', 'figcaption'].includes(tag)) {
    return el.textContent?.trim() || '';
  }

  return '';
}

function getHeadingLevel(el: Element): number | undefined {
  const tag = el.tagName.toLowerCase();
  const match = tag.match(/^h([1-6])$/);
  return match ? parseInt(match[1], 10) : undefined;
}

function isInteractiveElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();

  // Standard interactive elements
  if (['button', 'input', 'textarea', 'select', 'summary'].includes(tag)) return true;
  if (tag === 'a' && el.hasAttribute('href')) return true;

  // tabindex makes an element interactive
  if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true;

  // Elements with click handlers (role="button", etc.)
  if (el.getAttribute('role') === 'button') return true;
  if (el.getAttribute('role') === 'link') return true;
  if (el.getAttribute('role') === 'tab') return true;
  if (el.getAttribute('role') === 'menuitem') return true;

  // onclick attribute
  if (el.hasAttribute('onclick')) return true;

  // cursor: pointer (expensive, but useful)
  const style = window.getComputedStyle(el);
  if (style.cursor === 'pointer' && tag !== 'html' && tag !== 'body') return true;

  return false;
}

function isVisibleForSnapshot(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;

  // Don't filter by opacity=0 for snapshot — could be transition state

  // Check aria-hidden
  if (el.getAttribute('aria-hidden') === 'true') return false;

  return true;
}
