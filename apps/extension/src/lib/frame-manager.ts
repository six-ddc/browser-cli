/**
 * Frame manager for tracking and switching between frames.
 * Maintains per-tab frame state.
 */

interface FrameInfo {
  index: number;
  name: string | null;
  src: string;
  isMainFrame: boolean;
  isSameOrigin: boolean;
}

interface TabFrameState {
  currentFrameIndex: number;
  frames: FrameInfo[];
}

/**
 * Global frame manager (singleton pattern).
 * Tracks which frame is active for each tab.
 */
class FrameManager {
  private tabStates = new Map<number, TabFrameState>();

  /**
   * Initialize or update frame list for a tab.
   */
  setFrames(tabId: number, frames: FrameInfo[]): void {
    const existing = this.tabStates.get(tabId);
    this.tabStates.set(tabId, {
      currentFrameIndex: existing?.currentFrameIndex ?? 0,
      frames,
    });
  }

  /**
   * Switch to a specific frame index.
   */
  switchToFrame(tabId: number, frameIndex: number): void {
    const state = this.tabStates.get(tabId);
    if (!state) {
      throw new Error(`No frame state for tab ${tabId}`);
    }
    if (frameIndex < 0 || frameIndex >= state.frames.length) {
      throw new Error(`Invalid frame index: ${frameIndex}`);
    }
    state.currentFrameIndex = frameIndex;
  }

  /**
   * Switch to main frame (index 0).
   */
  switchToMainFrame(tabId: number): void {
    this.switchToFrame(tabId, 0);
  }

  /**
   * Get current frame index for a tab.
   */
  getCurrentFrameIndex(tabId: number): number {
    return this.tabStates.get(tabId)?.currentFrameIndex ?? 0;
  }

  /**
   * Get current frame info for a tab.
   */
  getCurrentFrame(tabId: number): FrameInfo | null {
    const state = this.tabStates.get(tabId);
    if (!state) return null;
    return state.frames[state.currentFrameIndex] ?? null;
  }

  /**
   * Get all frames for a tab.
   */
  getFrames(tabId: number): FrameInfo[] {
    return this.tabStates.get(tabId)?.frames ?? [];
  }

  /**
   * Clear state for a tab (call when tab is closed).
   */
  clearTab(tabId: number): void {
    this.tabStates.delete(tabId);
  }

  /**
   * Check if we're currently in a frame (not main).
   */
  isInFrame(tabId: number): boolean {
    return this.getCurrentFrameIndex(tabId) > 0;
  }
}

export const frameManager = new FrameManager();
export type { FrameInfo };
