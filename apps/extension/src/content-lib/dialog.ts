/**
 * Dialog handling via background script's chrome.scripting.executeScript.
 * Patches window.alert, window.confirm, window.prompt in the MAIN world
 * to intercept native dialogs. Config is stored on window.__browserCliDialogConfig.
 * This approach bypasses CSP restrictions that block inline <script> injection.
 */

import type { Command } from '@browser-cli/shared';

/**
 * Ensure the dialog patcher is injected into the MAIN world.
 */
async function ensureInjected(): Promise<void> {
  const checkResponse = await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: '!!window.__browserCliDialogPatched',
  });

  if (checkResponse?.result) return;

  await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: `(function() {
      if (window.__browserCliDialogPatched) return;
      window.__browserCliDialogPatched = true;
      window.__browserCliDialogConfig = { autoAccept: false, autoDismiss: false, promptText: undefined };

      var originalAlert = window.alert;
      var originalConfirm = window.confirm;
      var originalPrompt = window.prompt;

      window.alert = function(message) {
        var config = window.__browserCliDialogConfig;
        if (config.autoAccept || config.autoDismiss) {
          return;
        }
        return originalAlert.call(window, message);
      };

      window.confirm = function(message) {
        var config = window.__browserCliDialogConfig;
        if (config.autoAccept) {
          return true;
        }
        if (config.autoDismiss) {
          return false;
        }
        return originalConfirm.call(window, message);
      };

      window.prompt = function(message, defaultValue) {
        var config = window.__browserCliDialogConfig;
        if (config.autoAccept) {
          return config.promptText !== undefined ? config.promptText : (defaultValue || '');
        }
        if (config.autoDismiss) {
          return null;
        }
        return originalPrompt.call(window, message, defaultValue);
      };
    })()`,
  });
}

/**
 * Update dialog config in the MAIN world.
 */
async function updateConfig(config: {
  autoAccept: boolean;
  autoDismiss: boolean;
  promptText?: string;
}): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'browser-cli-eval-in-main',
    expression: `window.__browserCliDialogConfig = ${JSON.stringify(config)}`,
  });
}

export async function handleDialog(command: Command): Promise<unknown> {
  await ensureInjected();

  switch (command.action) {
    case 'dialogAccept': {
      const { text } = command.params;
      await updateConfig({
        autoAccept: true,
        autoDismiss: false,
        promptText: text,
      });
      return { accepted: true };
    }
    case 'dialogDismiss': {
      await updateConfig({
        autoAccept: false,
        autoDismiss: true,
      });
      return { dismissed: true };
    }
    default:
      throw new Error(`Unknown dialog command: ${(command as { action: string }).action}`);
  }
}
