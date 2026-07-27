/**
 * Structured protocol errors.
 *
 * Errors are consumed by AI agents: every error carries a machine-readable
 * `code`, a human/agent-readable `message`, and a `hint` describing the next
 * action to take.
 */

export const ERROR_CODES = [
  'ELEMENT_NOT_FOUND',
  'MULTIPLE_MATCHES',
  'STALE_REF',
  'ELEMENT_NOT_VISIBLE',
  'ELEMENT_DISABLED',
  'ELEMENT_OCCLUDED',
  'ELEMENT_TYPE_MISMATCH',
  'TIMEOUT',
  'CONTENT_SCRIPT_NOT_READY',
  'EXTENSION_NOT_CONNECTED',
  'SESSION_NOT_FOUND',
  'TAB_NOT_FOUND',
  'UNSUPPORTED_PAGE',
  'UNSUPPORTED',
  'CSP_BLOCKED',
  'FRAME_ERROR',
  'DEBUGGER_ERROR',
  'NAVIGATION_ERROR',
  'PERMISSION_DENIED',
  'INVALID_ARGS',
  'ASSERTION_FAILED',
  'POLICY_DENIED',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ProtocolError {
  code: ErrorCode;
  message: string;
  hint?: string;
  /** Page-side stack trace, when the error came from evaluated page code. */
  stack?: string;
}

/** Build a structured error object. */
export function protocolError(
  code: ErrorCode,
  message: string,
  hint?: string,
  stack?: string,
): ProtocolError {
  const err: ProtocolError = { code, message };
  if (hint) err.hint = hint;
  if (stack) err.stack = stack;
  return err;
}

/**
 * Process exit codes. Distinct classes so an agent can branch on the exit
 * status alone without parsing stderr.
 */
export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_INVALID_ARGS = 2;
export const EXIT_NOT_FOUND = 3;
export const EXIT_TIMEOUT = 4;
export const EXIT_NOT_CONNECTED = 5;

const EXIT_CODE_BY_ERROR: Partial<Record<ErrorCode, number>> = {
  INVALID_ARGS: EXIT_INVALID_ARGS,
  ELEMENT_NOT_FOUND: EXIT_NOT_FOUND,
  STALE_REF: EXIT_NOT_FOUND,
  TAB_NOT_FOUND: EXIT_NOT_FOUND,
  SESSION_NOT_FOUND: EXIT_NOT_FOUND,
  TIMEOUT: EXIT_TIMEOUT,
  EXTENSION_NOT_CONNECTED: EXIT_NOT_CONNECTED,
  CONTENT_SCRIPT_NOT_READY: EXIT_NOT_CONNECTED,
};

/** Map an error code onto its process exit code. */
export function exitCodeFor(code: string | undefined): number {
  return EXIT_CODE_BY_ERROR[code as ErrorCode] ?? EXIT_FAILURE;
}

/**
 * Throwable carrier for a ProtocolError. Extends Error so it survives every
 * `catch`/`instanceof Error` path already in the codebase.
 */
export class BrowserCliError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  /** Stack from the page/user code that failed — distinct from this Error's own stack. */
  pageStack?: string;

  constructor(code: ErrorCode, message: string, hint?: string, pageStack?: string) {
    super(message);
    this.name = 'BrowserCliError';
    this.code = code;
    this.hint = hint;
    this.pageStack = pageStack;
  }

  toProtocolError(): ProtocolError {
    return protocolError(this.code, this.message, this.hint, this.pageStack);
  }
}

/** Type guard for objects already shaped like a ProtocolError. */
export function isProtocolError(value: unknown): value is ProtocolError {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { message?: unknown }).message === 'string' &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

/**
 * Fill in a missing `code` so consumers can rely on it.
 * Used at layer boundaries where an error may have been produced by older
 * code or by a raw `throw new Error()`.
 */
export function normalizeError(error: {
  code?: string;
  message: string;
  hint?: string;
  stack?: string;
}) {
  const code = (ERROR_CODES as readonly string[]).includes(error.code ?? '')
    ? (error.code as ErrorCode)
    : 'UNKNOWN';
  return protocolError(code, error.message, error.hint, error.stack);
}
