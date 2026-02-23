/**
 * Types for the accessibility snapshot tree.
 * The snapshot is a simplified a11y tree built by walking the DOM.
 */

import { truncateUrl } from '../util/url.js';

export interface SnapshotNode {
  /** ARIA role (e.g., "heading", "link", "button", "textbox") */
  role: string;
  /** Accessible name */
  name: string;
  /** Element ref if interactive (e.g., "@e1") */
  ref?: string;
  /** Child nodes */
  children: SnapshotNode[];
  /** Additional properties */
  level?: number;
  /** Whether the element is disabled */
  disabled?: boolean;
  /** Whether the element is checked (checkbox/radio) */
  checked?: boolean | 'mixed';
  /** Current value (input, select, etc.) */
  value?: string;
  /** Whether the element is expanded (details, tree, etc.) */
  expanded?: boolean;
  /** Whether the element is required */
  required?: boolean;
  /** URL for links and images */
  url?: string;
}

export interface SnapshotOptions {
  /** Only include interactive elements and their ancestors */
  interactive?: boolean;
  /** Compact output (reduce whitespace) */
  compact?: boolean;
  /** Include cursor-interactive elements (cursor:pointer) */
  cursor?: boolean;
  /** Max depth of tree traversal (0 = unlimited) */
  depth?: number;
}

/**
 * Serialize a snapshot tree to indented text format.
 * Output matches agent-browser's snapshot format.
 */
export function serializeSnapshot(
  nodes: SnapshotNode[],
  options?: { compact?: boolean },
): string {
  const lines: string[] = [];
  const indent = options?.compact ? '  ' : '    ';

  function walk(node: SnapshotNode, depth: number) {
    const prefix = indent.repeat(depth);
    let line = `${prefix}${node.role}`;

    if (node.name) {
      line += ` "${node.name}"`;
    }

    // Additional attributes
    const attrs: string[] = [];
    if (node.level !== undefined) attrs.push(`level=${node.level}`);
    if (node.disabled) attrs.push('disabled');
    if (node.checked !== undefined) attrs.push(`checked=${node.checked}`);
    if (node.value !== undefined) attrs.push(`value="${node.value}"`);
    if (node.expanded !== undefined) attrs.push(`expanded=${node.expanded}`);
    if (node.required) attrs.push('required');
    if (node.url) attrs.push(`url="${truncateUrl(node.url)}"`);

    if (attrs.length > 0) {
      line += ` (${attrs.join(', ')})`;
    }

    if (node.ref) {
      line += ` [${node.ref}]`;
    }

    lines.push(line);

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const node of nodes) {
    walk(node, 0);
  }

  return lines.join('\n');
}
