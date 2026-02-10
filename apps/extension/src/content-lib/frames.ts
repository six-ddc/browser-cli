/**
 * Frame management handlers for content scripts.
 */

import type {
  SwitchFrameParams,
  SwitchFrameResult,
  ListFramesResult,
  GetCurrentFrameResult,
} from '@browser-cli/shared';
import { discoverFrames, findFrame } from './frame-bridge';

// Global state to track current frame
let currentFrameIndex = 0;
let currentFrames: ReturnType<typeof discoverFrames> = [];

/**
 * List all frames in the page.
 */
export function handleListFrames(): ListFramesResult {
  currentFrames = discoverFrames();

  return {
    currentFrame: currentFrameIndex,
    frames: currentFrames,
  };
}

/**
 * Get current frame info.
 */
export function handleGetCurrentFrame(): GetCurrentFrameResult {
  if (currentFrames.length === 0) {
    currentFrames = discoverFrames();
  }

  const frame = currentFrames[currentFrameIndex] || currentFrames[0];

  return {
    frameIndex: currentFrameIndex,
    frame,
  };
}

/**
 * Switch to a different frame.
 */
export function handleSwitchFrame(params: SwitchFrameParams): SwitchFrameResult {
  // Refresh frame list
  currentFrames = discoverFrames();

  // Switch to main frame
  if (params.main) {
    currentFrameIndex = 0;
    return {
      frameIndex: 0,
      frame: currentFrames[0],
    };
  }

  // Find and switch to target frame
  const { frameIndex } = findFrame(params);
  currentFrameIndex = frameIndex;

  return {
    frameIndex,
    frame: currentFrames[frameIndex],
  };
}

/**
 * Get the current frame index (for use by other handlers).
 */
export function getCurrentFrameIndex(): number {
  return currentFrameIndex;
}

/**
 * Get the current iframe element (if in a frame).
 */
export function getCurrentIFrame(): HTMLIFrameElement | null {
  if (currentFrameIndex === 0) return null;

  const iframes = Array.from(document.querySelectorAll('iframe'));
  return iframes[currentFrameIndex - 1] || null;
}
