/**
 * Accessibility snapshot: DOM walk → ARIA role → accessible name → ref assignment.
 * Produces a text tree similar to agent-browser's snapshot output.
 */

import type { SnapshotNode, SnapshotOptions } from '@browser-cli/shared';
import { serializeSnapshot, hasNodeSignal, REDACTED_VALUE, TEXT_ROLE } from '@browser-cli/shared';
import type { SnapshotParams } from '@browser-cli/shared';
import { clearRefs, registerElement, generateSelector } from './element-ref-store';
import {
  getAriaRole,
  getAccessibleName,
  getHeadingLevel,
  isInteractiveElement,
  isVisibleForSnapshot,
} from './snapshot-helpers';

import { waitForDOMStable } from './dom-stable';

/** Safety limit to prevent stack overflow on deeply nested DOMs (crash observed at ~2000 levels). */
const MAX_DEPTH = 100;

export async function handleSnapshot(params: SnapshotParams): Promise<{
  snapshot: string;
  refCount: number;
}> {
  await waitForDOMStable();

  const options: SnapshotOptions = {
    interactive: params.interactive,
    compact: params.compact,
    cursor: params.cursor,
    // Use explicit --depth if provided, otherwise apply safety limit
    depth: params.depth ?? MAX_DEPTH,
    filter: params.filter,
    maxChars: params.maxChars,
  };

  // Determine root element (scoped by selector or full body)
  // NOTE: must resolve before clearRefs() so @eN refs from the previous snapshot are still valid
  let rootElement: Element = document.body;
  if (params.selector) {
    const { resolveElement } = await import('./element-ref-store');
    const scoped = resolveElement(params.selector);
    if (!scoped) {
      return { snapshot: '(no element matched selector)', refCount: 0 };
    }
    rootElement = scoped;
  }

  // When scoping to a selector, preserve existing refs so overview @eN refs remain valid
  // across multiple drill-ins. Only clear on a full-page scan.
  if (!params.selector) {
    clearRefs();
  }

  // Build the tree
  const root = buildSnapshotTree(rootElement, options, 0);
  const nodes = root ? [wrapPage(root)] : [];

  const snapshot = serializeSnapshot(nodes, {
    compact: options.compact,
    maxChars: options.maxChars,
  });
  return { snapshot, refCount: countRefsInTree(nodes) };
}

function wrapPage(bodyNode: SnapshotNode): SnapshotNode {
  return {
    role: 'page',
    name: document.title || '',
    children: bodyNode.children,
    url: location.href,
  };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Build a StaticText node from a DOM text node. Returns null when the text is
 * empty, already carried by the parent's accessible name, or filtered out.
 */
function buildTextNode(
  node: Node,
  coveringName: string,
  options: SnapshotOptions,
): SnapshotNode | null {
  if (options.interactive) return null;
  if (options.filter && options.filter.toLowerCase() !== TEXT_ROLE) return null;

  const text = normalizeText(node.nodeValue ?? '');
  if (!text) return null;
  // Roles that take their name from content (heading, button, link, …) already
  // report this text, so repeating it would double the output.
  if (coveringName && normalizeText(coveringName).includes(text)) return null;

  return { role: TEXT_ROLE, name: '', text, children: [] };
}

const VALUELESS_INPUT_TYPES = new Set(['checkbox', 'radio', 'submit', 'button', 'reset', 'image']);

function isPasswordField(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLInputElement && el.type === 'password') return true;
  return (el.getAttribute('autocomplete') ?? '').toLowerCase().includes('password');
}

/**
 * Read widget state off the element. Covers native attributes and their ARIA
 * equivalents so custom widgets report the same states as built-in controls.
 */
function applyElementState(node: SnapshotNode, element: Element): void {
  const attr = (name: string) => element.getAttribute(name);

  const nativeDisabled =
    'disabled' in element && (element as { disabled?: unknown }).disabled === true;
  if (nativeDisabled || attr('aria-disabled') === 'true') node.disabled = true;

  const nativeRequired =
    'required' in element && (element as { required?: unknown }).required === true;
  if (nativeRequired || attr('aria-required') === 'true') node.required = true;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.readOnly) node.readonly = true;
  }
  if (attr('aria-readonly') === 'true') node.readonly = true;

  if (
    element instanceof HTMLInputElement &&
    (element.type === 'checkbox' || element.type === 'radio')
  ) {
    node.checked = element.indeterminate ? 'mixed' : element.checked;
  } else {
    const ariaChecked = attr('aria-checked');
    if (ariaChecked === 'true') node.checked = true;
    else if (ariaChecked === 'false') node.checked = false;
    else if (ariaChecked === 'mixed') node.checked = 'mixed';
  }

  if (element instanceof HTMLDetailsElement) {
    node.expanded = element.open;
  } else {
    const ariaExpanded = attr('aria-expanded');
    if (ariaExpanded === 'true') node.expanded = true;
    else if (ariaExpanded === 'false') node.expanded = false;
  }

  if (element instanceof HTMLOptionElement) {
    if (element.selected) node.selected = true;
  } else if (attr('aria-selected') === 'true') {
    node.selected = true;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // Toggle and push-button inputs carry a fixed `value` that says nothing the
    // checked state or accessible name doesn't already report.
    const carriesUserInput =
      !(element instanceof HTMLInputElement) || !VALUELESS_INPUT_TYPES.has(element.type);
    if (carriesUserInput && element.value) {
      node.value = isPasswordField(element) ? REDACTED_VALUE : element.value;
    }
  } else if (element instanceof HTMLSelectElement) {
    if (element.value) node.value = element.value;
  }

  if (element !== document.body && document.activeElement === element) node.focused = true;
}

