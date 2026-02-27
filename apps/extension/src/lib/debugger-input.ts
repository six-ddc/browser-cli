/**
 * Chrome DevTools Protocol (CDP) based input dispatch for trusted (isTrusted=true) events.
 * Uses chrome.debugger API to attach to a tab and send Input.dispatch* commands.
 *
 * Flow:
 *   1. Query content script for element bounding box (viewport-relative)
 *   2. Attach debugger to tab
 *   3. Send CDP Input commands (mousePressed/Released, keyDown/Up, insertText)
 *   4. Detach debugger
 */

import type { Command } from '@browser-cli/shared';
import { sendToContentScript } from './send-to-content-script';

// ─── Typed access to chrome.debugger (reserved keyword) ─────────────

/**
 * Access the chrome.debugger API via bracket notation since `debugger` is
 * a JS reserved keyword. Returns undefined on Firefox / when unavailable.
 */
function getChromeDebugger(): ChromeDebuggerAPI | undefined {
  if (typeof chrome === 'undefined') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (chrome as any)['debugger'] as ChromeDebuggerAPI | undefined;
}

function getChromeLastError(): { message?: string } | undefined {
  if (typeof chrome === 'undefined') return undefined;
  return chrome.runtime.lastError;
}

// ─── CDP helpers ────────────────────────────────────────────────────

/** Promise wrapper around chrome.debugger.sendCommand */
function cdpSend(
  target: ChromeDebuggerDebuggee,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const dbg = getChromeDebugger();
    if (!dbg) {
      reject(new Error('chrome.debugger API not available'));
      return;
    }
    dbg.sendCommand(target, method, params, (result: unknown) => {
      const lastError = getChromeLastError();
      if (lastError) {
        reject(new Error(lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

/** Attach debugger, run fn, detach — always detaches even on error */
async function withDebugger<T>(
  tabId: number,
  fn: (target: ChromeDebuggerDebuggee) => Promise<T>,
): Promise<T> {
  const dbg = getChromeDebugger();
  if (!dbg) throw new Error('chrome.debugger API not available');

  const target: ChromeDebuggerDebuggee = { tabId };
  await new Promise<void>((resolve, reject) => {
    dbg.attach(target, '1.3', () => {
      const lastError = getChromeLastError();
      if (lastError) {
        reject(new Error(lastError.message));
      } else {
        resolve();
      }
    });
  });
  try {
    return await fn(target);
  } finally {
    await new Promise<void>((resolve) => {
      dbg.detach(target, () => {
        // Ignore detach errors (tab may have closed)
        getChromeLastError();
        resolve();
      });
    });
  }
}

// ─── Key mapping (replicates dom-interact.ts logic for CDP) ─────────

/** Parse "Control+Shift+a" into base key + modifier flags */
function parseKeyCombo(combo: string): {
  key: string;
  modifiers: number;
} {
  const parts = combo.split('+');
  const key = parts.pop() ?? '';
  let modifiers = 0;

  for (const mod of parts) {
    switch (mod) {
      case 'Alt':
        modifiers |= 1;
        break;
      case 'Control':
        modifiers |= 2;
        break;
      case 'Meta':
        modifiers |= 4;
        break;
      case 'Shift':
        modifiers |= 8;
        break;
    }
  }

  return { key, modifiers };
}

/** Map key name to CDP "code" (physical key identifier) */
function getCdpCode(key: string): string {
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

/** Map key name to Windows virtual key code */
function getWindowsVirtualKeyCode(key: string): number {
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
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  const fMatch = key.match(/^F(\d+)$/);
  if (fMatch) return 111 + parseInt(fMatch[1]);
  return 0;
}

// ─── CDP input actions ──────────────────────────────────────────────

/** CDP hover: mouseMoved at (x, y) to trigger CSS :hover */
async function debuggerHover(target: ChromeDebuggerDebuggee, x: number, y: number): Promise<void> {
  await cdpSend(target, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
  });
}

/** CDP dblclick: two mousePressed/mouseReleased sequences, second with clickCount:2 */
async function debuggerDblClick(
  target: ChromeDebuggerDebuggee,
  x: number,
  y: number,
): Promise<void> {
  // First click
  await cdpSend(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await cdpSend(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  // Second click with clickCount: 2
  await cdpSend(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 2,
  });
  await cdpSend(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 2,
  });
}

/** CDP click: mousePressed + mouseReleased at (x, y) */
async function debuggerClick(
  target: ChromeDebuggerDebuggee,
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left',
): Promise<void> {
  const cdpButton = button === 'middle' ? 'middle' : button === 'right' ? 'right' : 'left';
  const clickCount = 1;
  await cdpSend(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: cdpButton,
    clickCount,
  });
  await cdpSend(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: cdpButton,
    clickCount,
  });
}

/** CDP type: per-character keyDown + keyUp with text property */
async function debuggerType(
  target: ChromeDebuggerDebuggee,
  text: string,
  delay = 0,
): Promise<void> {
  for (const char of text) {
    const code = getCdpCode(char);
    const keyCode = getWindowsVirtualKeyCode(char);
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: char,
      code,
      windowsVirtualKeyCode: keyCode,
      text: char,
    });
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: char,
      code,
      windowsVirtualKeyCode: keyCode,
    });
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/** CDP fill: click to focus → Ctrl+A (select all) → Input.insertText */
async function debuggerFill(
  target: ChromeDebuggerDebuggee,
  x: number,
  y: number,
  text: string,
): Promise<void> {
  // Click to focus the element
  await debuggerClick(target, x, y);

  // Select all existing content with Ctrl+A
  await cdpSend(target, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'a',
    code: 'KeyA',
    windowsVirtualKeyCode: 65,
    modifiers: 2, // Ctrl
  });
  await cdpSend(target, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'a',
    code: 'KeyA',
    windowsVirtualKeyCode: 65,
    modifiers: 2,
  });

  // Insert the new text (replaces selection)
  await cdpSend(target, 'Input.insertText', { text });
}

