/**
 * Semantic locator resolution: find elements by role, text, label, xpath, etc.
 * Uses AgentBrowser-compatible = syntax (e.g. text=Submit, role=button[name="Submit"]).
 */

import type {
  SemanticLocator,
  RoleLocator,
  TextLocator,
  LabelLocator,
  PlaceholderLocator,
  AltLocator,
  TitleLocator,
  TestIdLocator,
  XPathLocator,
} from '@browser-cli/shared';
import {
  getAriaRole,
  getAccessibleName,
  isVisibleForSnapshot,
  matchText,
} from './snapshot-helpers';
import { searchRoots } from './deep-query';

/**
 * Walk every element below `root`, descending into shadow roots — a TreeWalker
 * stops at shadow boundaries, so each shadow tree needs its own walker.
 * Invisible elements are skipped but their children are still visited, and the
 * root element itself is always yielded (matching a bare TreeWalker's start).
 */
function* walkElements(root: Element, includeHidden: boolean): Generator<Element> {
  for (const searchRoot of searchRoots(root)) {
    const walker = document.createTreeWalker(searchRoot as Node, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) =>
        includeHidden || isVisibleForSnapshot(node as Element)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    });

    let current: Node | null =
      walker.currentNode.nodeType === Node.ELEMENT_NODE ? walker.currentNode : walker.nextNode();
    while (current) {
      yield current as Element;
      current = walker.nextNode();
    }
  }
}

/** Run a CSS query in `root` and in every shadow root below it. */
function queryAllDeep(root: Element, selector: string): Element[] {
  const results: Element[] = [];
  for (const searchRoot of searchRoots(root)) {
    results.push(...Array.from(searchRoot.querySelectorAll(selector)));
  }
  return results;
}

/** getElementById scoped to the tree the node lives in (document or shadow root). */
function elementByIdInScope(node: Node, id: string): Element | null {
  const scope = node.getRootNode() as Partial<Document>;
  if (typeof scope.getElementById === 'function') return scope.getElementById(id);
  return document.getElementById(id);
}

/**
 * Resolve a semantic locator to matching DOM elements.
 *
 * @param locator Parsed semantic locator
 * @param root Root element to search from (defaults to document.body)
 * @returns Array of matching elements
 */
export function resolveSemanticLocator(
  locator: SemanticLocator,
  root: Element = document.body,
): Element[] {
  switch (locator.type) {
    case 'role':
      return findByRole(locator, root);
    case 'text':
      return findByText(locator, root);
    case 'label':
      return findByLabel(locator, root);
    case 'placeholder':
      return findByPlaceholder(locator, root);
    case 'alt':
      return findByAlt(locator, root);
    case 'title':
      return findByTitle(locator, root);
    case 'testid':
      return findByTestId(locator, root);
    case 'xpath':
      return findByXPath(locator, root);
  }
}

/**
 * Find elements by ARIA role and optional accessible name.
 *
 * @example
 * findByRole({ type: 'role', role: 'button', name: 'Submit', options: { exact: true } })
 * // Finds: <button>Submit</button>
 */
export function findByRole(locator: RoleLocator, root: Element = document.body): Element[] {
  const { role, name, options } = locator;
  const results: Element[] = [];

  for (const el of walkElements(root, options.includeHidden ?? false)) {
    const elementRole = getAriaRole(el);
    if (elementRole.toLowerCase() !== role.toLowerCase()) continue;

    // If name is specified, check accessible name
    if (name !== undefined) {
      const accessibleName = getAccessibleName(el);
      if (
        matchText(accessibleName, name, {
          exact: options.exact ?? true,
          ignoreCase: options.ignoreCase ?? true,
        })
      ) {
        results.push(el);
      }
    } else {
      // No name filter, add all matching roles
      results.push(el);
    }
  }

  return results;
}

/**
 * Find elements by text content.
 *
 * @example
 * findByText({ type: 'text', text: 'Sign In', options: { exact: false } })
 * // Finds: <div>Sign In Now</div>
 */
export function findByText(locator: TextLocator, root: Element = document.body): Element[] {
  const { text, options } = locator;
  const results: Element[] = [];

  for (const el of walkElements(root, options.includeHidden ?? false)) {
    const textContent = el.textContent.trim();

    if (
      textContent &&
      matchText(textContent, text, {
        exact: options.exact ?? false,
        ignoreCase: options.ignoreCase ?? true,
      })
    ) {
      results.push(el);
    }
  }

  // Prefer the most specific (deepest) elements: remove any element
  // that has a descendant also in the results. This matches
  // Playwright's getByText behavior of returning the innermost match.
  return results.filter((el) => !results.some((other) => other !== el && el.contains(other)));
}

/**
 * Find form elements by their associated label text.
 *
 * @example
 * findByLabel({ type: 'label', labelText: 'Email', options: { exact: false } })
 * // Finds: <input id="email"> with <label for="email">Email Address</label>
 */
