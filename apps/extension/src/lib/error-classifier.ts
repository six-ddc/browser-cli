/**
 * Classifies Chrome/browser runtime errors into structured ProtocolErrors
 * with actionable hints for AI consumers.
 */

import { ErrorCode, createError, type ProtocolError } from '@browser-cli/shared';

interface ErrorPattern {
  pattern: RegExp;
  code: ErrorCode;
  message: string;
  hint: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /Could not establish connection\. Receiving end does not exist/i,
    code: ErrorCode.CONTENT_SCRIPT_NOT_READY,
    message:
      'The target tab is not reachable. It may have been closed, navigated to a new page, or is a privileged URL (chrome://, about:).',
    hint: "Use 'tabList' to check available tabs and 'tabSwitch' to select a valid tab.",
  },
  {
    pattern: /No tab with id: (\d+)/i,
    code: ErrorCode.TAB_NOT_FOUND,
    message: 'The tab no longer exists.',
    hint: "Use 'tabList' to see available tabs.",
  },
  {
    pattern: /Cannot access a chrome:\/\/ URL/i,
    code: ErrorCode.CONTENT_SCRIPT_NOT_READY,
    message:
      'Cannot run content scripts on privileged browser pages (chrome://, about:, extension pages).',
    hint: 'Navigate to a regular http/https page first.',
  },
  {
    pattern: /Cannot access contents of url/i,
    code: ErrorCode.CONTENT_SCRIPT_NOT_READY,
    message: 'Cannot access this page. It may be a privileged or restricted URL.',
    hint: 'Navigate to a regular http/https page first.',
  },
  {
    pattern: /No active tab found/i,
    code: ErrorCode.NO_ACTIVE_TAB,
    message: 'No active tab found.',
    hint: "Use 'tabNew <url>' to open a new tab.",
  },
  {
    pattern: /No window with id/i,
    code: ErrorCode.TAB_NOT_FOUND,
    message: 'The browser window no longer exists.',
    hint: "Use 'tabList' to see available tabs.",
  },
  {
    pattern: /Cannot find a (next|previous) page in history/i,
    code: ErrorCode.NAVIGATION_FAILED,
    message: 'No page in browser history to navigate to.',
    hint: 'The tab has no history to go back/forward to. Navigate to more pages first.',
  },
];

/**
 * Classify a raw error into a structured ProtocolError with an actionable hint.
 * If a fallbackCode is provided, it is used when no pattern matches.
 */
export function classifyError(
  err: unknown,
  fallbackCode: ErrorCode = ErrorCode.UNKNOWN,
): ProtocolError {
  const rawMessage = err instanceof Error ? err.message : String(err);

  for (const { pattern, code, message, hint } of ERROR_PATTERNS) {
    if (pattern.test(rawMessage)) {
      return createError(code, message, hint);
    }
  }

  return createError(fallbackCode, rawMessage);
}
