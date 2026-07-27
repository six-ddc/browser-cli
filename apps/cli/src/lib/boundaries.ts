/**
 * Content boundaries: mark which parts of stdout came from the page rather
 * than from the CLI, so an LLM reading the output can tell tool speech from
 * page speech and refuse instructions embedded in a document.
 *
 * The nonce is minted once per CLI process and printed on both markers; page
 * content cannot forge a matching pair because it cannot know the nonce.
 */

import { randomBytes } from 'node:crypto';

let enabled = false;
let boundariesInitialized = false;
let nonce: string | null = null;

/**
 * Turn boundaries on from `--boundaries` or `BROWSER_CLI_BOUNDARIES`. Sticky:
 * batch and repl reparse the root options per line, and the mode (and nonce)
 * must survive that.
 */
export function initBoundaries(explicit?: boolean): void {
  if (explicit) {
    enabled = true;
    boundariesInitialized = true;
    return;
  }
  if (boundariesInitialized) return;
  boundariesInitialized = true;
  const fromEnv = process.env.BROWSER_CLI_BOUNDARIES;
  enabled = fromEnv === '1' || fromEnv === 'true';
}

export function boundariesEnabled(): boolean {
  return enabled;
}

/** The process-wide nonce, minted lazily on first use. */
export function boundaryNonce(): string {
  nonce ??= randomBytes(16).toString('hex');
  return nonce;
}

/** Test seam: forget the mode and the nonce. */
export function resetBoundaries(): void {
  enabled = false;
  boundariesInitialized = false;
  nonce = null;
}

/**
 * Wrap page-sourced text in boundary markers, appending `notice` (a truncation
 * or omission note) inside the markers so it cannot be read as page content
 * that escaped them. Returns `text` unchanged when boundaries are off.
 */
export function wrapPageContent(text: string, notice?: string): string {
  if (!enabled) return text;
  const id = boundaryNonce();
  const body = notice ? `${text}\n${notice}` : text;
  return `[BOUNDARY_START:${id}]\n${body}\n[BOUNDARY_END:${id}]`;
}
