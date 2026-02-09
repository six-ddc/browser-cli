import type { Command } from '@browser-cli/shared';
import { ErrorCode, createError } from '@browser-cli/shared';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Listen for commands from background script
    browser.runtime.onMessage.addListener((
      message: { type: string; id: string; command: Command },
      _sender: Browser.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      if (message.type !== 'browser-cli-command') return false;

      const { command } = message;

      handleContentCommand(command)
        .then((result) => {
          sendResponse({ success: true, data: result });
        })
        .catch((err) => {
          sendResponse({
            success: false,
            error: createError(
              ErrorCode.CONTENT_SCRIPT_ERROR,
              (err as Error).message || 'Unknown error',
            ),
          });
        });

      // Return true to indicate async response
      return true;
    });
  },
});

async function handleContentCommand(command: Command): Promise<unknown> {
  // Dynamic import of content-lib modules based on action
  switch (command.action) {
    // Interaction
    case 'click':
    case 'dblclick':
    case 'hover':
    case 'fill':
    case 'type':
    case 'press':
    case 'clear':
    case 'focus': {
      const { handleInteraction } = await import('../content-lib/dom-interact');
      return handleInteraction(command);
    }

    // Data queries
    case 'getText':
    case 'getHtml':
    case 'getValue':
    case 'getAttribute':
    case 'isVisible':
    case 'isEnabled':
    case 'isChecked':
    case 'count':
    case 'boundingBox': {
      const { handleQuery } = await import('../content-lib/dom-query');
      return handleQuery(command);
    }

    // Snapshot
    case 'snapshot': {
      const { handleSnapshot } = await import('../content-lib/snapshot');
      return handleSnapshot(command.params);
    }

    // Form
    case 'check':
    case 'uncheck':
    case 'select': {
      const { handleForm } = await import('../content-lib/form');
      return handleForm(command);
    }

    // Scroll
    case 'scroll':
    case 'scrollIntoView': {
      const { handleScroll } = await import('../content-lib/scroll');
      return handleScroll(command);
    }

    // Wait
    case 'wait':
    case 'waitForUrl': {
      const { handleWait } = await import('../content-lib/wait');
      return handleWait(command);
    }

    // Evaluate
    case 'evaluate': {
      const { handleEvaluate } = await import('../content-lib/evaluate');
      return handleEvaluate(command.params);
    }

    // Console
    case 'getConsole':
    case 'getErrors': {
      const { handleConsole } = await import('../content-lib/console-capture');
      return handleConsole(command);
    }

    // Storage
    case 'storageGet':
    case 'storageSet':
    case 'storageClear': {
      const { handleStorage } = await import('../content-lib/storage-access');
      return handleStorage(command);
    }

    // Dialog
    case 'dialogAccept':
    case 'dialogDismiss': {
      const { handleDialog } = await import('../content-lib/dialog');
      return handleDialog(command);
    }

    // Highlight
    case 'highlight': {
      const { handleHighlight } = await import('../content-lib/highlight');
      return handleHighlight(command.params);
    }

    default:
      throw new Error(`Unknown content command: ${(command as { action: string }).action}`);
  }
}
