/**
 * Low-level mouse control: move, down, up, wheel.
 * Tracks current mouse position for stateful operations.
 */

import type { Command } from '@browser-cli/shared';

let currentX = 0;
let currentY = 0;

function buttonToIndex(button?: string): number {
  switch (button) {
    case 'right':
      return 2;
    case 'middle':
      return 1;
    default:
      return 0;
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- async for caller contract
export async function handleMouse(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'mouseMove': {
      const { x, y } = command.params;
      const target = document.elementFromPoint(x, y) || document.body;

      // Dispatch leave events on old target, enter events on new target
      target.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }),
      );
      target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));

      currentX = x;
      currentY = y;
      return { moved: true };
    }

    case 'mouseDown': {
      const { button } = command.params;
      const btn = buttonToIndex(button);
      const target = document.elementFromPoint(currentX, currentY) || document.body;

      target.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          clientX: currentX,
          clientY: currentY,
          button: btn,
        }),
      );
      target.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: currentX,
          clientY: currentY,
          button: btn,
        }),
      );
      return { pressed: true };
    }

    case 'mouseUp': {
      const { button } = command.params;
      const btn = buttonToIndex(button);
      const target = document.elementFromPoint(currentX, currentY) || document.body;

      target.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          clientX: currentX,
          clientY: currentY,
          button: btn,
        }),
      );
      target.dispatchEvent(
        new MouseEvent('mouseup', {
          bubbles: true,
          clientX: currentX,
          clientY: currentY,
          button: btn,
        }),
      );
      return { released: true };
    }

    case 'mouseWheel': {
      const { deltaY, deltaX } = command.params;
      const target = document.elementFromPoint(currentX, currentY) || document.body;

      target.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          clientX: currentX,
          clientY: currentY,
          deltaY,
          deltaX: deltaX || 0,
        }),
      );
      return { scrolled: true };
    }

    default:
      throw new Error(`Unknown mouse command: ${(command as { action: string }).action}`);
  }
}
