/**
 * Evaluate arbitrary JavaScript in the MAIN world context.
 * Uses chrome.scripting.executeScript from the background, but when called
 * from content script we use a MAIN world script injection approach.
 */

import type { EvaluateParams } from '@browser-cli/shared';

export async function handleEvaluate(params: EvaluateParams): Promise<{ value: unknown }> {
  const { expression } = params;

  // Use indirect eval via Function constructor in MAIN world
  // We need to inject a script into MAIN world and get the result back
  return new Promise((resolve, reject) => {
    const messageId = `browser-cli-eval-${Date.now()}-${Math.random()}`;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === messageId) {
        window.removeEventListener('message', handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve({ value: event.data.result });
        }
      }
    };
    window.addEventListener('message', handler);

    // Inject script into MAIN world
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        try {
          const __result = eval(${JSON.stringify(expression)});
          window.postMessage({ type: ${JSON.stringify(messageId)}, result: __result }, window.location.origin);
        } catch(e) {
          window.postMessage({ type: ${JSON.stringify(messageId)}, error: e.message }, window.location.origin);
        }
      })();
    `;
    document.documentElement.appendChild(script);
    script.remove();

    // Timeout
    setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Evaluate timed out after 10s'));
    }, 10_000);
  });
}
