/**
 * Send a message to a content script with retry on "Receiving end does not exist".
 * Shared by background.ts (general command forwarding) and debugger-input.ts
 * (querying element coordinates before CDP dispatch).
 */

/** Response shape from content script message handlers */
export interface ContentScriptResponse {
  success: boolean;
  data?: unknown;
  error?: { message?: string };
}

/**
 * Send a typed message to a content script on a specific tab.
 * Retries on transient "Receiving end does not exist" errors that occur
 * when the content script hasn't finished loading yet.
 */
export async function sendToContentScript(
  tabId: number,
  message: { type: string; id: string; command: unknown },
  maxRetries = 3,
  delayMs = 500,
): Promise<ContentScriptResponse> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Always target the main frame (frameId: 0) to avoid iframe content scripts
      // responding first. The main frame's content script handles iframe routing
      // via frame-bridge when a frame switch is active.
      return await browser.tabs.sendMessage(tabId, message, { frameId: 0 });
    } catch (err) {
      const msg = (err as Error).message || '';
      const isReceivingEndError =
        msg.includes('Receiving end does not exist') ||
        msg.includes('Could not establish connection');
      if (!isReceivingEndError || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable, but TypeScript needs it
  throw new Error('Content script not reachable');
}
