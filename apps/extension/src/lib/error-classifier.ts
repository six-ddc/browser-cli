/**
 * Classifies Chrome/browser runtime errors into structured ProtocolErrors
 * with actionable messages for AI consumers.
 */

import { BrowserCliError, isProtocolError, protocolError } from '@browser-cli/shared';
import type { ErrorCode, ProtocolError } from '@browser-cli/shared';

interface ErrorPattern {
  pattern: RegExp;
  code: ErrorCode;
  message: string;
  hint: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /Could not establish connection\. Receiving end does not exist/i,
    code: 'CONTENT_SCRIPT_NOT_READY',
    message:
      'The target tab has no content script listening. It may have been closed, be mid-navigation, or be a privileged URL (chrome://, about:).',
    hint: "Run 'tab list' to check the tab still exists, 'wait --load domcontentloaded' if it is still loading, or navigate to a regular http/https page.",
  },
  {
    pattern: /No tab with id: (\d+)/i,
    code: 'TAB_NOT_FOUND',
    message: 'The tab no longer exists.',
    hint: "Run 'tab list' to see the open tabs, then retarget with --tab <id>.",
  },
  {
    pattern: /Cannot access a chrome:\/\/ URL/i,
    code: 'UNSUPPORTED_PAGE',
    message:
      'Content scripts cannot run on privileged browser pages (chrome://, about:, extension pages).',
    hint: 'Navigate to a regular http/https page first.',
  },
  {
    pattern: /Cannot access contents of url/i,
    code: 'UNSUPPORTED_PAGE',
    message: 'Cannot access this page — it is a privileged or restricted URL.',
    hint: 'Navigate to a regular http/https page first.',
  },
  {
    pattern: /No active tab found/i,
    code: 'TAB_NOT_FOUND',
    message: 'No active tab found.',
    hint: "Open one with 'tab new <url>'.",
  },
  {
    pattern: /No window with id/i,
    code: 'TAB_NOT_FOUND',
    message: 'The browser window no longer exists.',
    hint: "Run 'tab list' to see the available tabs.",
  },
  {
    pattern: /Cannot find a (next|previous) page in history/i,
    code: 'NAVIGATION_ERROR',
    message: 'No page in browser history to navigate to.',
    hint: 'This tab has nothing to go back/forward to — navigate to more pages first.',
  },
  {
    pattern: /Another debugger is already attached/i,
    code: 'DEBUGGER_ERROR',
    message:
      'Cannot attach the debugger — another debugger (e.g. DevTools) is already attached to this tab.',
    hint: 'Close Chrome DevTools on the target tab and retry with --debugger.',
  },
  {
    pattern: /Debugger is not attached|Target closed/i,
    code: 'DEBUGGER_ERROR',
    message: 'The debugger lost its connection to the tab — it may have been closed or navigated.',
    hint: "Verify the tab is still open with 'tab list' and retry.",
  },
  {
    pattern: /unsafe-eval|Trusted Type|Content Security Policy.*eval/i,
    code: 'CSP_BLOCKED',
    message:
      "eval() is blocked by this page's Content Security Policy. Sites like Gmail, Google Drive and GitHub enforce a strict CSP that prevents JavaScript evaluation.",
    hint: "Use 'snapshot -ic' to read interactive elements, 'snapshot -c' for full page content, or 'find' to locate and interact with elements.",
  },
];

/**
 * Classify a raw error into a structured ProtocolError with an actionable message.
 * Errors that already carry a code pass through untouched.
 */
export function classifyError(err: unknown): ProtocolError {
  if (err instanceof BrowserCliError) return err.toProtocolError();
  if (isProtocolError(err)) return protocolError(err.code, err.message, err.hint, err.stack);

  const rawMessage = err instanceof Error ? err.message : String(err);

  for (const { pattern, code, message, hint } of ERROR_PATTERNS) {
    if (pattern.test(rawMessage)) {
      return protocolError(code, message, hint);
    }
  }

  // Timeouts keep their original message — it names what was being waited for.
  if (/timeout|timed out/i.test(rawMessage)) {
    return protocolError(
      'TIMEOUT',
      rawMessage,
      'Raise --timeout, or wait for a concrete condition first (`wait <selector>` / `wait --url <pattern>`).',
    );
  }

  return protocolError('UNKNOWN', rawMessage);
}
