import { WsClient } from '../lib/ws-client';
import { getPort, setState } from '../lib/state';
import type { RequestMessage, ResponseMessage, ProtocolError } from '@browser-cli/shared';
import { ErrorCode } from '@browser-cli/shared';
import { classifyError } from '../lib/error-classifier';
import { NetworkManager } from '../lib/network-manager';
import { frameManager } from '../lib/frame-manager';

let wsClient: WsClient | null = null;
let networkManager: NetworkManager | null = null;
let initializing = false;

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

/** Re-create WsClient + NetworkManager if the SW was restarted */
async function ensureInitialized(): Promise<void> {
  if (wsClient || initializing) return;
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
      },
      onDisconnect: () => {
        console.log('[browser-cli] Disconnected from daemon');
        void setState({ connected: false, lastDisconnected: Date.now(), sessionId: null });
      },
      onHandshake: (ack) => {
        console.log('[browser-cli] Handshake complete, session:', ack.sessionId);
        void setState({ sessionId: ack.sessionId });
      },
      onReconnecting: (nextRetryMs) => {
        console.log(`[browser-cli] Reconnecting in ${nextRetryMs}ms...`);
        void setState({ reconnecting: true, nextRetryIn: nextRetryMs });
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
});

// Listen for port changes from popup
browser.storage.onChanged.addListener((changes) => {
  const stateChange = changes['browserCliState'];
  if (stateChange.newValue && stateChange.oldValue) {
    const newState = stateChange.newValue as Record<string, unknown>;
    const oldState = stateChange.oldValue as Record<string, unknown>;
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
    } else if (message.type === 'browser-cli-eval-in-main' && sender.tab?.id) {
      // Validate sender is this extension
      if (sender.id !== browser.runtime.id) {
        sendResponse({ result: null, error: 'Unauthorized sender' });
        return true;
      }
      if (import.meta.env.FIREFOX) {
        // Firefox: content script already uses <script> injection in evaluate.ts,
        // so this path shouldn't normally be hit. Forward to content script as fallback.
        browser.tabs
          .sendMessage(
            sender.tab.id,
            {
              type: 'browser-cli-command',
              id: `bg-eval-main-${Date.now()}`,
              command: { action: 'evaluate', params: { expression: message.expression } },
            },
            { frameId: 0 },
          )
          .then(
            (response: {
              success: boolean;
              data?: { value: unknown };
              error?: { message?: string };
            }) => {
              sendResponse({
                result: response.success ? response.data?.value : null,
                error: response.success ? undefined : response.error?.message,
              });
            },
          )
          .catch((err: unknown) => {
            sendResponse({
              result: null,
              error: `eval failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          });
      } else {
        // Chrome: evaluate in MAIN world directly
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
