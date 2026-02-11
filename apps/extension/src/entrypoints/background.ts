import { WsClient } from '../lib/ws-client';
import { getPort, setState } from '../lib/state';
import type { RequestMessage, ResponseMessage } from '@browser-cli/shared';
import { ErrorCode } from '@browser-cli/shared';
import { classifyError } from '../lib/error-classifier';
import { NetworkManager } from '../lib/network-manager';

let wsClient: WsClient | null = null;
let networkManager: NetworkManager | null = null;

/** Commands handled by the background service worker (not content scripts) */
const BG_ACTIONS = new Set([
  'navigate', 'goBack', 'goForward', 'reload', 'getUrl', 'getTitle',
  'tabNew', 'tabList', 'tabSwitch', 'tabClose',
  'cookiesGet', 'cookiesSet', 'cookiesClear',
  'screenshot',
  'route', 'unroute', 'getRequests', 'getRoutes', 'clearRequests',
  'windowNew', 'windowList', 'windowClose',
  'setViewport', 'setHeaders',
  'stateExport', 'stateImport',
]);

async function resolveTargetTab(tabId?: number): Promise<number> {
  if (tabId) return tabId;
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) throw new Error('No active tab found');
  return activeTab.id;
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
      console.log(`[browser-cli] Background command #${id} result:`, result.success ? 'success' : 'error', result);
      return result;
    }

    // Forward to content script
    console.log(`[browser-cli] Forwarding to content script on tab ${targetTabId}: ${command.action}`);
    const response = await browser.tabs.sendMessage(targetTabId, {
      type: 'browser-cli-command',
      id,
      command,
    });

    console.log(`[browser-cli] Content script response #${id}:`, response.success ? 'success' : 'error', response);

    return {
      id,
      type: 'response',
      success: response.success,
      data: response.data,
      error: response.error,
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

export default defineBackground(async () => {
  console.log('[browser-cli] Background script loaded');

  // Initialize network manager
  networkManager = new NetworkManager();
  console.log('[browser-cli] NetworkManager initialized');

  const port = await getPort();

  wsClient = new WsClient({
    port,
    messageHandler: handleCommand,
    onConnect: () => {
      console.log('[browser-cli] Connected to daemon');
      setState({ connected: true, lastConnected: Date.now(), reconnecting: false, nextRetryIn: null });
    },
    onDisconnect: () => {
      console.log('[browser-cli] Disconnected from daemon');
      setState({ connected: false, lastDisconnected: Date.now(), sessionId: null });
    },
    onHandshake: (ack) => {
      console.log('[browser-cli] Handshake complete, session:', ack.sessionId);
      setState({ sessionId: ack.sessionId });
    },
    onReconnecting: (nextRetryMs) => {
      console.log(`[browser-cli] Reconnecting in ${nextRetryMs}ms...`);
      setState({ reconnecting: true, nextRetryIn: nextRetryMs });
    },
  });

  wsClient.start();

  // Listen for port changes from popup
  browser.storage.onChanged.addListener((changes) => {
    const stateChange = changes['browserCliState'];
    if (stateChange?.newValue && stateChange?.oldValue) {
      const newState = stateChange.newValue as Record<string, unknown>;
      const oldState = stateChange.oldValue as Record<string, unknown>;
      const newPort = newState.port;
      const oldPort = oldState.port;

      if (typeof newPort === 'number' && typeof oldPort === 'number' && newPort !== oldPort && wsClient) {
        console.log(`[browser-cli] Port changed: ${oldPort} → ${newPort}`);
        wsClient.updatePort(newPort);
      }
    }
  });

  // Listen for manual reconnect requests from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'reconnect' && wsClient) {
      wsClient.reconnect();
      sendResponse({ success: true });
    } else if (message.type === 'getConnectionState' && wsClient) {
      // Popup can query current connection state
      sendResponse({
        connected: wsClient.isConnected,
        sessionId: wsClient.currentSessionId,
      });
    }
    // Return true to indicate we'll send a response asynchronously
    return true;
  });
});
