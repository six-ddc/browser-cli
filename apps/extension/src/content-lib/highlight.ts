/**
 * DOM overlay highlighting for elements.
 */

import type { HighlightParams } from '@browser-cli/shared';
import { resolveElement } from './element-ref-store';

const DEFAULT_COLOR = '#2196F3';
const DEFAULT_DURATION = 2000;

export async function handleHighlight(params: HighlightParams): Promise<{ highlighted: true }> {
  const { selector, color, duration } = params;

  const el = resolveElement(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);

  const rect = el.getBoundingClientRect();
  const highlightColor = color || DEFAULT_COLOR;
  const highlightDuration = duration ?? DEFAULT_DURATION;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid ${highlightColor};
    background: ${highlightColor}22;
    pointer-events: none;
    z-index: 2147483647;
    transition: opacity 0.3s;
    box-sizing: border-box;
  `;
  document.body.appendChild(overlay);

  // Remove after duration
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }, highlightDuration);

  return { highlighted: true };
}
