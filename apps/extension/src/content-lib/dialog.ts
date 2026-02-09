/**
 * Dialog handling via MAIN world window patching.
 * Patches window.alert, window.confirm, window.prompt to intercept native dialogs.
 * Uses window.postMessage to communicate between MAIN world and content script.
 */

import type { Command } from '@browser-cli/shared';

const DIALOG_MSG_TYPE = 'browser-cli-dialog';

interface DialogState {
  autoAccept: boolean;
  autoDismiss: boolean;
  promptText: string | undefined;
  injected: boolean;
}

const state: DialogState = {
  autoAccept: false,
  autoDismiss: false,
  promptText: undefined,
  injected: false,
};

function ensureInjected(): void {
  if (state.injected) return;
  state.injected = true;

  // Listen for dialog config updates from content script
  window.addEventListener('message', (event) => {
    if (event.data?.type === `${DIALOG_MSG_TYPE}-response`) {
      // Handled by MAIN world script
    }
  });

  // Inject MAIN world script that patches dialog functions
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      const DIALOG_MSG_TYPE = ${JSON.stringify(DIALOG_MSG_TYPE)};
      let dialogConfig = { autoAccept: false, autoDismiss: false, promptText: undefined };

      // Listen for config updates from content script
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === DIALOG_MSG_TYPE + '-config') {
          dialogConfig = event.data.config;
        }
      });

      const originalAlert = window.alert;
      const originalConfirm = window.confirm;
      const originalPrompt = window.prompt;

      window.alert = function(message) {
        window.postMessage({
          type: DIALOG_MSG_TYPE + '-event',
          dialogType: 'alert',
          message: String(message),
        }, '*');
        // Auto-dismiss alerts (they only have OK)
        if (dialogConfig.autoAccept || dialogConfig.autoDismiss) {
          return;
        }
        return originalAlert.call(window, message);
      };

      window.confirm = function(message) {
        window.postMessage({
          type: DIALOG_MSG_TYPE + '-event',
          dialogType: 'confirm',
          message: String(message),
        }, '*');
        if (dialogConfig.autoAccept) {
          return true;
        }
        if (dialogConfig.autoDismiss) {
          return false;
        }
        return originalConfirm.call(window, message);
      };

      window.prompt = function(message, defaultValue) {
        window.postMessage({
          type: DIALOG_MSG_TYPE + '-event',
          dialogType: 'prompt',
          message: String(message),
          defaultValue: defaultValue,
        }, '*');
        if (dialogConfig.autoAccept) {
          return dialogConfig.promptText !== undefined ? dialogConfig.promptText : (defaultValue || '');
        }
        if (dialogConfig.autoDismiss) {
          return null;
        }
        return originalPrompt.call(window, message, defaultValue);
      };
    })();
  `;
  document.documentElement.appendChild(script);
  script.remove();
}

function sendConfig(): void {
  window.postMessage({
    type: `${DIALOG_MSG_TYPE}-config`,
    config: {
      autoAccept: state.autoAccept,
      autoDismiss: state.autoDismiss,
      promptText: state.promptText,
    },
  }, '*');
}

export async function handleDialog(command: Command): Promise<unknown> {
  ensureInjected();

  switch (command.action) {
    case 'dialogAccept': {
      const { text } = command.params as { text?: string };
      state.autoAccept = true;
      state.autoDismiss = false;
      state.promptText = text;
      sendConfig();
      return { accepted: true };
    }
    case 'dialogDismiss': {
      state.autoAccept = false;
      state.autoDismiss = true;
      state.promptText = undefined;
      sendConfig();
      return { dismissed: true };
    }
    default:
      throw new Error(`Unknown dialog command: ${(command as { action: string }).action}`);
  }
}
