import type { Command } from '@browser-cli/shared';
import { ErrorCode, createError, schemas } from '@browser-cli/shared';
import { classifyError } from '../lib/error-classifier';
import { initFrameBridge } from '../content-lib/frame-bridge';
import { initOverlay } from '../content-lib/command-overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    // Initialize frame bridge for iframe support
    initFrameBridge();

    // Initialize command overlay (auto-shows if tab was recently operated on)
    initOverlay();

    // Listen for commands from background script
    browser.runtime.onMessage.addListener(
      (
        message: { type: string; id: string; command: Command },
        _sender: Browser.runtime.MessageSender,
        sendResponse: (response: unknown) => void,
      ) => {
        if (message.type !== 'browser-cli-command') return false;

        // Validate the command against the schema
        const parseResult = schemas.commandSchema.safeParse(message.command);
        if (!parseResult.success) {
          sendResponse({
            success: false,
            error: createError(
              ErrorCode.INVALID_PARAMS,
              `Invalid command: ${parseResult.error.message}`,
              'Check the command action and params match the expected schema',
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
              error: classifyError(err, ErrorCode.CONTENT_SCRIPT_ERROR),
            });
          });

        // Return true to indicate async response
        return true;
      },
    );
  },
});

async function handleContentCommand(command: Command): Promise<unknown> {
  // Check if we need to route to an iframe
  const { getCurrentFrameIndex, getCurrentIFrame } = await import('../content-lib/frames');
  const frameIndex = getCurrentFrameIndex();

  // If we're targeting an iframe, route the command there
  if (
    frameIndex > 0 &&
    command.action !== 'switchFrame' &&
    command.action !== 'listFrames' &&
    command.action !== 'getCurrentFrame'
  ) {
    const iframe = getCurrentIFrame();
    if (!iframe) {
      throw new Error(`Frame index ${frameIndex} is no longer available`);
    }

    const { executeInFrame } = await import('../content-lib/frame-bridge');
    return executeInFrame(iframe, command);
  }

  // Execute command in main frame context
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

    // Frame management
    case 'switchFrame': {
      const { handleSwitchFrame } = await import('../content-lib/frames');
      return handleSwitchFrame(command.params);
    }

    case 'listFrames': {
      const { handleListFrames } = await import('../content-lib/frames');
      return handleListFrames();
    }

    case 'getCurrentFrame': {
      const { handleGetCurrentFrame } = await import('../content-lib/frames');
      return handleGetCurrentFrame();
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
