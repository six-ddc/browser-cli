import { WsClient } from '../lib/ws-client';
import { getPort, getEnabled, setState } from '../lib/state';
import type { RequestMessage, ResponseMessage, ProtocolError } from '@browser-cli/shared';
import { ErrorCode } from '@browser-cli/shared';
import { classifyError } from '../lib/error-classifier';
import { NetworkManager } from '../lib/network-manager';
import { frameManager } from '../lib/frame-manager';

let wsClient: WsClient | null = null;
let networkManager: NetworkManager | null = null;
let initializing = false;

/** Overlay duration in ms — must match content-lib/command-overlay.ts */
const OVERLAY_DURATION_MS = 3000;

/** Tracks the last command execution time per tab for overlay display */
const tabCommandTimestamps = new Map<number, number>();

/** Send overlay show message to a tab (fire-and-forget) */
function sendOverlayShow(tabId: number, remainingMs: number): void {
  browser.tabs
    .sendMessage(tabId, { type: 'browser-cli-overlay-show', remainingMs }, { frameId: 0 })
    .catch(() => {
      /* content script may not be ready */
    });
}

/** Record a command execution and notify the content script to show overlay */
function touchTab(tabId: number): void {
  tabCommandTimestamps.set(tabId, Date.now());
  sendOverlayShow(tabId, OVERLAY_DURATION_MS);
}

/** Commands handled by the background service worker (not content scripts) */
const BG_ACTIONS = new Set([
  'navigate',
  'goBack',
  'goForward',
  'reload',
  'getUrl',
  'getTitle',
  'tabNew',
  'tabList',
  'tabSwitch',
  'tabClose',
  'cookiesGet',
  'cookiesSet',
  'cookiesClear',
  'screenshot',
  'route',
  'unroute',
  'getRequests',
  'getRoutes',
  'clearRequests',
  'windowNew',
  'windowList',
  'windowClose',
  'setViewport',
  'setHeaders',
  'stateExport',
  'stateImport',
  'evaluate',
]);

async function resolveTargetTab(tabId?: number): Promise<number> {
  if (tabId) return tabId;
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- activeTab may be undefined if no tabs match
  if (!activeTab?.id) throw new Error('No active tab found');
  return activeTab.id;
}

/** Update extension badge to reflect current state */
function updateBadge(mode: 'connected' | 'disconnected' | 'reconnecting' | 'disabled'): void {
  switch (mode) {
    case 'connected':
      void browser.action.setBadgeText({ text: '' });
      break;
    case 'disconnected':
    case 'reconnecting':
      void browser.action.setBadgeText({ text: '...' });
      void browser.action.setBadgeBackgroundColor({ color: '#F9AB00' }); // yellow
      break;
    case 'disabled':
      void browser.action.setBadgeText({ text: 'OFF' });
      void browser.action.setBadgeBackgroundColor({ color: '#9AA0A6' }); // gray
      break;
  }
}

/** Tear down WsClient and mark as disabled */
function teardown(): void {
  if (wsClient) {
    wsClient.stop();
    wsClient = null;
  }
  initializing = false;
  void setState({
    connected: false,
    sessionId: null,
    reconnecting: false,
    nextRetryIn: null,
  });
  updateBadge('disabled');
}

/** Re-create WsClient + NetworkManager if the SW was restarted */
async function ensureInitialized(): Promise<void> {
  if (wsClient || initializing) return;

  // Check if extension is enabled before initializing
  const enabled = await getEnabled();
  if (!enabled) {
    updateBadge('disabled');
    return;
  }

  initializing = true;

  try {
    console.log('[browser-cli] Lazy re-initialization after SW wake');

    networkManager = new NetworkManager();

    const port = await getPort();

    wsClient = new WsClient({
      port,
      messageHandler: handleCommand,
      onConnect: () => {
        console.log('[browser-cli] Connected to daemon');
        void setState({
          connected: true,
          lastConnected: Date.now(),
          reconnecting: false,
          nextRetryIn: null,
        });
        updateBadge('connected');
      },
      onDisconnect: () => {
        console.log('[browser-cli] Disconnected from daemon');
        void setState({ connected: false, lastDisconnected: Date.now(), sessionId: null });
        updateBadge('disconnected');
      },
      onHandshake: (ack) => {
        console.log('[browser-cli] Handshake complete, session:', ack.sessionId);
        void setState({ sessionId: ack.sessionId });
      },
      onReconnecting: (nextRetryMs) => {
        console.log(`[browser-cli] Reconnecting in ${nextRetryMs}ms...`);
        void setState({ reconnecting: true, nextRetryIn: nextRetryMs });
        updateBadge('reconnecting');
      },
    });

    wsClient.start();
  } catch (err) {
    initializing = false;
    throw err;
  }
}