function buildSnapshotTree(
  element: Element,
  options: SnapshotOptions,
  depth: number,
  coveringName = '',
): SnapshotNode | null {
  const maxDepth = options.depth ?? MAX_DEPTH;
  if (depth > maxDepth) return null;

  // Skip invisible elements
  if (!isVisibleForSnapshot(element)) return null;

  // Skip script, style, noscript, etc.
  const tag = element.tagName.toLowerCase();
  if (['script', 'style', 'noscript', 'link', 'meta', 'br', 'hr'].includes(tag)) return null;

  const role = getAriaRole(element);
  const name = getAccessibleName(element);
  const isInteractive = isInteractiveElement(element, { cursor: options.cursor });

  // Assign ref if interactive and has non-zero dimensions (actually visible on screen)
  let ref: string | undefined;
  if (isInteractive) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      ref = registerElement(element, generateSelector(element));
    }
  } else if (depth >= maxDepth) {
    // At the depth boundary: assign a ref to containers that have interactive descendants
    // in the real DOM (even though they're cut off by depth). This lets users drill in
    // via `snapshot -s @eN` to explore the subtree interactively.
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      const hasDeepInteractive =
        element.querySelector(
          'button,input,textarea,select,a[href],[tabindex]:not([tabindex="-1"]),[role="button"],[role="link"],[role="checkbox"],[role="textbox"],[role="menuitem"],[role="tab"]',
        ) !== null;
      if (hasDeepInteractive) {
        ref = registerElement(element, generateSelector(element));
      }
    }
  }

  // The nearest accessible name that already reports this subtree's text.
  const nameForChildren = name || coveringName;

  // Build children — snapshot into Array.from() to avoid live NodeList mutation issues
  const children: SnapshotNode[] = [];
  const childNodes = Array.from(element.childNodes);

  for (const child of childNodes) {
    try {
      if (child.nodeType === Node.TEXT_NODE) {
        if (depth + 1 > maxDepth) continue;
        const textNode = buildTextNode(child, nameForChildren, options);
        if (textNode) children.push(textNode);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const childElement = child as Element;

      // Annotate iframe elements without traversing their content (cross-document)
      if (childElement.tagName === 'IFRAME') {
        if (depth + 1 > maxDepth) continue;
        const iframe = childElement as HTMLIFrameElement;
        const iframeNode: SnapshotNode = {
          role: 'iframe',
          name: iframe.title || iframe.getAttribute('aria-label') || '',
          children: [],
          frameHint: generateSelector(iframe),
        };
        if (iframe.src) iframeNode.url = iframe.src;
        children.push(iframeNode);
        continue;
      }

      const childNode = buildSnapshotTree(childElement, options, depth + 1, nameForChildren);
      if (childNode) children.push(childNode);
    } catch (err) {
      console.warn('[snapshot] Error processing child node, skipping:', err);
    }
  }

  // Traverse open shadow roots (closed shadow roots return null, which is a browser security limit)
  if (element.shadowRoot) {
    for (const shadowChild of Array.from(element.shadowRoot.children)) {
      try {
        const shadowNode = buildSnapshotTree(shadowChild, options, depth + 1, nameForChildren);
        if (shadowNode) {
          shadowNode.shadow = true;
          children.push(shadowNode);
        }
      } catch (err) {
        console.warn('[snapshot] Error processing shadow child, skipping:', err);
      }
    }
  }

  // Skip non-semantic containers that only have one child with the same name.
  // Never collapse document.body itself: wrapPage() uses bodyNode.children, so collapsing
  // body to a single child (which may have no children after depth pruning) would lose it.
  if (!ref && !name && children.length === 1 && role === 'generic' && element !== document.body) {
    return children[0];
  }

  // In interactive mode, skip non-interactive nodes without interactive children.
  // Exempt nodes that match the role filter — they should always be kept.
  if (options.interactive && !isInteractive) {
    const roleMatches =
      options.filter && (role || 'generic').toLowerCase() === options.filter.toLowerCase();
    const hasInteractiveChild = children.some(hasInteractiveDescendant);
    if (!hasInteractiveChild && !ref && !roleMatches) return null;
  }

  // ARIA role filter: keep nodes whose role matches, and ancestors that lead to a match
  if (options.filter) {
    const filterRole = options.filter.toLowerCase();
    const roleMatches = (role || 'generic').toLowerCase() === filterRole;
    const hasMatchingDescendant = children.some((c) => hasRoleDescendant(c, filterRole));
    if (!roleMatches && !hasMatchingDescendant) return null;
  }

  const node: SnapshotNode = {
    role: role || 'generic',
    name: name || '',
    children,
  };

  if (ref) node.ref = ref;

  const level = getHeadingLevel(element);
  if (level) node.level = level;

  applyElementState(node, element);

  if (tag === 'a' && element.getAttribute('href')) {
    node.url = (element as HTMLAnchorElement).href;
  }

  // A childless node with no name, ref or state carries nothing: its text, if
  // any, is already reported by a StaticText node or an ancestor's name. Nodes
  // that only look empty because --depth cut their subtree are kept, so the
  // shape of the page is still visible at the boundary.
  const cutByDepth = depth >= maxDepth && element.childNodes.length > 0;
  if (children.length === 0 && !cutByDepth && !hasNodeSignal(node)) return null;

  return node;
}

function countRefsInTree(nodes: SnapshotNode[]): number {
  let count = 0;
  function walk(node: SnapshotNode) {
    if (node.ref) count++;
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return count;
}

function hasInteractiveDescendant(node: SnapshotNode): boolean {
  if (node.ref) return true;
  return node.children.some(hasInteractiveDescendant);
}

function hasRoleDescendant(node: SnapshotNode, role: string): boolean {
  if (node.role.toLowerCase() === role) return true;
  return node.children.some((c) => hasRoleDescendant(c, role));
}
