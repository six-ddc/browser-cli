/**
 * Frame switching and management protocol.
 * Enables executing commands inside iframes.
 */

// ─── Frame Info ──────────────────────────────────────────────────────

export interface FrameInfo {
  /** Frame index in the frames array */
  index: number;
  /** Frame name attribute (if set) */
  name: string | null;
  /** Frame src URL */
  src: string;
  /** Whether this is the top frame */
  isMainFrame: boolean;
  /** Whether the frame is same-origin */
  isSameOrigin: boolean;
}

// ─── Frame Commands ──────────────────────────────────────────────────

export interface SwitchFrameParams {
  /** CSS selector to find the iframe */
  selector?: string;
  /** Frame name attribute */
  name?: string;
  /** Frame URL (partial match) */
  url?: string;
  /** Frame index (0-based) */
  index?: number;
  /** Switch to main/top frame */
  main?: boolean;
}

export interface SwitchFrameResult {
  /** Frame index we switched to */
  frameIndex: number;
  /** Frame info */
  frame: FrameInfo;
}

export type ListFramesParams = Record<string, never>;

export interface ListFramesResult {
  /** Current frame index */
  currentFrame: number;
  /** List of all frames */
  frames: FrameInfo[];
}

export type GetCurrentFrameParams = Record<string, never>;

export interface GetCurrentFrameResult {
  /** Current frame index (0 = main frame) */
  frameIndex: number;
  /** Current frame info */
  frame: FrameInfo;
}
