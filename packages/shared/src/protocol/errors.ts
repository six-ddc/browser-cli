/** Error codes returned in ResponseMessage when success=false */
export enum ErrorCode {
  // General
  UNKNOWN = 'UNKNOWN',
  TIMEOUT = 'TIMEOUT',
  INVALID_PARAMS = 'INVALID_PARAMS',
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',

  // Connection
  EXTENSION_NOT_CONNECTED = 'EXTENSION_NOT_CONNECTED',
  DAEMON_NOT_RUNNING = 'DAEMON_NOT_RUNNING',
  CONNECTION_LOST = 'CONNECTION_LOST',

  // Element
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  ELEMENT_NOT_VISIBLE = 'ELEMENT_NOT_VISIBLE',
  ELEMENT_NOT_INTERACTABLE = 'ELEMENT_NOT_INTERACTABLE',
  MULTIPLE_ELEMENTS_FOUND = 'MULTIPLE_ELEMENTS_FOUND',

  // Ref
  INVALID_REF = 'INVALID_REF',
  REF_NOT_FOUND = 'REF_NOT_FOUND',
  STALE_REF = 'STALE_REF',

  // Navigation
  NAVIGATION_FAILED = 'NAVIGATION_FAILED',
  INVALID_URL = 'INVALID_URL',

  // Tab
  TAB_NOT_FOUND = 'TAB_NOT_FOUND',
  TAB_CLOSED = 'TAB_CLOSED',
  NO_ACTIVE_TAB = 'NO_ACTIVE_TAB',

  // Execution
  EVAL_ERROR = 'EVAL_ERROR',
  SCRIPT_ERROR = 'SCRIPT_ERROR',

  // Screenshot
  SCREENSHOT_FAILED = 'SCREENSHOT_FAILED',

  // Content script
  CONTENT_SCRIPT_ERROR = 'CONTENT_SCRIPT_ERROR',
  CONTENT_SCRIPT_NOT_READY = 'CONTENT_SCRIPT_NOT_READY',

  // Frame
  FRAME_ERROR = 'FRAME_ERROR',
  FRAME_NOT_FOUND = 'FRAME_NOT_FOUND',
}

export interface ProtocolError {
  code: ErrorCode;
  message: string;
  hint?: string;
  details?: unknown;
}

export function createError(
  code: ErrorCode,
  message: string,
  hint?: string,
  details?: unknown,
): ProtocolError {
  return {
    code,
    message,
    ...(hint !== undefined ? { hint } : {}),
    ...(details !== undefined ? { details } : {}),
  };
}

/** Type guard: is `err` already a structured ProtocolError (plain object, not Error instance)? */
export function isProtocolError(err: unknown): err is ProtocolError {
  return (
    err !== null &&
    typeof err === 'object' &&
    !(err instanceof Error) &&
    'code' in err &&
    'message' in err &&
    typeof (err as ProtocolError).code === 'string' &&
    typeof (err as ProtocolError).message === 'string'
  );
}
