/**
 * CDP Network domain watcher for capturing request/response details.
 * Uses chrome.debugger to attach to tabs and listen for Network events.
 * Sends captured records as events to the daemon via WsClient.
 */

/** Record sent to daemon for each completed request/response pair */
export interface NetworkRecord {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  postData?: string;
  body?: string;
  isBinary?: boolean;
  bodyTruncated?: boolean;
  mimeType?: string;
  size?: number;
  duration?: number;
  error?: string;
}

interface PendingRequest {
  requestId: string;
  url: string;
  method: string;
  resourceType: string;
  requestHeaders?: Record<string, string>;
  postData?: string;
  startTime: number;
  /** Response data, filled by responseReceived */
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, string>;
  mimeType?: string;
  encodedDataLength?: number;
}

interface WatchState {
  tabId: number;
  pattern?: string;
  captureBody: boolean;
  method?: string;
  pendingRequests: Map<string, PendingRequest>;
}

/** Maps tabId -> WatchState for active watches */
const watches = new Map<number, WatchState>();

/** Global CDP event listener (registered once) */
let listenerRegistered = false;

const BINARY_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'font/'];
const BINARY_MIME_EXACT = ['application/octet-stream', 'application/wasm'];
const MAX_BODY_SIZE = 100 * 1024; // 100KB

/** Callback to send events to daemon */
let sendEventFn: ((event: string, data: unknown, tabId?: number) => void) | null = null;

/** Set the sendEvent callback (called from background.ts during init) */
export function setNetworkWatcherSendEvent(
  fn: (event: string, data: unknown, tabId?: number) => void,
): void {
  sendEventFn = fn;
}

function getChromeDebugger(): ChromeDebuggerAPI | undefined {
  if (typeof chrome === 'undefined') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  return (chrome as any)['debugger'] as ChromeDebuggerAPI | undefined;
}

function getChromeLastError(): { message?: string } | undefined {
  if (typeof chrome === 'undefined') return undefined;
  return chrome.runtime.lastError;
}

