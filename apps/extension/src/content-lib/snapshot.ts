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
import {
  getAriaRole,
  getAccessibleName,
  getHeadingLevel,
  isInteractiveElement,
  isVisibleForSnapshot,
} from './snapshot-helpers';

export async function handleSnapshot(params: SnapshotParams): Promise<{
  snapshot: string;
  refCount: number;
}> {
  const options: SnapshotOptions = {
    interactive: params.interactive,
    compact: params.compact,
    cursor: params.cursor,
    depth: params.depth,
  };

  // Clear existing refs
  clearRefs();

  // Determine root element (scoped by selector or full body)
  let rootElement: Element = document.body;
  if (params.selector) {
    const { resolveElement } = await import('./element-ref-store');
    const scoped = resolveElement(params.selector);
    if (!scoped) {
      return { snapshot: '(no element matched selector)', refCount: 0 };
    }
    rootElement = scoped;
  }

  // Build the tree
  const root = buildSnapshotTree(rootElement, options, 0);
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
  const isInteractive = isInteractiveElement(element, { cursor: options.cursor });

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
