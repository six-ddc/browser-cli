/**
 * Accessibility snapshot: DOM walk → ARIA role → accessible name → ref assignment.
 * Produces a text tree similar to agent-browser's snapshot output.
 */

import type { SnapshotNode, SnapshotOptions } from '@browser-cli/shared';
import { serializeSnapshot } from '@browser-cli/shared';
import type { SnapshotParams } from '@browser-cli/shared';
import { clearRefs, registerElement, generateSelector, getRefCount } from './element-ref-store';
import {
  getAriaRole,
  getAccessibleName,
  getHeadingLevel,
  isInteractiveElement,
  isVisibleForSnapshot,
} from './snapshot-helpers';

/** Safety limit to prevent stack overflow on deeply nested DOMs (crash observed at ~2000 levels). */
const MAX_DEPTH = 100;

export async function handleSnapshot(params: SnapshotParams): Promise<{
  snapshot: string;
  refCount: number;
}> {
  const options: SnapshotOptions = {
    interactive: params.interactive,
    compact: params.compact,
    cursor: params.cursor,
    // Use explicit --depth if provided, otherwise apply safety limit
    depth: params.depth || MAX_DEPTH,
    filter: params.filter,
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

  const snapshot = serializeSnapshot(nodes, { compact: options.compact });
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
  const isInteractive = isInteractiveElement(element, { cursor: options.cursor });

  // Assign ref if interactive and has non-zero dimensions (actually visible on screen)
  let ref: string | undefined;
  if (isInteractive) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      ref = registerElement(element, generateSelector(element));
    }
  } else if (options.depth && depth >= options.depth) {
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

  // Build children — snapshot into Array.from() to avoid live HTMLCollection mutation issues
  const children: SnapshotNode[] = [];
  const childElements = Array.from(element.children);

  // Traverse open shadow roots (closed shadow roots return null, which is a browser security limit)
  if (element.shadowRoot) {
    childElements.push(...Array.from(element.shadowRoot.children));
  }

  for (const child of childElements) {
    try {
      // Annotate iframe elements without traversing their content (cross-document)
      if (child.tagName === 'IFRAME') {
        const iframe = child as HTMLIFrameElement;
        const iframeName = iframe.title || iframe.getAttribute('aria-label') || '';
        const iframeSrc = iframe.src || '';
        const iframeNode: SnapshotNode = {
          role: 'iframe',
          name: iframeName,
          children: [],
        };
        if (iframeSrc) iframeNode.url = iframeSrc;
        children.push(iframeNode);
        continue;
      }
      const childNode = buildSnapshotTree(child, options, depth + 1);
      if (childNode) children.push(childNode);
    } catch (err) {
      console.warn('[snapshot] Error processing child element, skipping:', err);
    }
  }

  // Handle text nodes
  if (children.length === 0 && !name && !ref) {
    const text = element.textContent.trim();
    if (!text) return null;
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
