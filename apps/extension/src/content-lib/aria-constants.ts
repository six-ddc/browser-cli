/**
 * ARIA role constants extracted from agent-browser.
 * These define which roles are interactive, content-bearing, or structural.
 */

/**
 * Roles that are interactive and should get refs
 */
export const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'treeitem',
]);

/**
 * Roles that provide structure/context (get refs for text extraction)
 */
export const CONTENT_ROLES = new Set([
  'heading',
  'cell',
  'gridcell',
  'columnheader',
  'rowheader',
  'listitem',
  'article',
  'region',
  'main',
  'navigation',
]);

/**
 * Roles that are purely structural (can be filtered in compact mode)
 */
export const STRUCTURAL_ROLES = new Set([
  'generic',
  'group',
  'list',
  'table',
  'row',
  'rowgroup',
  'grid',
  'treegrid',
  'menu',
  'menubar',
  'toolbar',
  'tablist',
  'tree',
  'directory',
  'document',
  'application',
  'presentation',
  'none',
]);

/**
 * All valid ARIA roles (comprehensive list for validation)
 */
export const ALL_ARIA_ROLES = new Set([
  // Interactive
  ...INTERACTIVE_ROLES,

  // Content
  ...CONTENT_ROLES,

  // Structural
  ...STRUCTURAL_ROLES,

  // Additional roles
  'alert',
  'alertdialog',
  'banner',
  'complementary',
  'contentinfo',
  'definition',
  'dialog',
  'feed',
  'figure',
  'form',
  'img',
  'log',
  'marquee',
  'math',
  'note',
  'paragraph',
  'progressbar',
  'scrollbar',
  'search',
  'separator',
  'status',
  'term',
  'timer',
  'tooltip',
]);

/**
 * Check if a role is interactive
 */
export function isInteractiveRole(role: string): boolean {
  return INTERACTIVE_ROLES.has(role.toLowerCase());
}

/**
 * Check if a role provides content
 */
export function isContentRole(role: string): boolean {
  return CONTENT_ROLES.has(role.toLowerCase());
}

/**
 * Check if a role is structural
 */
export function isStructuralRole(role: string): boolean {
  return STRUCTURAL_ROLES.has(role.toLowerCase());
}

/**
 * Check if a role is valid
 */
export function isValidAriaRole(role: string): boolean {
  return ALL_ARIA_ROLES.has(role.toLowerCase());
}
