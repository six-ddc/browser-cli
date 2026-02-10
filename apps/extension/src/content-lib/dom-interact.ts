/**
 * DOM interaction: click, dblclick, hover, fill, type, press, clear, focus.
 * Uses complete event sequences to match real user behavior.
 */

import type { Command } from '@browser-cli/shared';
import { resolveElement } from './element-ref-store';

export async function handleInteraction(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'click': {
      const { selector, button } = command.params as { selector: string; button?: string };
      const el = requireElement(selector);
      await performClick(el, button || 'left');
      return { clicked: true };
    }
    case 'dblclick': {
      const el = requireElement((command.params as { selector: string }).selector);
      await performDblClick(el);
      return { clicked: true };
    }
    case 'hover': {
      const el = requireElement((command.params as { selector: string }).selector);
      await performHover(el);
      return { hovered: true };
    }
    case 'fill': {
      const { selector, value } = command.params as { selector: string; value: string };
      const el = requireElement(selector) as HTMLInputElement | HTMLTextAreaElement;
      await performFill(el, value);
      return { filled: true };
    }
    case 'type': {
      const { selector, text, delay } = command.params as {
        selector: string;
        text: string;
        delay?: number;
      };
      const el = requireElement(selector) as HTMLInputElement | HTMLTextAreaElement;
      await performType(el, text, delay);
      return { typed: true };
    }
    case 'press': {
      const { selector, key } = command.params as { selector?: string; key: string };
      const el = selector ? requireElement(selector) : (document.activeElement as Element || document.body);
      await performPress(el, key);
      return { pressed: true };
    }
    case 'clear': {
      const el = requireElement(
        (command.params as { selector: string }).selector,
      ) as HTMLInputElement | HTMLTextAreaElement;
      await performClear(el);
      return { cleared: true };
    }
    case 'focus': {
      const el = requireElement(
        (command.params as { selector: string }).selector,
      ) as HTMLElement;
      el.focus();
      return { focused: true };
    }
    case 'drag': {
      const { source, target } = command.params as { source: string; target: string };
      const srcEl = requireElement(source);
      const tgtEl = requireElement(target);
      await performDrag(srcEl, tgtEl);
      return { dragged: true };
    }
    case 'keydown': {
      const { selector, key } = command.params as { selector?: string; key: string };
      const el = selector ? requireElement(selector) : (document.activeElement as Element || document.body);
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      return { pressed: true };
    }
    case 'keyup': {
      const { selector, key } = command.params as { selector?: string; key: string };
      const el = selector ? requireElement(selector) : (document.activeElement as Element || document.body);
      el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      return { released: true };
    }
    default:
      throw new Error(`Unknown interaction: ${(command as { action: string }).action}`);
  }
}

function requireElement(selector: string): Element {
  const el = resolveElement(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

function getCenter(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function buttonToIndex(button: string): number {
  switch (button) {
    case 'right':
      return 2;
    case 'middle':
      return 1;
    default:
      return 0;
  }
}

/** Complete click event sequence: pointerdown → mousedown → pointerup → mouseup → click */
async function performClick(el: Element, button: string): Promise<void> {
  const { x, y } = getCenter(el);
  const btn = buttonToIndex(button);

  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, button: btn }),
  );
  el.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y, button: btn }),
  );
  el.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, button: btn }),
  );
  el.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y, button: btn }),
  );
  el.dispatchEvent(
    new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, button: btn }),
  );
}

async function performDblClick(el: Element): Promise<void> {
  const { x, y } = getCenter(el);

  // Two clicks + dblclick
  await performClick(el, 'left');
  el.dispatchEvent(
    new MouseEvent('dblclick', { bubbles: true, clientX: x, clientY: y }),
  );
}

async function performHover(el: Element): Promise<void> {
  const { x, y } = getCenter(el);

  el.dispatchEvent(
    new PointerEvent('pointerover', { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new PointerEvent('pointerenter', { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }),
  );
  el.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }),
  );
}

/**
 * Fill using native value setter — works with React/Vue controlled components.
 * This bypasses the framework's event system to set the value directly.
 */
async function performFill(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): Promise<void> {
  el.focus();

  // Use the native value setter to bypass React/Vue interceptors
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  const setter = el instanceof HTMLTextAreaElement ? nativeTextareaValueSetter : nativeInputValueSetter;
  setter?.call(el, value);

  // Dispatch events to notify frameworks
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Type text character by character with keydown/keypress/input/keyup per character */
async function performType(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
  delay?: number,
): Promise<void> {
  el.focus();

  for (const char of text) {
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: char, bubbles: true }),
    );
    el.dispatchEvent(
      new KeyboardEvent('keypress', { key: char, bubbles: true }),
    );

    // Append character using native setter
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeSetter?.call(el, el.value + char);

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(
      new KeyboardEvent('keyup', { key: char, bubbles: true }),
    );

    if (delay && delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/** Press a single key (e.g., "Enter", "Escape", "Tab") */
async function performPress(el: Element, key: string): Promise<void> {
  el.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true }),
  );
  el.dispatchEvent(
    new KeyboardEvent('keypress', { key, bubbles: true }),
  );
  el.dispatchEvent(
    new KeyboardEvent('keyup', { key, bubbles: true }),
  );
}

async function performClear(el: HTMLInputElement | HTMLTextAreaElement): Promise<void> {
  el.focus();
  await performFill(el, '');
}

/** Full drag and drop event sequence: dragstart → drag → dragenter → dragover → drop → dragend */
async function performDrag(source: Element, target: Element): Promise<void> {
  const srcCenter = getCenter(source);
  const tgtCenter = getCenter(target);
  const dataTransfer = new DataTransfer();

  source.dispatchEvent(
    new DragEvent('dragstart', { bubbles: true, clientX: srcCenter.x, clientY: srcCenter.y, dataTransfer }),
  );
  source.dispatchEvent(
    new DragEvent('drag', { bubbles: true, clientX: srcCenter.x, clientY: srcCenter.y, dataTransfer }),
  );
  target.dispatchEvent(
    new DragEvent('dragenter', { bubbles: true, clientX: tgtCenter.x, clientY: tgtCenter.y, dataTransfer }),
  );
  target.dispatchEvent(
    new DragEvent('dragover', { bubbles: true, clientX: tgtCenter.x, clientY: tgtCenter.y, dataTransfer }),
  );
  target.dispatchEvent(
    new DragEvent('drop', { bubbles: true, clientX: tgtCenter.x, clientY: tgtCenter.y, dataTransfer }),
  );
  source.dispatchEvent(
    new DragEvent('dragend', { bubbles: true, clientX: tgtCenter.x, clientY: tgtCenter.y, dataTransfer }),
  );
}