/** CDP press: keyDown + keyUp with modifier bitmask */
async function debuggerPress(target: ChromeDebuggerDebuggee, keyCombo: string): Promise<void> {
  const { key, modifiers } = parseKeyCombo(keyCombo);
  const code = getCdpCode(key);
  const keyCode = getWindowsVirtualKeyCode(key);

  // Press modifier keys first
  if (modifiers & 2) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Control',
      code: 'ControlLeft',
      windowsVirtualKeyCode: 17,
      modifiers,
    });
  }
  if (modifiers & 8) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Shift',
      code: 'ShiftLeft',
      windowsVirtualKeyCode: 16,
      modifiers,
    });
  }
  if (modifiers & 1) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Alt',
      code: 'AltLeft',
      windowsVirtualKeyCode: 18,
      modifiers,
    });
  }
  if (modifiers & 4) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Meta',
      code: 'MetaLeft',
      windowsVirtualKeyCode: 91,
      modifiers,
    });
  }

  // Press the actual key
  const keyParams: Record<string, unknown> = {
    type: 'keyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  };
  // For printable single chars, include text property
  if (key.length === 1) {
    keyParams.text = key;
  }
  await cdpSend(target, 'Input.dispatchKeyEvent', keyParams);
  await cdpSend(target, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  });

  // Release modifier keys in reverse order
  if (modifiers & 4) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Meta',
      code: 'MetaLeft',
      windowsVirtualKeyCode: 91,
    });
  }
  if (modifiers & 1) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Alt',
      code: 'AltLeft',
      windowsVirtualKeyCode: 18,
    });
  }
  if (modifiers & 8) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Shift',
      code: 'ShiftLeft',
      windowsVirtualKeyCode: 16,
    });
  }
  if (modifiers & 2) {
    await cdpSend(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Control',
      code: 'ControlLeft',
      windowsVirtualKeyCode: 17,
    });
  }
}

