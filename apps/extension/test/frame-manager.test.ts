/**
 * Tests for frame-manager: singleton FrameManager that tracks
 * per-tab frame state and supports switching between frames.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { frameManager } from '../src/lib/frame-manager';

const TAB_ID = 100;

const makeFrames = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    index: i,
    name: i === 0 ? null : `frame-${i}`,
    src: `https://example.com/frame-${i}`,
    isMainFrame: i === 0,
    isSameOrigin: true,
  }));

beforeEach(() => {
  frameManager.clearTab(TAB_ID);
  frameManager.clearTab(TAB_ID + 1);
});

// ─── setFrames ──────────────────────────────────────────────────────

describe('setFrames', () => {
  it('stores frames for a tab', () => {
    const frames = makeFrames(3);
    frameManager.setFrames(TAB_ID, frames);
    expect(frameManager.getFrames(TAB_ID)).toEqual(frames);
  });

  it('defaults currentFrameIndex to 0 for new tab', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    expect(frameManager.getCurrentFrameIndex(TAB_ID)).toBe(0);
  });

  it('preserves currentFrameIndex on update if already set', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    frameManager.switchToFrame(TAB_ID, 2);
    frameManager.setFrames(TAB_ID, makeFrames(4));
    expect(frameManager.getCurrentFrameIndex(TAB_ID)).toBe(2);
  });
});

// ─── switchToFrame ──────────────────────────────────────────────────

describe('switchToFrame', () => {
  it('changes current frame index', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    frameManager.switchToFrame(TAB_ID, 1);
    expect(frameManager.getCurrentFrameIndex(TAB_ID)).toBe(1);
  });

  it('throws if tab has no frame state', () => {
    expect(() => frameManager.switchToFrame(999, 0)).toThrow('No frame state for tab');
  });

  it('throws for negative frame index', () => {
    frameManager.setFrames(TAB_ID, makeFrames(2));
    expect(() => frameManager.switchToFrame(TAB_ID, -1)).toThrow('Invalid frame index');
  });

  it('throws for frame index >= length', () => {
    frameManager.setFrames(TAB_ID, makeFrames(2));
    expect(() => frameManager.switchToFrame(TAB_ID, 2)).toThrow('Invalid frame index');
  });
});

// ─── switchToMainFrame ──────────────────────────────────────────────

describe('switchToMainFrame', () => {
  it('sets frame index to 0', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    frameManager.switchToFrame(TAB_ID, 2);
    frameManager.switchToMainFrame(TAB_ID);
    expect(frameManager.getCurrentFrameIndex(TAB_ID)).toBe(0);
  });
});

// ─── getCurrentFrameIndex ───────────────────────────────────────────

describe('getCurrentFrameIndex', () => {
  it('returns 0 for unknown tab', () => {
    expect(frameManager.getCurrentFrameIndex(9999)).toBe(0);
  });

  it('returns current frame index', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    frameManager.switchToFrame(TAB_ID, 2);
    expect(frameManager.getCurrentFrameIndex(TAB_ID)).toBe(2);
  });
});

// ─── getCurrentFrame ────────────────────────────────────────────────

describe('getCurrentFrame', () => {
  it('returns null for unknown tab', () => {
    expect(frameManager.getCurrentFrame(9999)).toBeNull();
  });

  it('returns correct FrameInfo', () => {
    const frames = makeFrames(3);
    frameManager.setFrames(TAB_ID, frames);
    frameManager.switchToFrame(TAB_ID, 1);
    expect(frameManager.getCurrentFrame(TAB_ID)).toEqual(frames[1]);
  });
});

// ─── getFrames ──────────────────────────────────────────────────────

describe('getFrames', () => {
  it('returns empty array for unknown tab', () => {
    expect(frameManager.getFrames(9999)).toEqual([]);
  });
});

// ─── clearTab ───────────────────────────────────────────────────────

describe('clearTab', () => {
  it('removes all state for tab', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    frameManager.clearTab(TAB_ID);
    expect(frameManager.getFrames(TAB_ID)).toEqual([]);
    expect(frameManager.getCurrentFrame(TAB_ID)).toBeNull();
  });
});

// ─── isInFrame ──────────────────────────────────────────────────────

describe('isInFrame', () => {
  it('returns false when at index 0', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    expect(frameManager.isInFrame(TAB_ID)).toBe(false);
  });

  it('returns true when at index > 0', () => {
    frameManager.setFrames(TAB_ID, makeFrames(3));
    frameManager.switchToFrame(TAB_ID, 1);
    expect(frameManager.isInFrame(TAB_ID)).toBe(true);
  });
});
