import { WsClient } from '../lib/ws-client';
import { getPort, setState } from '../lib/state';
import type { RequestMessage, ResponseMessage } from '@browser-cli/shared';
import { ErrorCode, createError } from '@browser-cli/shared';

let wsClient: WsClient | null = null;

async function resolveTargetTab(tabId?: number): Promise<number> {
  if (tabId) return tabId;
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) throw new Error('No active tab found');
  return activeTab.id;
}

async function handleCommand(msg: RequestMessage): Promise<ResponseMessage> {
  const { id, command } = msg;

  try {
    const targetTabId = await resolveTargetTab(msg.tabId);

    // Route command: background-level commands vs content-script commands
    const bgActions = new Set([
      'navigate', 'goBack', 'goForward', 'reload', 'getUrl', 'getTitle',
      'tabNew', 'tabList', 'tabSwitch', 'tabClose',
      'cookiesGet', 'cookiesSet', 'cookiesClear',
      'screenshot',
    ]);

    if (bgActions.has(command.action)) {
      const { handleBackgroundCommand } = await import('../lib/command-router');
      return handleBackgroundCommand(msg, targetTabId);
    }

    // Forward to content script
    const response = await browser.tabs.sendMessage(targetTabId, {
      type: 'browser-cli-command',
      id,
      command,
    });

    return {
      id,
      type: 'response',
      success: response.success,
      data: response.data,
      error: response.error,
    };
  } catch (err) {
    return {
      id,
      type: 'response',
      success: false,
      error: createError(
        ErrorCode.CONTENT_SCRIPT_ERROR,
        (err as Error).message || 'Unknown error',
      ),
    };
  }
}

export default defineBackground(async () => {
  console.log('[browser-cli] Background script loaded');

  const port = await getPort();

  wsClient = new WsClient({
    port,
    messageHandler: handleCommand,
    onConnect: () => {
      console.log('[browser-cli] Connected to daemon');
      setState({ connected: true, lastConnected: Date.now() });
    },
    onDisconnect: () => {
      console.log('[browser-cli] Disconnected from daemon');
      setState({ connected: false, lastDisconnected: Date.now(), sessionId: null });
    },
    onHandshake: (ack) => {
      console.log('[browser-cli] Handshake complete, session:', ack.sessionId);
      setState({ sessionId: ack.sessionId });
    },
  });

  wsClient.start();

  // Listen for port changes from popup
  browser.storage.onChanged.addListener((changes) => {
    const stateChange = changes['browserCliState'];
    if (stateChange?.newValue) {
      const newState = stateChange.newValue as Record<string, unknown>;
      if (typeof newState.port === 'number' && wsClient && newState.port !== port) {
        wsClient.updatePort(newState.port);
      }
    }
  });
});
