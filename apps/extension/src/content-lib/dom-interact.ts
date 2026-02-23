/**
 * DOM interaction: click, dblclick, hover, fill, type, press, clear, focus.
 * Uses complete event sequences to match real user behavior.
 */

import type { Command } from '@browser-cli/shared';
import { resolveElement } from './element-ref-store';

export async function handleInteraction(command: Command): Promise<unknown> {
  switch (command.action) {
    case 'click': {
      const { selector, button, position } = command.params;
      const el = requireElement(selector, position);
      performClick(el, button || 'left');
      return { clicked: true };
    }
    case 'dblclick': {
      const { selector, position } = command.params;
      const el = requireElement(selector, position);
      performDblClick(el);
      return { clicked: true };
    }
    case 'hover': {
      const { selector, position } = command.params;
      const el = requireElement(selector, position);
      performHover(el);
      return { hovered: true };
    }
    case 'fill': {
      const { selector, value, position } = command.params;
      const el = requireElement(selector, position);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        throw new Error(`Element is not fillable (not an <input> or <textarea>): ${selector}`);
      }
      performFill(el, value);
      return { filled: true };
    }
    case 'type': {
      const { selector, text, delay, position } = command.params;
      const el = requireElement(selector, position);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        throw new Error(`Element is not typeable (not an <input> or <textarea>): ${selector}`);
      }
      await performType(el, text, delay);
      return { typed: true };
    }
    case 'press': {
      const { selector, key, position } = command.params;
      const el = selector
        ? requireElement(selector, position)
        : (document.activeElement ?? document.body);
      performPress(el, key);
      return { pressed: true };
    }
    case 'clear': {
      const { selector, position } = command.params;
      const el = requireElement(selector, position);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        throw new Error(`Element is not clearable (not an <input> or <textarea>): ${selector}`);
      }
      performClear(el);
      return { cleared: true };
    }
    case 'focus': {
      const { selector, position } = command.params;
      const el = requireElement(selector, position) as HTMLElement;
      el.focus();
      return { focused: true };
    }
    case 'drag': {
      const { source, target } = command.params;
      const srcEl = requireElement(source);
      const tgtEl = requireElement(target);
      performDrag(srcEl, tgtEl);
      return { dragged: true };
    }
    case 'keydown': {
      const { selector, key, position } = command.params;
      const el = selector
        ? requireElement(selector, position)
        : (document.activeElement ?? document.body);
      el.dispatchEvent(new KeyboardEvent('keydown', keyEventInit(key)));
      return { pressed: true };
    }
    case 'keyup': {
      const { selector, key, position } = command.params;
      const el = selector
        ? requireElement(selector, position)
        : (document.activeElement ?? document.body);
      el.dispatchEvent(new KeyboardEvent('keyup', keyEventInit(key)));
      return { released: true };
    }
    default:
      throw new Error(`Unknown interaction: ${(command as { action: string }).action}`);
  }
}

function requireElement(
  selector: string,
  position?: { type: 'first' | 'last' | 'nth'; index?: number },
): Element {
  const el = resolveElement(selector, position);
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
function performClick(el: Element, button: string): void {
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
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y, button: btn }));
}

function performDblClick(el: Element): void {
  const { x, y } = getCenter(el);

  // Two clicks + dblclick
  performClick(el, 'left');
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: x, clientY: y }));
}

function performHover(el: Element): void {
  const { x, y } = getCenter(el);

  el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y }));
  el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
}

/**
 * Fill using native value setter — works with React/Vue controlled components.
 * This bypasses the framework's event system to set the value directly.
 */