// ─── Element coordinate helper ──────────────────────────────────────

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Query the content script for an element's bounding box, scrolling it into view first */
async function getElementCenter(
  tabId: number,
  selector: string,
): Promise<{ x: number; y: number }> {
  // Scroll into view first
  const scrollResp = await sendToContentScript(tabId, {
    type: 'browser-cli-command',
    id: `dbg-scroll-${Date.now()}`,
    command: { action: 'scrollIntoView', params: { selector } },
  });
  if (!scrollResp.success) {
    throw new Error(scrollResp.error?.message || `Element not found: ${selector}`);
  }

  // Get bounding box
  const bboxResp = await sendToContentScript(tabId, {
    type: 'browser-cli-command',
    id: `dbg-bbox-${Date.now()}`,
    command: { action: 'boundingBox', params: { selector } },
  });
  if (!bboxResp.success || !bboxResp.data) {
    throw new Error(bboxResp.error?.message || `Cannot get bounding box: ${selector}`);
  }

  const box = bboxResp.data as BoundingBox;
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

// ─── Top-level dispatcher ───────────────────────────────────────────

type DebuggerAction = 'click' | 'dblclick' | 'hover' | 'fill' | 'type' | 'press';

/** Set of actions that support --debugger */
export const DEBUGGER_ACTIONS = new Set<string>([
  'click',
  'dblclick',
  'hover',
  'fill',
  'type',
  'press',
]);

/** Check if the chrome.debugger API is available (Chrome only) */
export function isDebuggerAvailable(): boolean {
  return getChromeDebugger() != null;
}

/**
 * Handle a command using the Chrome debugger API for trusted input events.
 * Returns a protocol response (same shape as content script responses).
 */
export async function handleDebuggerCommand(
  command: Command,
  tabId: number,
): Promise<{ success: boolean; data?: unknown; error?: unknown }> {
  const action = command.action as DebuggerAction;
  const params = command.params as Record<string, unknown>;

  try {
    switch (action) {
      case 'click': {
        const selector = params.selector as string;
        const button = (params.button as 'left' | 'right' | 'middle' | undefined) ?? 'left';
        const { x, y } = await getElementCenter(tabId, selector);
        await withDebugger(tabId, async (target) => {
          await debuggerClick(target, x, y, button);
        });
        return { success: true };
      }

      case 'dblclick': {
        const selector = params.selector as string;
        const { x, y } = await getElementCenter(tabId, selector);
        await withDebugger(tabId, async (target) => {
          await debuggerDblClick(target, x, y);
        });
        return { success: true };
      }

      case 'hover': {
        const selector = params.selector as string;
        const { x, y } = await getElementCenter(tabId, selector);
        await withDebugger(tabId, async (target) => {
          await debuggerHover(target, x, y);
        });
        return { success: true };
      }

      case 'fill': {
        const selector = params.selector as string;
        const value = params.value as string;
        const { x, y } = await getElementCenter(tabId, selector);
        await withDebugger(tabId, async (target) => {
          await debuggerFill(target, x, y, value);
        });
        return { success: true };
      }

      case 'type': {
        const selector = params.selector as string;
        const text = params.text as string;
        const delay = (params.delay as number) || 0;
        const { x, y } = await getElementCenter(tabId, selector);
        await withDebugger(tabId, async (target) => {
          // Click to focus first
          await debuggerClick(target, x, y);
          await debuggerType(target, text, delay);
        });
        return { success: true };
      }

      case 'press': {
        const key = params.key as string;
        const selector = params.selector as string | undefined;
        // If a selector is provided, focus it first
        if (selector) {
          const { x, y } = await getElementCenter(tabId, selector);
          await withDebugger(tabId, async (target) => {
            await debuggerClick(target, x, y);
            await debuggerPress(target, key);
          });
        } else {
          await withDebugger(tabId, async (target) => {
            await debuggerPress(target, key);
          });
        }
        return { success: true };
      }

      default:
        return {
          success: false,
          error: {
            message: `Action '${action as string}' does not support --debugger.`,
          },
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: {
        message: `Debugger input failed: ${message}. Check that DevTools is not open on the target tab and the tab is a regular http/https page.`,
      },
    };
  }
}