function cdpSend(
  target: ChromeDebuggerDebuggee,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const dbg = getChromeDebugger();
    if (!dbg) {
      reject(new Error('chrome.debugger API not available'));
      return;
    }
    dbg.sendCommand(target, method, params, (result: unknown) => {
      const lastError = getChromeLastError();
      if (lastError) {
        reject(new Error(lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

function matchesPattern(url: string, pattern?: string): boolean {
  if (!pattern) return true;
  // Simple glob matching: * matches anything
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
  );
  return regex.test(url);
}

function isBinaryMime(mimeType?: string): boolean {
  if (!mimeType) return false;
  if (BINARY_MIME_EXACT.includes(mimeType)) return true;
  return BINARY_MIME_PREFIXES.some((p) => mimeType.startsWith(p));
}

function ensureGlobalListener(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;

  const dbg = getChromeDebugger();
  if (!dbg) return;

  // Use the onEvent listener from chrome.debugger
  const onEvent = (
    (chrome as Record<string, unknown>)['debugger'] as {
      onEvent: {
        addListener: (
          fn: (
            source: ChromeDebuggerDebuggee,
            method: string,
            params?: Record<string, unknown>,
          ) => void,
        ) => void;
      };
    }
  ).onEvent;

  onEvent.addListener(
    (source: ChromeDebuggerDebuggee, method: string, params?: Record<string, unknown>) => {
      if (!source.tabId) return;
      const watch = watches.get(source.tabId);
      if (!watch) return;

      handleCdpEvent(watch, method, params);
    },
  );

  // Listen for debugger detach (e.g. user closes devtools)
  const onDetach = (
    (chrome as Record<string, unknown>)['debugger'] as {
      onDetach: {
        addListener: (fn: (source: ChromeDebuggerDebuggee, reason: string) => void) => void;
      };
    }
  ).onDetach;

  onDetach.addListener((source: ChromeDebuggerDebuggee, reason: string) => {
    if (!source.tabId) return;
    const watch = watches.get(source.tabId);
    if (watch) {
      console.log(`[browser-cli] Network watcher detached from tab ${source.tabId}: ${reason}`);
      watches.delete(source.tabId);
    }
  });
}

function handleCdpEvent(watch: WatchState, method: string, params?: Record<string, unknown>): void {
  switch (method) {
    case 'Network.requestWillBeSent': {
      const requestId = params?.requestId as string;
      const request = params?.request as
        | { url: string; method: string; headers?: Record<string, string>; postData?: string }
        | undefined;
      const resourceType = (params?.type as string) || 'Other';

      if (!request) return;

      // Filter by pattern
      if (!matchesPattern(request.url, watch.pattern)) return;
      // Filter by method
      if (watch.method && request.method.toUpperCase() !== watch.method.toUpperCase()) return;

      const timestamp = (params?.timestamp as number | undefined) ?? Date.now() / 1000;
      watch.pendingRequests.set(requestId, {
        requestId,
        url: request.url,
        method: request.method,
        resourceType,
        requestHeaders: request.headers,
        postData: request.postData,
        startTime: timestamp,
      });
      break;
    }

    case 'Network.responseReceived': {
      const requestId = params?.requestId as string;
      const pending = watch.pendingRequests.get(requestId);
      if (!pending) return;

      const response = params?.response as
        | {
            status: number;
            statusText: string;
            headers?: Record<string, string>;
            mimeType?: string;
            encodedDataLength?: number;
          }
        | undefined;
      if (response) {
        pending.status = response.status;
        pending.statusText = response.statusText;
        pending.responseHeaders = response.headers;
        pending.mimeType = response.mimeType;
        pending.encodedDataLength = response.encodedDataLength;
      }
      break;
    }

    case 'Network.loadingFinished': {
      const requestId = params?.requestId as string;
      const pending = watch.pendingRequests.get(requestId);
      if (!pending) return;
      watch.pendingRequests.delete(requestId);

      const endTime = (params?.timestamp as number | undefined) ?? Date.now() / 1000;
      const duration = Math.round((endTime - pending.startTime) * 1000);
      const rawLength = params?.encodedDataLength as number | undefined;
      const encodedLength = rawLength ?? pending.encodedDataLength ?? 0;

      // Build record and optionally fetch body
      const buildAndSend = async () => {
        const record: NetworkRecord = {
          url: pending.url,
          method: pending.method,
          resourceType: pending.resourceType,
          status: pending.status,
          statusText: pending.statusText,
          requestHeaders: pending.requestHeaders,
          responseHeaders: pending.responseHeaders,
          postData: pending.postData,
          mimeType: pending.mimeType,
          size: encodedLength,
          duration,
        };

        if (watch.captureBody && pending.status != null) {
          const binary = isBinaryMime(pending.mimeType);
          record.isBinary = binary;

          if (!binary) {
            try {
              const target: ChromeDebuggerDebuggee = { tabId: watch.tabId };
              const bodyResult = (await cdpSend(target, 'Network.getResponseBody', {
                requestId: pending.requestId,
              })) as { body: string; base64Encoded: boolean };

              if (bodyResult.base64Encoded) {
                record.isBinary = true;
              } else {
                if (bodyResult.body.length > MAX_BODY_SIZE) {
                  record.body = bodyResult.body.slice(0, MAX_BODY_SIZE);
                  record.bodyTruncated = true;
                } else {
                  record.body = bodyResult.body;
                }
              }
            } catch {
              // Body may not be available (e.g. streaming, redirects)
            }
          }
        }

        sendEventFn?.('networkWatch', record, watch.tabId);
      };

      void buildAndSend();
      break;
    }

    case 'Network.loadingFailed': {
      const requestId = params?.requestId as string;
      const pending = watch.pendingRequests.get(requestId);
      if (!pending) return;
      watch.pendingRequests.delete(requestId);

      const endTime = (params?.timestamp as number | undefined) ?? Date.now() / 1000;
      const duration = Math.round((endTime - pending.startTime) * 1000);
      const errorText = (params?.errorText as string) || 'Unknown error';

      const record: NetworkRecord = {
        url: pending.url,
        method: pending.method,
        resourceType: pending.resourceType,
        requestHeaders: pending.requestHeaders,
        postData: pending.postData,
        duration,
        error: errorText,
      };

      sendEventFn?.('networkWatch', record, watch.tabId);
      break;
    }
  }
}

/** Check if a tab is being watched (used by debugger-input.ts to avoid attach/detach conflicts) */
export function isWatchingTab(tabId: number): boolean {
  return watches.has(tabId);
}

/** Start watching network on a tab */
export async function startWatch(
  tabId: number,
  params: { pattern?: string; captureBody?: boolean; method?: string },
): Promise<{ watchId: string; tabId: number }> {
  const dbg = getChromeDebugger();
  if (!dbg) throw new Error('chrome.debugger API not available (Firefox does not support this)');

  if (watches.has(tabId)) {
    throw new Error(
      `Tab ${tabId} is already being watched. Use "network unwatch" to stop the current watch first.`,
    );
  }

  ensureGlobalListener();

  const target: ChromeDebuggerDebuggee = { tabId };

  // Attach debugger
  await new Promise<void>((resolve, reject) => {
    dbg.attach(target, '1.3', () => {
      const lastError = getChromeLastError();
      if (lastError) {
        reject(new Error(lastError.message));
      } else {
        resolve();
      }
    });
  });

  // Enable Network domain
  await cdpSend(target, 'Network.enable', {});

  const watchId = `watch-${Date.now()}`;

  watches.set(tabId, {
    tabId,
    pattern: params.pattern,
    captureBody: params.captureBody ?? false,
    method: params.method,
    pendingRequests: new Map(),
  });

  return { watchId, tabId };
}

/** Stop watching network on a tab */
export async function stopWatch(tabId: number): Promise<void> {
  const watch = watches.get(tabId);
  if (!watch) return;

  watches.delete(tabId);

  const dbg = getChromeDebugger();
  if (!dbg) return;

  const target: ChromeDebuggerDebuggee = { tabId };

  try {
    await cdpSend(target, 'Network.disable', {});
  } catch {
    // Tab may have been closed
  }

  try {
    await new Promise<void>((resolve) => {
      dbg.detach(target, () => {
        getChromeLastError(); // Consume any error
        resolve();
      });
    });
  } catch {
    // Already detached
  }
}

/** Get the tabId of an active watch (if any), for unwatch without explicit ID */
export function getActiveWatchTabId(): number | undefined {
  const firstEntry = watches.entries().next();
  if (firstEntry.done) return undefined;
  return firstEntry.value[0];
}