function performFill(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  el.focus();

  // Use the native value setter to bypass React/Vue interceptors
  const prototype =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor && descriptor.set) {
    // Call the setter with the element as the context
    descriptor.set.call(el, value);
  } else {
    // Fallback to direct assignment if descriptor not found
    el.value = value;
  }

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

  const prototype =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  for (const char of text) {
    const init = keyEventInit(char);
    el.dispatchEvent(new KeyboardEvent('keydown', init));
    el.dispatchEvent(new KeyboardEvent('keypress', init));

    // Append character using native setter
    const newValue = el.value + char;
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, newValue);
    } else {
      el.value = newValue;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', init));

    if (delay && delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/** Map key name to keyCode for backward-compat with sites using deprecated keyCode/which */
function getKeyCode(key: string): number {
  const map: Record<string, number> = {
    Backspace: 8,
    Tab: 9,
    Enter: 13,
    Shift: 16,
    Control: 17,
    Alt: 18,
    Escape: 27,
    ' ': 32,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    Delete: 46,
    Meta: 91,
  };
  if (map[key]) return map[key];
  // Single character: use its char code
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  // F1-F12
  const fMatch = key.match(/^F(\d+)$/);
  if (fMatch) return 111 + parseInt(fMatch[1]);
  return 0;
}

/** Map key name to code (physical key identifier) */
function getKeyCodeStr(key: string): string {
  const map: Record<string, string> = {
    Backspace: 'Backspace',
    Tab: 'Tab',
    Enter: 'Enter',
    Shift: 'ShiftLeft',
    Control: 'ControlLeft',
    Alt: 'AltLeft',
    Escape: 'Escape',
    ' ': 'Space',
    ArrowLeft: 'ArrowLeft',
    ArrowUp: 'ArrowUp',
    ArrowRight: 'ArrowRight',
    ArrowDown: 'ArrowDown',
    Delete: 'Delete',
    Meta: 'MetaLeft',
  };
  if (map[key]) return map[key];
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') return `Key${upper}`;
    if (upper >= '0' && upper <= '9') return `Digit${upper}`;
  }
  return key;
}

/**
 * Parse modifier key combination (e.g., "Control+a", "Shift+Tab", "Control+Shift+k").
 * Returns the base key and modifier flags.
 */
function parseKeyCombo(combo: string): {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
} {
  const parts = combo.split('+');
  let ctrlKey = false;
  let shiftKey = false;
  let altKey = false;
  let metaKey = false;

  // Last part is the actual key, preceding parts are modifiers
  const key = parts.pop() ?? '';
  for (const mod of parts) {
    switch (mod) {
      case 'Control':
        ctrlKey = true;
        break;
      case 'Shift':
        shiftKey = true;
        break;
      case 'Alt':
        altKey = true;
        break;
      case 'Meta':
        metaKey = true;
        break;
    }
  }

  return { key, ctrlKey, shiftKey, altKey, metaKey };
}

/** Build KeyboardEvent init with key, code, keyCode, which for max compatibility */
function keyEventInit(key: string): KeyboardEventInit {
  const { key: baseKey, ctrlKey, shiftKey, altKey, metaKey } = parseKeyCombo(key);
  const keyCode = getKeyCode(baseKey);
  return {
    key: baseKey,
    code: getKeyCodeStr(baseKey),
    keyCode,
    which: keyCode,
    ctrlKey,
    shiftKey,
    altKey,
    metaKey,
    bubbles: true,
  };
}

/** Press a single key (e.g., "Enter", "Escape", "Tab") */
function performPress(el: Element, key: string): void {
  const init = keyEventInit(key);
  el.dispatchEvent(new KeyboardEvent('keydown', init));
  el.dispatchEvent(new KeyboardEvent('keypress', init));
  el.dispatchEvent(new KeyboardEvent('keyup', init));
}

function performClear(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.focus();
  performFill(el, '');
}

/** Full drag and drop event sequence: dragstart → drag → dragenter → dragover → drop → dragend */
function performDrag(source: Element, target: Element): void {
  const srcCenter = getCenter(source);
  const tgtCenter = getCenter(target);
  const dataTransfer = new DataTransfer();

  source.dispatchEvent(
    new DragEvent('dragstart', {
      bubbles: true,
      clientX: srcCenter.x,
      clientY: srcCenter.y,
      dataTransfer,
    }),
  );
  source.dispatchEvent(
    new DragEvent('drag', {
      bubbles: true,
      clientX: srcCenter.x,
      clientY: srcCenter.y,
      dataTransfer,
    }),
  );
  target.dispatchEvent(
    new DragEvent('dragenter', {
      bubbles: true,
      clientX: tgtCenter.x,
      clientY: tgtCenter.y,
      dataTransfer,
    }),
  );
  target.dispatchEvent(
    new DragEvent('dragover', {
      bubbles: true,
      clientX: tgtCenter.x,
      clientY: tgtCenter.y,
      dataTransfer,
    }),
  );
  target.dispatchEvent(
    new DragEvent('drop', {
      bubbles: true,
      clientX: tgtCenter.x,
      clientY: tgtCenter.y,
      dataTransfer,
    }),
  );
  source.dispatchEvent(
    new DragEvent('dragend', {
      bubbles: true,
      clientX: tgtCenter.x,
      clientY: tgtCenter.y,
      dataTransfer,
    }),
  );
}