export function findByLabel(locator: LabelLocator, root: Element = document.body): Element[] {
  const { labelText, options } = locator;
  const results: Element[] = [];

  // Find all labels
  const labels = queryAllDeep(root, 'label') as HTMLLabelElement[];

  for (const label of labels) {
    const text = label.textContent.trim();
    if (
      !matchText(text, labelText, {
        exact: options.exact ?? false,
        ignoreCase: options.ignoreCase ?? true,
      })
    ) {
      continue;
    }

    // Find associated form element
    let target: Element | null = null;

    // Try htmlFor attribute
    const htmlFor = label.htmlFor;
    if (htmlFor) {
      target = elementByIdInScope(label, htmlFor);
    }

    // Try nested input
    if (!target) {
      target = label.querySelector('input, textarea, select');
    }

    if (target) {
      // Check visibility
      if (!options.includeHidden && !isVisibleForSnapshot(target)) {
        continue;
      }

      results.push(target);
    }
  }

  return results;
}

/**
 * Find input elements by placeholder text.
 *
 * @example
 * findByPlaceholder({ type: 'placeholder', text: 'Search', options: { exact: false } })
 * // Finds: <input placeholder="Search..." />
 */
export function findByPlaceholder(
  locator: PlaceholderLocator,
  root: Element = document.body,
): Element[] {
  const { text, options } = locator;
  const results: Element[] = [];

  const inputs = queryAllDeep(root, 'input, textarea');

  for (const input of inputs) {
    const placeholder = input.getAttribute('placeholder') || '';

    if (
      matchText(placeholder, text, {
        exact: options.exact ?? false,
        ignoreCase: options.ignoreCase ?? true,
      })
    ) {
      if (!options.includeHidden && !isVisibleForSnapshot(input)) {
        continue;
      }

      results.push(input);
    }
  }

  return results;
}

/**
 * Find images by alt text.
 *
 * @example
 * findByAlt({ type: 'alt', text: 'Logo', options: { exact: false } })
 * // Finds: <img alt="Company Logo" />
 */
export function findByAlt(locator: AltLocator, root: Element = document.body): Element[] {
  const { text, options } = locator;
  const results: Element[] = [];

  const images = queryAllDeep(root, 'img');

  for (const img of images) {
    const alt = img.getAttribute('alt') || '';

    if (
      matchText(alt, text, {
        exact: options.exact ?? false,
        ignoreCase: options.ignoreCase ?? true,
      })
    ) {
      if (!options.includeHidden && !isVisibleForSnapshot(img)) {
        continue;
      }

      results.push(img);
    }
  }

  return results;
}

/**
 * Find elements by title attribute.
 *
 * @example
 * findByTitle({ type: 'title', text: 'Help', options: { exact: false } })
 * // Finds: <button title="Help Center">?</button>
 */
export function findByTitle(locator: TitleLocator, root: Element = document.body): Element[] {
  const { text, options } = locator;
  const results: Element[] = [];

  for (const el of walkElements(root, options.includeHidden ?? false)) {
    const title = el.getAttribute('title') || '';

    if (
      title &&
      matchText(title, text, {
        exact: options.exact ?? false,
        ignoreCase: options.ignoreCase ?? true,
      })
    ) {
      results.push(el);
    }
  }

  return results;
}

/**
 * Find elements by data-testid attribute.
 *
 * @example
 * findByTestId({ type: 'testid', value: 'login-button', options: { exact: true } })
 * // Finds: <button data-testid="login-button">Login</button>
 */
export function findByTestId(locator: TestIdLocator, root: Element = document.body): Element[] {
  const { value, options } = locator;
  const results: Element[] = [];

  // Fast path for exact match
  if (options.exact !== false) {
    const elements = queryAllDeep(root, `[data-testid="${CSS.escape(value)}"]`);
    for (const el of elements) {
      if (!options.includeHidden && !isVisibleForSnapshot(el)) {
        continue;
      }
      results.push(el);
    }
    return results;
  }

  // Slow path for contains match
  const allWithTestId = queryAllDeep(root, '[data-testid]');
  for (const el of allWithTestId) {
    const testId = el.getAttribute('data-testid') || '';

    if (
      matchText(testId, value, {
        exact: false,
        ignoreCase: options.ignoreCase ?? false,
      })
    ) {
      if (!options.includeHidden && !isVisibleForSnapshot(el)) {
        continue;
      }

      results.push(el);
    }
  }

  return results;
}

/**
 * Find elements by XPath expression.
 *
 * @example
 * findByXPath({ type: 'xpath', expression: '//button[@type="submit"]', options: {} })
 * // Finds: <button type="submit">Submit</button>
 *
 * XPath cannot address shadow trees — this is the one locator that does not
 * pierce shadow roots.
 */
export function findByXPath(locator: XPathLocator, root: Element = document.body): Element[] {
  const { expression } = locator;
  const results: Element[] = [];

  // Guard: XPath not available in some test environments
  if (typeof XPathResult === 'undefined' || typeof document.evaluate !== 'function') {
    return results;
  }

  const contextNode = root === document.body ? document : root;

  try {
    const xpathResult = document.evaluate(
      expression,
      contextNode,
      null,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
      null,
    );

    let node = xpathResult.iterateNext();
    while (node) {
      if (node instanceof Element) {
        results.push(node);
      }
      node = xpathResult.iterateNext();
    }
  } catch (err) {
    throw new Error(`Invalid XPath expression "${expression}": ${(err as Error).message}`);
  }

  return results;
}
