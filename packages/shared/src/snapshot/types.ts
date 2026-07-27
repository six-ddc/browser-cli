/**
 * Types for the accessibility snapshot tree.
 * The snapshot is a simplified a11y tree built by walking the DOM.
 */

import { truncateUrl } from '../util/url.js';

/** Placeholder written instead of the real value of a password field. */
export const REDACTED_VALUE = '<redacted>';

/** Default cap on total serialized snapshot size (~10k tokens). */
export const DEFAULT_SNAPSHOT_MAX_CHARS = 40000;

/** Role used for StaticText nodes carrying body copy. */
export const TEXT_ROLE = 'text';

const NAME_MAX_CHARS = 200;
const TEXT_MAX_CHARS = 200;
const VALUE_MAX_CHARS = 200;

export interface SnapshotNode {
  /** ARIA role (e.g., "heading", "link", "button", "textbox"), or "text" for StaticText */
  role: string;
  /** Accessible name */
  name: string;
  /** Element ref if interactive (e.g., "@e1") */
  ref?: string;
  /** Child nodes */
  children: SnapshotNode[];
  /** Body copy for StaticText nodes (role === "text") */
  text?: string;
  /** Additional properties */
  level?: number;
  /** Whether the element is disabled (native disabled or aria-disabled) */
  disabled?: boolean;
  /** Whether the element is checked (checkbox/radio/aria-checked) */
  checked?: boolean | 'mixed';
  /** Current value (input, select, etc.) */
  value?: string;
  /** Whether the element is expanded (details, aria-expanded) */
  expanded?: boolean;
  /** Whether the element is required */
  required?: boolean;
  /** Whether the element is read-only */
  readonly?: boolean;
  /** Whether the element is selected (option/aria-selected) */
  selected?: boolean;
  /** Whether the element currently holds focus */
  focused?: boolean;
  /** URL for links and images */
  url?: string;
  /** Selector to pass to `frame` for entering this iframe */
  frameHint?: string;
  /** Node is the root of a shadow-root subtree */
  shadow?: boolean;
}

export interface SnapshotOptions {
  /** Only include interactive elements and their ancestors */
  interactive?: boolean;
  /** Compact output (drop pure-structure nodes, reduce whitespace) */
  compact?: boolean;
  /** Include cursor-interactive elements (cursor:pointer) */
  cursor?: boolean;
  /** Max depth of tree traversal */
  depth?: number;
  /** Only show nodes with this ARIA role (and their ancestors) */
  filter?: string;
  /** Cap on total serialized output size in characters */
  maxChars?: number;
}

/** Roles that carry no meaning of their own — droppable in compact mode. */
const STRUCTURAL_ROLES = new Set(['generic', 'presentation', 'none', '']);

/** Whether a node reports anything beyond its position in the tree. */
export function hasNodeSignal(node: SnapshotNode): boolean {
  return (
    !!node.ref ||
    !!node.name ||
    node.text !== undefined ||
    node.level !== undefined ||
    node.value !== undefined ||
    node.checked !== undefined ||
    node.expanded !== undefined ||
    node.url !== undefined ||
    node.frameHint !== undefined ||
    !!node.disabled ||
    !!node.required ||
    !!node.readonly ||
    !!node.selected ||
    !!node.focused ||
    !!node.shadow
  );
}

/**
 * Semantic compaction: drop pure-structure nodes (generic/presentation with no
 * name, ref or state) and splice their children into the parent. Collapsing a
 * single-child chain falls out of the same rule.
 */
export function compactSnapshotTree(nodes: SnapshotNode[]): SnapshotNode[] {
  const out: SnapshotNode[] = [];
  for (const node of nodes) {
    const children = compactSnapshotTree(node.children);
    if (STRUCTURAL_ROLES.has(node.role) && !hasNodeSignal(node)) {
      out.push(...children);
    } else {
      out.push({ ...node, children });
    }
  }
  return out;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function escapeQuoted(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ');
}

function truncateTotal(lines: string[], maxChars: number): string {
  let total = 0;
  const kept: string[] = [];
  for (const line of lines) {
    if (total + line.length + 1 > maxChars && kept.length > 0) break;
    kept.push(line);
    total += line.length + 1;
  }
  if (kept.length === lines.length) return lines.join('\n');
  kept.push(
    `[truncated: showing ${kept.length} of ${lines.length} lines. Use -i / -s <selector> / -d <depth> / --max-chars <n> to narrow]`,
  );
  return kept.join('\n');
}

/**
 * Serialize a snapshot tree to indented text format.
 * Output matches agent-browser's snapshot format.
 */
export function serializeSnapshot(
  nodes: SnapshotNode[],
  options?: { compact?: boolean; maxChars?: number },
): string {
  const lines: string[] = [];
  const indent = options?.compact ? '  ' : '    ';
  const tree = options?.compact ? compactSnapshotTree(nodes) : nodes;

  function walk(node: SnapshotNode, depth: number) {
    const prefix = indent.repeat(depth);
    let line = `${prefix}${node.role}`;

    if (node.text !== undefined) {
      line += ` "${escapeQuoted(truncate(node.text, TEXT_MAX_CHARS))}"`;
    } else if (node.name) {
      line += ` "${escapeQuoted(truncate(node.name, NAME_MAX_CHARS))}"`;
    }

    // Additional attributes
    const attrs: string[] = [];
    if (node.level !== undefined) attrs.push(`level=${node.level}`);
    if (node.disabled) attrs.push('disabled');
    if (node.readonly) attrs.push('readonly');
    if (node.required) attrs.push('required');
    if (node.checked !== undefined) attrs.push(`checked=${node.checked}`);
    if (node.selected) attrs.push('selected');
    if (node.expanded !== undefined) attrs.push(`expanded=${node.expanded}`);
    if (node.focused) attrs.push('focused');
    if (node.value !== undefined) {
      attrs.push(
        node.value === REDACTED_VALUE
          ? `value=${REDACTED_VALUE}`
          : `value="${escapeQuoted(truncate(node.value, VALUE_MAX_CHARS))}"`,
      );
    }
    if (node.url) attrs.push(`url="${truncateUrl(node.url, { maxQueryLength: 20 })}"`);

    if (attrs.length > 0) {
      line += ` (${attrs.join(', ')})`;
    }

    if (node.ref) {
      line += ` [${node.ref}]`;
    }

    if (node.frameHint) {
      line += ` [use: frame ${node.frameHint}]`;
    }

    if (node.shadow) {
      line += ' #shadow';
    }

    lines.push(line);

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const node of tree) {
    walk(node, 0);
  }

  const maxChars = options?.maxChars ?? DEFAULT_SNAPSHOT_MAX_CHARS;
  return truncateTotal(lines, maxChars);
}
