/**
 * Shadow-DOM piercing queries.
 *
 * Two selector forms are supported:
 *  - plain CSS — matched in the light DOM first, then in every shadow root
 *    below the search root (light matches always come first in the result);
 *  - explicit path — ` >>> ` crosses one shadow boundary, e.g.
 *    `#host >>> #inner`. This is what generateSelector() emits for elements
 *    inside a shadow root, so a stored selector can be resolved again later.
 *
 * Closed shadow roots are only reachable through `chrome.dom`, which exists
 * in Chrome content scripts and needs no permission. Everywhere else (Firefox,
 * jsdom) closed roots stay invisible, exactly like they are to page scripts.
 */

const SHADOW_COMBINATOR = '>>>';
const SHADOW_COMBINATOR_RE = /\s*>>>\s*/;

/** Hosts the extension itself attaches must never be matched by page queries. */
const INTERNAL_HOSTS = new Set(['BROWSER-CLI-OVERLAY']);

interface ChromeDomApi {
  dom?: { openOrClosedShadowRoot?: (element: Element) => ShadowRoot | null };
}

export interface DeepQueryOptions {
  root?: ParentNode;
  /** Stop as soon as this many elements matched. */
  limit?: number;
}

export function hasShadowCombinator(selector: string): boolean {
  return selector.includes(SHADOW_COMBINATOR);
}

/** Join a host selector and an inner selector into a piercing path. */
export function joinShadowPath(hostSelector: string, innerSelector: string): string {
  return `${hostSelector} ${SHADOW_COMBINATOR} ${innerSelector}`;
}

/** Open root via the standard property, closed root via chrome.dom when available. */
export function getShadowRoot(host: Element): ShadowRoot | null {
  if (INTERNAL_HOSTS.has(host.tagName)) return null;
  if (host.shadowRoot) return host.shadowRoot;

  const dom = (globalThis as { chrome?: ChromeDomApi }).chrome?.dom;
  if (typeof dom?.openOrClosedShadowRoot !== 'function') return null;
  try {
    return dom.openOrClosedShadowRoot(host);
  } catch {
    return null;
  }
}

/** The shadow root a node lives in, or null when it is in the light DOM. */
export function shadowHostOf(node: Node): Element | null {
  const root = node.getRootNode();
  if (typeof ShadowRoot === 'undefined' || !(root instanceof ShadowRoot)) return null;
  return root.host;
}

/**
 * Whether `container` contains `el` in the composed (flattened) tree —
 * Node.contains() stops at shadow boundaries, this walks through hosts.
 */
export function composedContains(container: Element, el: Element): boolean {
  let current: Element | null = el;
  while (current) {
    if (current === container) return true;
    current = current.parentElement ?? shadowHostOf(current);
  }
  return false;
}

/** Every shadow root below `root`, depth-first in document order. */
export function* shadowRootsUnder(root: ParentNode): Generator<ShadowRoot> {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const shadow = getShadowRoot(el);
    if (!shadow) continue;
    yield shadow;
    yield* shadowRootsUnder(shadow);
  }
}

/** `root` followed by every shadow root below it — one entry per query scope. */
export function searchRoots(root: ParentNode): ParentNode[] {
  return [root, ...shadowRootsUnder(root)];
}

export function deepQuerySelectorAll(selector: string, options: DeepQueryOptions = {}): Element[] {
  const root = options.root ?? document;
  const { limit } = options;

  if (hasShadowCombinator(selector)) return queryShadowPath(selector, root, limit);

  const results = Array.from(root.querySelectorAll(selector));
  if (reachedLimit(results, limit)) return results;

  for (const shadow of shadowRootsUnder(root)) {
    for (const el of Array.from(shadow.querySelectorAll(selector))) {
      results.push(el);
      if (reachedLimit(results, limit)) return results;
    }
  }

  return results;
}

export function deepQuerySelector(selector: string, root?: ParentNode): Element | null {
  return deepQuerySelectorAll(selector, { root, limit: 1 })[0] ?? null;
}

function reachedLimit(results: Element[], limit: number | undefined): boolean {
  return limit !== undefined && results.length >= limit;
}

function queryShadowPath(selector: string, root: ParentNode, limit?: number): Element[] {
  const segments = selector.split(SHADOW_COMBINATOR_RE).filter((part) => part.length > 0);
  if (segments.length === 0) return [];

  let contexts: ParentNode[] = [root];
  let matches: Element[] = [];

  for (let i = 0; i < segments.length; i++) {
    matches = [];
    for (const context of contexts) {
      matches.push(...Array.from(context.querySelectorAll(segments[i])));
    }
    if (i === segments.length - 1) break;

    contexts = matches
      .map((el) => getShadowRoot(el))
      .filter((shadow): shadow is ShadowRoot => shadow !== null);
    if (contexts.length === 0) return [];
  }

  return limit === undefined ? matches : matches.slice(0, limit);
}
