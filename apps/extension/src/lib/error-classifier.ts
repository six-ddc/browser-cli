/**
 * Classifies Chrome/browser runtime errors into structured ProtocolErrors
 * with actionable messages for AI consumers.
 */

import type { ProtocolError } from '@browser-cli/shared';

interface ErrorPattern {
  pattern: RegExp;
  message: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /Could not establish connection\. Receiving end does not exist/i,
    message:
      "The target tab is not reachable. It may have been closed, navigated to a new page, or is a privileged URL (chrome://, about:). Use 'tabList' to check available tabs and 'tabSwitch' to select a valid tab.",
  },
  {
    pattern: /No tab with id: (\d+)/i,
    message: "The tab no longer exists. Use 'tabList' to see available tabs.",
  },
  {
    pattern: /Cannot access a chrome:\/\/ URL/i,
    message:
      'Cannot run content scripts on privileged browser pages (chrome://, about:, extension pages). Navigate to a regular http/https page first.',
  },
  {
    pattern: /Cannot access contents of url/i,
    message:
      'Cannot access this page. It may be a privileged or restricted URL. Navigate to a regular http/https page first.',
  },
  {
    pattern: /No active tab found/i,
    message: "No active tab found. Use 'tabNew <url>' to open a new tab.",
  },
  {
    pattern: /No window with id/i,
    message: "The browser window no longer exists. Use 'tabList' to see available tabs.",
  },
  {
    pattern: /Cannot find a (next|previous) page in history/i,
    message:
      'No page in browser history to navigate to. The tab has no history to go back/forward to. Navigate to more pages first.',
  },
  {
    pattern: /Another debugger is already attached/i,
    message:
      'Cannot attach debugger — another debugger (e.g., DevTools) is already attached to this tab. Close Chrome DevTools on the target tab and retry the command with --debugger.',
  },
  {
    pattern: /Debugger is not attached|Target closed/i,
    message:
      'Debugger lost connection to the tab. The tab may have been closed or navigated. Verify the tab is still open with `tabList` and retry.',
  },
  {
    pattern: /unsafe-eval|Trusted Type|Content Security Policy.*eval/i,
    message:
      "eval() is blocked by this page's Content Security Policy (CSP). " +
      'Sites like Gmail, Google Drive, and GitHub enforce strict CSP that prevents JavaScript evaluation. ' +
      "Use 'snapshot -ic' to read interactive elements, 'snapshot -c' for full page content, or 'find' to locate and interact with elements.",
  },
];

/**
 * Classify a raw error into a structured ProtocolError with an actionable message.
 */
export function classifyError(err: unknown): ProtocolError {
  const rawMessage = err instanceof Error ? err.message : String(err);

  for (const { pattern, message } of ERROR_PATTERNS) {
    if (pattern.test(rawMessage)) {
      return { message };
    }
  }

  return { message: rawMessage };
}
