/**
 * Tests for low-level mouse control handlers: move, down, up, wheel.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleMouse } from '../src/content-lib/mouse';
import type { Command } from '@browser-cli/shared';

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─── mouseMove ───────────────────────────────────────────────────────

describe('mouseMove', () => {
  it('dispatches pointermove and mousemove events', async () => {
    document.body.innerHTML = '<div id="target" style="position:absolute;left:0;top:0;width:200px;height:200px;">Target</div>';

    const events: string[] = [];
    // Events bubble to document.body
    document.body.addEventListener('pointermove', () => events.push('pointermove'));
    document.body.addEventListener('mousemove', () => events.push('mousemove'));

    const result = await handleMouse({
      action: 'mouseMove',
      params: { x: 100, y: 100 },
    } as Command);

    expect(result).toEqual({ moved: true });
    expect(events).toContain('pointermove');
    expect(events).toContain('mousemove');
  });

  it('returns moved: true', async () => {
    const result = await handleMouse({
      action: 'mouseMove',
      params: { x: 50, y: 50 },
    } as Command);

    expect(result).toEqual({ moved: true });
  });
});

// ─── mouseDown ───────────────────────────────────────────────────────

describe('mouseDown', () => {
  it('dispatches pointerdown and mousedown events', async () => {
    const events: string[] = [];
    document.body.addEventListener('pointerdown', () => events.push('pointerdown'));
    document.body.addEventListener('mousedown', () => events.push('mousedown'));

    const result = await handleMouse({
      action: 'mouseDown',
      params: {},
    } as Command);

    expect(result).toEqual({ pressed: true });
    expect(events).toContain('pointerdown');
    expect(events).toContain('mousedown');
  });

  it('uses left button by default (button=0)', async () => {
    let receivedButton: number | null = null;
    document.body.addEventListener('mousedown', (e: Event) => {
      receivedButton = (e as MouseEvent).button;
    });

    await handleMouse({
      action: 'mouseDown',
      params: {},
    } as Command);

    expect(receivedButton).toBe(0);
  });

  it('maps right button to 2', async () => {
    let receivedButton: number | null = null;
    document.body.addEventListener('mousedown', (e: Event) => {
      receivedButton = (e as MouseEvent).button;
    });

    await handleMouse({
      action: 'mouseDown',
      params: { button: 'right' },
    } as Command);

    expect(receivedButton).toBe(2);
  });

  it('maps middle button to 1', async () => {
    let receivedButton: number | null = null;
    document.body.addEventListener('mousedown', (e: Event) => {
      receivedButton = (e as MouseEvent).button;
    });

    await handleMouse({
      action: 'mouseDown',
      params: { button: 'middle' },
    } as Command);

    expect(receivedButton).toBe(1);
  });
});

// ─── mouseUp ─────────────────────────────────────────────────────────

describe('mouseUp', () => {
  it('dispatches pointerup and mouseup events', async () => {
    const events: string[] = [];
    document.body.addEventListener('pointerup', () => events.push('pointerup'));
    document.body.addEventListener('mouseup', () => events.push('mouseup'));

    const result = await handleMouse({
      action: 'mouseUp',
      params: {},
    } as Command);

    expect(result).toEqual({ released: true });
    expect(events).toContain('pointerup');
    expect(events).toContain('mouseup');
  });

  it('uses the correct button', async () => {
    let receivedButton: number | null = null;
    document.body.addEventListener('mouseup', (e: Event) => {
      receivedButton = (e as MouseEvent).button;
    });

    await handleMouse({
      action: 'mouseUp',
      params: { button: 'right' },
    } as Command);

    expect(receivedButton).toBe(2);
  });
});

// ─── mouseWheel ──────────────────────────────────────────────────────

describe('mouseWheel', () => {
  it('dispatches wheel event with deltaY', async () => {
    let receivedDeltaY: number | null = null;
    document.body.addEventListener('wheel', (e: Event) => {
      receivedDeltaY = (e as WheelEvent).deltaY;
    });

    const result = await handleMouse({
      action: 'mouseWheel',
      params: { deltaY: 100 },
    } as Command);

    expect(result).toEqual({ scrolled: true });
    expect(receivedDeltaY).toBe(100);
  });

  it('dispatches wheel event with both deltaY and deltaX', async () => {
    let receivedDeltaY: number | null = null;
    let receivedDeltaX: number | null = null;
    document.body.addEventListener('wheel', (e: Event) => {
      receivedDeltaY = (e as WheelEvent).deltaY;
      receivedDeltaX = (e as WheelEvent).deltaX;
    });

    await handleMouse({
      action: 'mouseWheel',
      params: { deltaY: 100, deltaX: 50 },
    } as Command);

    expect(receivedDeltaY).toBe(100);
    expect(receivedDeltaX).toBe(50);
  });

  it('defaults deltaX to 0 when not provided', async () => {
    let receivedDeltaX: number | null = null;
    document.body.addEventListener('wheel', (e: Event) => {
      receivedDeltaX = (e as WheelEvent).deltaX;
    });

    await handleMouse({
      action: 'mouseWheel',
      params: { deltaY: 100 },
    } as Command);

    expect(receivedDeltaX).toBe(0);
  });

  it('supports negative deltaY for scrolling up', async () => {
    let receivedDeltaY: number | null = null;
    document.body.addEventListener('wheel', (e: Event) => {
      receivedDeltaY = (e as WheelEvent).deltaY;
    });

    await handleMouse({
      action: 'mouseWheel',
      params: { deltaY: -200 },
    } as Command);

    expect(receivedDeltaY).toBe(-200);
  });
});

// ─── State tracking ──────────────────────────────────────────────────

describe('mouse state tracking', () => {
  it('mouseDown uses position from prior mouseMove', async () => {
    // Move mouse to a position, then mouseDown should use those coordinates
    await handleMouse({
      action: 'mouseMove',
      params: { x: 150, y: 250 },
    } as Command);

    let receivedX: number | null = null;
    let receivedY: number | null = null;
    document.body.addEventListener('mousedown', (e: Event) => {
      receivedX = (e as MouseEvent).clientX;
      receivedY = (e as MouseEvent).clientY;
    });

    await handleMouse({
      action: 'mouseDown',
      params: {},
    } as Command);

    expect(receivedX).toBe(150);
    expect(receivedY).toBe(250);
  });
});

// ─── Error handling ──────────────────────────────────────────────────

describe('error handling', () => {
  it('throws on unknown mouse command', async () => {
    await expect(
      handleMouse({
        action: 'mouseInvalid' as 'mouseMove',
        params: { x: 0, y: 0 },
      } as Command),
    ).rejects.toThrow('Unknown mouse command');
  });
});