/** Send a message to a content script with retry on "Receiving end does not exist" */
async function sendToContentScript(
  tabId: number,
  message: { type: string; id: string; command: unknown },
  maxRetries = 3,
  delayMs = 500,
): Promise<{ success: boolean; data?: unknown; error?: unknown }> {
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

async function handleCommand(msg: RequestMessage): Promise<ResponseMessage> {
  const { id, command } = msg;

  console.log(`[browser-cli] Handling command #${id}:`, command.action, command);

  try {
    const targetTabId = await resolveTargetTab(msg.tabId);

    // Record command timestamp and notify overlay
    touchTab(targetTabId);

    if (BG_ACTIONS.has(command.action)) {
      console.log(`[browser-cli] Routing to background handler: ${command.action}`);
      const { handleBackgroundCommand } = await import('../lib/command-router');
      const result = await handleBackgroundCommand(msg, targetTabId, networkManager);
      console.log(
        `[browser-cli] Background command #${id} result:`,
        result.success ? 'success' : 'error',
        result,
      );
      return result;
    }

    // Forward to content script (with retry)
    console.log(
      `[browser-cli] Forwarding to content script on tab ${targetTabId}: ${command.action}`,
    );
    const response = await sendToContentScript(targetTabId, {
      type: 'browser-cli-command',
      id,
      command,
    });

    console.log(
      `[browser-cli] Content script response #${id}:`,
      response.success ? 'success' : 'error',
      response,
    );

    return {
      id,
      type: 'response',
      success: response.success,
      data: response.data,
      error: response.error as ProtocolError | undefined,
    };
  } catch (err) {
    console.error(`[browser-cli] Command #${id} failed:`, err);
    return {
      id,
      type: 'response',
      success: false,
      error: classifyError(err, ErrorCode.CONTENT_SCRIPT_ERROR),
    };
  }
}

// ─── Firefox: relax CSP headers so MAIN-world eval() works ──────────
// Chrome exempts extension-injected code from page CSP; Firefox does not.
// Use webRequest.onHeadersReceived (MV2 blocking) to inject 'unsafe-eval'
// into script-src and strip require-trusted-types-for before the page loads.
// NOTE: Service-Worker-cached responses bypass webRequest — the ISOLATED
// world fallback in command-router.ts covers that case.
if (import.meta.env.FIREFOX) {
  try {
    browser.webRequest.onHeadersReceived.addListener(
      (details) => {
        const headers = details.responseHeaders?.map((h) => {
          if (h.name.toLowerCase() === 'content-security-policy' && h.value) {
            let csp = h.value;
            if (!csp.includes("'unsafe-eval'")) {
              if (/script-src\s/.test(csp)) {
                csp = csp.replace(/script-src\s+/, "script-src 'unsafe-eval' ");
              } else if (/default-src\s/.test(csp)) {
                // default-src is the fallback for script-src per CSP spec
                csp = csp.replace(/default-src\s+/, "default-src 'unsafe-eval' ");
              }
            }
            csp = csp.replace(/;\s*require-trusted-types-for\s+[^;]*/g, '');
            return { ...h, value: csp };
          }
          return h;
        });
        return { responseHeaders: headers };
      },
      { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame'] },
      ['blocking', 'responseHeaders'],
    );
  } catch {
    // WXT build-time fake-browser does not implement webRequest.onHeadersReceived
  }
}

// ─── Module-scope event listeners (survive SW restart) ───────────────

// Catch unhandled promise rejections in the service worker
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('[browser-cli] Unhandled rejection in SW:', event.reason);
  });
}

// Clean up tab state when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  frameManager.clearTab(tabId);
  tabCommandTimestamps.delete(tabId);
});

// Re-show overlay on navigation completion if tab was recently operated on
// Uses tabs.onUpdated (already have 'tabs' permission) instead of webNavigation
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const ts = tabCommandTimestamps.get(tabId);
  if (!ts) return;
  const remaining = OVERLAY_DURATION_MS - (Date.now() - ts);
  if (remaining > 0) {
    sendOverlayShow(tabId, remaining);
  }
});

// Listen for port and enabled changes from popup
browser.storage.onChanged.addListener((changes) => {
  const stateChange = changes['browserCliState'];
  if (stateChange?.newValue && stateChange.oldValue) {
    const newState = stateChange.newValue as Record<string, unknown>;
    const oldState = stateChange.oldValue as Record<string, unknown>;

    // Handle enabled toggle
    if (typeof newState.enabled === 'boolean' && newState.enabled !== oldState.enabled) {
      if (newState.enabled) {
        console.log('[browser-cli] Extension enabled via toggle');
        ensureInitialized().catch((err: unknown) => {
          console.error('[browser-cli] Failed to initialize after enable:', err);
        });
      } else {
        console.log('[browser-cli] Extension disabled via toggle');
        teardown();
      }
    }

    // Handle port change
    const newPort = newState.port;
    const oldPort = oldState.port;
    if (typeof newPort === 'number' && typeof oldPort === 'number' && newPort !== oldPort) {
      ensureInitialized()
        .then(() => {
          if (wsClient) {
            console.log(`[browser-cli] Port changed: ${oldPort} → ${newPort}`);
            wsClient.updatePort(newPort);
          }
        })
        .catch((err: unknown) => {
          console.error('[browser-cli] Failed to initialize after port change:', err);
        });
    }
  }
});

