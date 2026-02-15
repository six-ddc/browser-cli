/**
 * Frame bridge for cross-frame communication.
 * Handles message passing between main frame and iframes.
 */

import type { Command } from '@browser-cli/shared';
import { ErrorCode, createError } from '@browser-cli/shared';

export interface FrameInfo {
  index: number;
  name: string | null;
  src: string;
  isMainFrame: boolean;
  isSameOrigin: boolean;
}

/**
 * Discover all iframes in the current page.
 * Returns frame information for each iframe.
 */
export function discoverFrames(): FrameInfo[] {
  const frames: FrameInfo[] = [];

  // Main frame is always index 0
  frames.push({
    index: 0,
    name: null,
    src: window.location.href,
    isMainFrame: true,
    isSameOrigin: true,
  });

  // Find all iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe, idx) => {
    let isSameOrigin = false;
    let src = iframe.src || 'about:blank';

    try {
      // Try to access contentWindow.location to check same-origin
      const _ = iframe.contentWindow?.location.href;
      isSameOrigin = true;
      src = iframe.contentWindow?.location.href || src;
    } catch {
      // Cross-origin - can't access contentWindow.location
      isSameOrigin = false;
    }

    frames.push({
      index: idx + 1,
      name: iframe.name || null,
      src,
      isMainFrame: false,
      isSameOrigin,
    });
  });

  return frames;
}

/**
 * Find a frame by various criteria.
 */
export function findFrame(params: {
  selector?: string;
  name?: string;
  url?: string;
  index?: number;
}): { iframe: HTMLIFrameElement; frameIndex: number } {
  const iframes = Array.from(document.querySelectorAll('iframe'));

  // By index
  if (params.index !== undefined) {
    if (params.index === 0) {
      throw new Error('Cannot switch to main frame using index 0 - use main: true instead');
    }
    const iframe = iframes[params.index - 1];
    if (!iframe) {
      throw new Error(`Frame index ${params.index} not found (${iframes.length} frames available)`);
    }
    return { iframe, frameIndex: params.index };
  }

  // By selector
  if (params.selector) {
    const iframe = document.querySelector<HTMLIFrameElement>(params.selector);
    if (!iframe || iframe.tagName !== 'IFRAME') {
      throw new Error(`No iframe found with selector: ${params.selector}`);
    }
    const frameIndex = iframes.indexOf(iframe) + 1;
    return { iframe, frameIndex };
  }

  // By name
  if (params.name) {
    const iframe = iframes.find((f) => f.name === params.name);
    if (!iframe) {
      throw new Error(`No iframe found with name: ${params.name}`);
    }
    const frameIndex = iframes.indexOf(iframe) + 1;
    return { iframe, frameIndex };
  }

  // By URL (partial match)
  if (params.url) {
    const iframe = iframes.find((f) => {
      try {
        return f.contentWindow?.location.href.includes(params.url!);
      } catch {
        return f.src.includes(params.url!);
      }
    });
    if (!iframe) {
      throw new Error(`No iframe found with URL containing: ${params.url}`);
    }
    const frameIndex = iframes.indexOf(iframe) + 1;
    return { iframe, frameIndex };
  }

  throw new Error('No frame selector provided (selector, name, url, or index required)');
}

/**
 * Execute a command inside an iframe.
 * For same-origin iframes, we can directly execute in the iframe's context.
 * For cross-origin iframes, this will fail (limitation of extension architecture).
 */
export async function executeInFrame(
  iframe: HTMLIFrameElement,
  command: Command,
): Promise<unknown> {
  // Check if same-origin
  let isSameOrigin = false;
  try {
    const _ = iframe.contentWindow?.location.href;
    isSameOrigin = true;
  } catch {
    isSameOrigin = false;
  }

  if (!isSameOrigin) {
    throw createError(
      ErrorCode.FRAME_ERROR,
      'Cross-origin iframe access not supported. Only same-origin iframes can be automated.',
    );
  }

  if (!iframe.contentWindow) {
    throw createError(ErrorCode.FRAME_ERROR, 'Iframe contentWindow not accessible');
  }

  // For same-origin iframes, we need to inject our content script code
  // Since we're already in a content script, we can use postMessage
  // However, the simpler approach is to execute directly in the iframe's context

  // Create a promise that will be resolved by the frame
  const messageId = `frame-cmd-${Date.now()}-${Math.random()}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(createError(ErrorCode.TIMEOUT, 'Frame command timeout'));
    }, 30000);

    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'browser-cli-frame-response') return;
      if (event.data?.id !== messageId) return;
      if (event.source !== iframe.contentWindow) return;

      clearTimeout(timeout);
      window.removeEventListener('message', handler);

      if (event.data.success) {
        resolve(event.data.data);
      } else {
        reject(new Error(event.data.error?.message || 'Frame command failed'));
      }
    };

    window.addEventListener('message', handler);

    // Send command to iframe (same-origin already verified above)
    iframe.contentWindow!.postMessage(
      {
        type: 'browser-cli-frame-command',
        id: messageId,
        command,
      },
      iframe.contentWindow!.location.origin,
    );
  });
}

/**
 * Check if we're inside an iframe.
 */
export function isInsideFrame(): boolean {
  return window !== window.top;
}

/**
 * Initialize frame bridge in iframe context.
 * This allows iframes to receive and execute commands.
 */
export function initFrameBridge(): void {
  if (!isInsideFrame()) return;

  window.addEventListener('message', async (event: MessageEvent) => {
    if (event.data?.type !== 'browser-cli-frame-command') return;
    if (event.source !== window.parent) return;

    const { id, command } = event.data;

    try {
      // Dynamically import the appropriate handler
      let result: unknown;

      switch (command.action) {
        case 'click':
        case 'dblclick':
        case 'hover':
        case 'fill':
        case 'type':
        case 'press':
        case 'clear':
        case 'focus': {
          const { handleInteraction } = await import('./dom-interact');
          result = await handleInteraction(command);
          break;
        }

        case 'getText':
        case 'getHtml':
        case 'getValue':
        case 'getAttribute':
        case 'isVisible':
        case 'isEnabled':
        case 'isChecked':
        case 'count':
        case 'boundingBox': {
          const { handleQuery } = await import('./dom-query');
          result = await handleQuery(command);
          break;
        }

        case 'check':
        case 'uncheck':
        case 'select': {
          const { handleForm } = await import('./form');
          result = await handleForm(command);
          break;
        }

        case 'scroll':
        case 'scrollIntoView': {
          const { handleScroll } = await import('./scroll');
          result = await handleScroll(command);
          break;
        }

        case 'wait': {
          const { handleWait } = await import('./wait');
          result = await handleWait(command);
          break;
        }

        case 'evaluate': {
          const { handleEvaluate } = await import('./evaluate');
          result = await handleEvaluate(command.params);
          break;
        }

        case 'highlight': {
          const { handleHighlight } = await import('./highlight');
          result = await handleHighlight(command.params);
          break;
        }

        default:
          throw new Error(`Unsupported frame command: ${(command as { action: string }).action}`);
      }

      // Send success response back to parent (same-origin: we're inside an iframe)
      window.parent.postMessage(
        {
          type: 'browser-cli-frame-response',
          id,
          success: true,
          data: result,
        },
        window.parent.location.origin,
      );
    } catch (err) {
      // Send error response back to parent (same-origin: we're inside an iframe)
      window.parent.postMessage(
        {
          type: 'browser-cli-frame-response',
          id,
          success: false,
          error: {
            message: (err as Error).message || 'Unknown error',
          },
        },
        window.parent.location.origin,
      );
    }
  });
}
