/**
 * Frame handlers for content scripts.
 *
 * The content script never routes commands into an iframe itself — the
 * background delivers each command straight to the target frame's content
 * script by frameId. These handlers only describe the current document and
 * help the background map an iframe element onto a frameId.
 */

import type {
  FrameDocumentInfo,
  FrameOffsetParams,
  FrameOffsetResult,
  ResolveFrameParams,
  ResolveFrameResult,
} from '@browser-cli/shared';
import { BrowserCliError } from '@browser-cli/shared';
import { resolveElement } from './element-ref-store';

function isFrameElement(el: Element | null): el is HTMLIFrameElement {
  return el != null && el.tagName === 'IFRAME';
}

/**
 * Index of a frame element among this document's child browsing contexts.
 * `window[i]` and `iframe.contentWindow` are both WindowProxy references, and
 * comparing them is allowed cross-origin — no property access is involved.
 */
function browsingContextIndex(el: HTMLIFrameElement): number {
  const contentWindow = el.contentWindow;
  if (!contentWindow) return -1;
  const indexed = window as unknown as Record<number, Window | undefined>;
  for (let i = 0; i < window.length; i++) {
    if (indexed[i] === contentWindow) return i;
  }
  return -1;
}

function frameElementAt(index: number): HTMLIFrameElement | null {
  const indexed = window as unknown as Record<number, Window | undefined>;
  const target = indexed[index];
  if (!target) return null;
  for (const el of document.querySelectorAll('iframe')) {
    if (isFrameElement(el) && el.contentWindow === target) return el;
  }
  return null;
}

export function handleGetCurrentFrame(): FrameDocumentInfo {
  return {
    url: location.href,
    name: window.name || null,
    title: document.title || null,
    isMainFrame: window === window.top,
  };
}

export function handleResolveFrame(params: ResolveFrameParams): ResolveFrameResult {
  const el = resolveElement(params.selector);
  if (!el) {
    throw new BrowserCliError(
      'ELEMENT_NOT_FOUND',
      `No element matches "${params.selector}" in the current frame.`,
      "Run 'frame list' to see the frames on this page, or 'snapshot -i' to inspect the current document.",
    );
  }
  if (!isFrameElement(el)) {
    throw new BrowserCliError(
      'FRAME_ERROR',
      `"${params.selector}" matches a <${el.tagName.toLowerCase()}>, not an <iframe>.`,
      "Pass a selector that matches an <iframe> element, or run 'frame list' to switch by frameId.",
    );
  }

  const srcAttr = el.getAttribute('src');
  let src = '';
  if (srcAttr) {
    try {
      src = new URL(srcAttr, document.baseURI).href;
    } catch {
      src = srcAttr;
    }
  }

  return {
    index: browsingContextIndex(el),
    total: window.length,
    src,
    name: el.getAttribute('name'),
    srcdoc: el.hasAttribute('srcdoc'),
  };
}

export function handleFrameOffset(params: FrameOffsetParams): FrameOffsetResult {
  const el = frameElementAt(params.index);
  if (!el) {
    throw new BrowserCliError(
      'FRAME_ERROR',
      `No frame element found at child index ${params.index} in this document.`,
      "The frame tree changed since the last 'frame' command — run 'frame list' and switch again.",
    );
  }

  if (params.scroll) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
  }

  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);

  let scaled = false;
  if (style.transform && style.transform !== 'none') {
    try {
      const m = new DOMMatrix(style.transform);
      scaled =
        Math.abs(m.a - 1) > 1e-6 ||
        Math.abs(m.d - 1) > 1e-6 ||
        Math.abs(m.b) > 1e-6 ||
        Math.abs(m.c) > 1e-6;
    } catch {
      scaled = true;
    }
  }

  const num = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    x: rect.left + num(style.borderLeftWidth) + num(style.paddingLeft),
    y: rect.top + num(style.borderTopWidth) + num(style.paddingTop),
    scaled,
  };
}