// Listen for manual reconnect requests from popup and eval-in-main from content scripts
browser.runtime.onMessage.addListener(
  (message: { type?: string; expression?: string }, sender, sendResponse) => {
    if (message.type === 'reconnect') {
      ensureInitialized()
        .then(() => {
          wsClient?.reconnect();
          sendResponse({ success: true });
        })
        .catch((err: unknown) => {
          console.error('[browser-cli] Failed to initialize for reconnect:', err);
          sendResponse({ success: false, error: String(err) });
        });
    } else if (message.type === 'getConnectionState') {
      ensureInitialized()
        .then(() => {
          sendResponse({
            connected: wsClient?.isConnected ?? false,
            sessionId: wsClient?.currentSessionId ?? null,
          });
        })
        .catch((err: unknown) => {
          console.error('[browser-cli] Failed to initialize for state check:', err);
          sendResponse({ connected: false, sessionId: null });
        });
    } else if (message.type === 'disconnect') {
      // Explicit disconnect (used by toggle off)
      if (wsClient) {
        wsClient.stop();
        wsClient = null;
        initializing = false;
      }
      void setState({ connected: false, sessionId: null, reconnecting: false, nextRetryIn: null });
      sendResponse({ success: true });
    } else if (message.type === 'browser-cli-eval-in-main' && sender.tab?.id) {
      // Validate sender is this extension
      if (sender.id !== browser.runtime.id) {
        sendResponse({ result: null, error: 'Unauthorized sender' });
        return true;
      }
      // Evaluate in MAIN world via scripting.executeScript
      // (Chrome: always works; Firefox: works after webRequest CSP strip)
      {
        browser.scripting
          .executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN',
            func: (expr: string) => (0, eval)(expr),
            args: [message.expression ?? ''],
          })
          .then((results) => {
            sendResponse({ result: results[0]?.result });
          })
          .catch((err: unknown) => {
            sendResponse({
              result: null,
              error: `eval failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          });
      }
    }
    // Return true to indicate we'll send a response asynchronously
    return true;
  },
);

// Re-initialize on browser startup and extension install/update
browser.runtime.onStartup.addListener(() => {
  ensureInitialized().catch((err: unknown) => {
    console.error('[browser-cli] Failed to initialize on startup:', err);
  });
});
browser.runtime.onInstalled.addListener(() => {
  ensureInitialized().catch((err: unknown) => {
    console.error('[browser-cli] Failed to initialize on install:', err);
  });

  // Configure USER_SCRIPT world CSP to allow eval() for CSP-restricted pages
  if (!import.meta.env.FIREFOX && chrome.userScripts?.configureWorld) {
    chrome.userScripts
      .configureWorld({ csp: "script-src 'unsafe-eval'" })
      .then(() => console.log('[browser-cli] userScripts world configured'))
      .catch((err: unknown) =>
        console.warn('[browser-cli] Failed to configure userScripts world:', err),
      );
  }

  // Re-inject content scripts into all existing tabs after extension reload/update
  browser.tabs
    .query({})
    .then((tabs) => {
      for (const tab of tabs) {
        if (tab.id != null && tab.url && /^https?:\/\//.test(tab.url)) {
          browser.scripting
            .executeScript({
              target: { tabId: tab.id, allFrames: true },
              files: ['content-scripts/content.js'],
            })
            .catch(() => {
              // Silently ignore tabs that can't be injected
            });
        }
      }
      console.log(
        `[browser-cli] Re-injected content scripts into ${tabs.filter((t) => t.url && /^https?:\/\//.test(t.url)).length} tabs`,
      );
    })
    .catch((err: unknown) => {
      console.warn('[browser-cli] Failed to re-inject content scripts:', err);
    });
});

// Handle reconnection alarms from WsClient
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'browser-cli-reconnect') {
    wsClient?.onAlarmFired();
  } else if (alarm.name === 'browser-cli-heartbeat') {
    wsClient?.checkHeartbeat();
  }
});

// ─── defineBackground (first-time initialization) ────────────────────

// eslint-disable-next-line @typescript-eslint/no-misused-promises -- WXT defineBackground supports async
export default defineBackground(async () => {
  console.log('[browser-cli] Background script loaded');
  await ensureInitialized();
});
