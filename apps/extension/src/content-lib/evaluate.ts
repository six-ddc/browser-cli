/**
 * Evaluate arbitrary JavaScript from a content script context.
 *
 * Runs in the ISOLATED world — DOM access works, but page JS globals
 * (e.g. window variables set by the page) are not visible.  This is
 * the Firefox fallback when MAIN-world eval is blocked by CSP.
 */

import type { EvaluateParams } from '@browser-cli/shared';

export async function handleEvaluate(params: EvaluateParams): Promise<{ value: unknown }> {
  const { expression } = params;

  // Content script eval() runs in the ISOLATED world and is NOT subject
  // to page CSP — only the extension's own CSP applies.  DOM objects
  // (document, elements, attributes) are shared with the page so all
  // querySelector / innerText / getAttribute patterns work.
  try {
    // eslint-disable-next-line no-eval -- intentional: user-requested eval
    const result = (0, eval)(expression);
    return { value: result };
  } catch (e: unknown) {
    throw new Error((e as Error).message);
  }
}
