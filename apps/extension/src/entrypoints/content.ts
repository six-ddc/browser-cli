import type { Command } from '@browser-cli/shared';
import { protocolError, schemas } from '@browser-cli/shared';
import { classifyError } from '../lib/error-classifier';
import { initOverlay } from '../content-lib/command-overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  main() {
    // Initialize command overlay (auto-shows if tab was recently operated on)
    initOverlay();

    // Listen for commands from background script
    browser.runtime.onMessage.addListener(
      (
        message: { type: string; id: string; command: Command },
        _sender: Browser.runtime.MessageSender,
        sendResponse: (response: unknown) => void,
      ) => {
        // Ping handler — background script uses this to verify content script is ready
        if (message.type === 'browser-cli-ping') {
          sendResponse({ ready: true });
          return false;
        }

        if (message.type !== 'browser-cli-command') return false;

        // Validate the command against the schema
        const parseResult = schemas.commandSchema.safeParse(message.command);
        if (!parseResult.success) {
          sendResponse({
            success: false,
            error: protocolError(
              'INVALID_ARGS',
              `Invalid command: ${parseResult.error.message}`,
              'Check the action name and that its params match the protocol schema.',
            ),
          });
          return true;
        }

        const command = parseResult.data as Command;

        handleContentCommand(command)
          .then((result) => {
            sendResponse({ success: true, data: result });
          })
          .catch((err: unknown) => {
            sendResponse({
              success: false,
              error: classifyError(err),
            });
          });

        // Return true to indicate async response
        return true;
      },
    );
  },
});

async function handleContentCommand(command: Command): Promise<unknown> {
  // The background delivers each command straight to the target frame's
  // content script by frameId, so this always runs in the intended document.
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
    case 'focus':
    case 'drag':
    case 'keydown':
    case 'keyup': {
      const { handleInteraction } = await import('../content-lib/dom-interact');
      return handleInteraction(command);
    }

    // Mouse
    case 'mouseMove':
    case 'mouseDown':
    case 'mouseUp':
    case 'mouseWheel': {
      const { handleMouse } = await import('../content-lib/mouse');
      return handleMouse(command);
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

    case 'formFill': {
      const { handleFormFill } = await import('../content-lib/form-fill');
      return handleFormFill(command);
    }

    // Upload
    case 'upload': {
      const { handleUpload } = await import('../content-lib/upload');
      return handleUpload(command);
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

    // Browser Config (content-script side: geo, media)
    case 'setGeo':
    case 'setMedia': {
      const { handleBrowserConfig } = await import('../content-lib/browser-config');
      return handleBrowserConfig(command);
    }

    // Frame management (background-driven: describe this document, locate iframes)
    case 'getCurrentFrame': {
      const { handleGetCurrentFrame } = await import('../content-lib/frames');
      return handleGetCurrentFrame();
    }

    case 'resolveFrame': {
      const { handleResolveFrame } = await import('../content-lib/frames');
      return handleResolveFrame(command.params);
    }

    case 'frameOffset': {
      const { handleFrameOffset } = await import('../content-lib/frames');
      return handleFrameOffset(command.params);
    }

    // Markdown
    case 'markdown': {
      const { handleMarkdown } = await import('../content-lib/markdown');
      return handleMarkdown();
    }

    default:
      throw new Error(`Unknown content command: ${(command as { action: string }).action}`);
  }
}
