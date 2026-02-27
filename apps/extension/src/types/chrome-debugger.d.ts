/**
 * Type declarations for chrome.debugger API.
 * Used by the --debugger flag for trusted input events via CDP.
 *
 * `debugger` is a reserved keyword, so we define the shapes as standalone
 * interfaces. The debugger-input.ts module accesses the API via bracket
 * notation: (chrome as any)['debugger'].
 *
 * @see https://developer.chrome.com/docs/extensions/reference/api/debugger
 */

interface ChromeDebuggerDebuggee {
  tabId?: number;
  extensionId?: string;
  targetId?: string;
}

interface ChromeDebuggerAPI {
  attach(target: ChromeDebuggerDebuggee, requiredVersion: string, callback?: () => void): void;
  detach(target: ChromeDebuggerDebuggee, callback?: () => void): void;
  sendCommand(
    target: ChromeDebuggerDebuggee,
    method: string,
    commandParams?: Record<string, unknown>,
    callback?: (result: unknown) => void,
  ): void;
}

// Extend the chrome namespace with runtime.lastError (used by chrome.debugger callbacks)
declare namespace chrome {
  namespace runtime {
    const lastError: { message?: string } | undefined;
  }
}
