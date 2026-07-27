/**
 * RequestLog: per-tab ring buffer of network requests observed via webRequest.
 *
 * Independent from NetworkManager (which handles route blocking/redirecting) —
 * this module only observes and records metadata (method/url/status/type/timing/
 * error). Request/response bodies are never captured here; use `network watch`
 * (CDP) for body capture.
 *
 * Registers its own onBeforeRequest/onCompleted/onErrorOccurred listeners so it
 * never interferes with NetworkManager's Firefox blocking-mode toggling.
 */

import { BrowserCliError } from '@browser-cli/shared';
import type {
  NetworkRequestDetail,
  NetworkRequestResult,
  NetworkRequestsParams,
  NetworkRequestsResult,
  NetworkRequestSummary,
} from '@browser-cli/shared';

/** Max recorded requests kept per tab (oldest evicted first). */
const MAX_PER_TAB = 500;
/** Default number of requests returned by `getRequests` when no limit is given. */
const DEFAULT_LIMIT = 50;

interface RequestEntry {
  id: string;
  method: string;
  url: string;
  status?: number;
  statusLine?: string;
  type: string;
  tabId: number;
  frameId?: number;
  initiator?: string;
  timestamp: number;
  duration?: number;
  fromCache?: boolean;
  ip?: string;
  error?: string;
}

/** tabId -> ring buffer of entries, oldest first */
const tabBuffers = new Map<number, RequestEntry[]>();
/** requestId -> entry, for O(1) lookup by id across all tabs */
const allEntries = new Map<string, RequestEntry>();

let registered = false;

function addEntry(tabId: number, entry: RequestEntry): void {
  allEntries.set(entry.id, entry);
  let buf = tabBuffers.get(tabId);
  if (!buf) {
    buf = [];
    tabBuffers.set(tabId, buf);
  }
  buf.push(entry);
  if (buf.length > MAX_PER_TAB) {
    const removed = buf.shift();
    if (removed) allEntries.delete(removed.id);
  }
}

function toSummary(e: RequestEntry): NetworkRequestSummary {
  return {
    id: e.id,
    method: e.method,
    url: e.url,
    status: e.status,
    type: e.type,
    tabId: e.tabId,
    timestamp: e.timestamp,
    duration: e.duration,
    fromCache: e.fromCache,
    error: e.error,
  };
}

function toDetail(e: RequestEntry): NetworkRequestDetail {
  return {
    ...toSummary(e),
    statusLine: e.statusLine,
    ip: e.ip,
    frameId: e.frameId,
    initiator: e.initiator,
  };
}

/** Register the webRequest listeners once (idempotent). Call from background init. */
export function initRequestLog(): void {
  if (registered) return;
  registered = true;

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return undefined;
      addEntry(details.tabId, {
        id: details.requestId,
        method: details.method,
        url: details.url,
        type: details.type,
        tabId: details.tabId,
        frameId: details.frameId,
        initiator: details.initiator,
        timestamp: details.timeStamp,
      });
      return undefined;
    },
    { urls: ['<all_urls>'] },
  );

  browser.webRequest.onCompleted.addListener(
    (details) => {
      const entry = allEntries.get(details.requestId);
      if (!entry) return;
      entry.status = details.statusCode;
      entry.statusLine = details.statusLine;
      entry.ip = details.ip;
      entry.fromCache = details.fromCache;
      entry.duration = Math.round(details.timeStamp - entry.timestamp);
    },
    { urls: ['<all_urls>'] },
  );

  browser.webRequest.onErrorOccurred.addListener(
    (details) => {
      const entry = allEntries.get(details.requestId);
      if (!entry) return;
      entry.error = details.error;
      entry.duration = Math.round(details.timeStamp - entry.timestamp);
    },
    { urls: ['<all_urls>'] },
  );
}

/** Drop all recorded requests for a tab (call when the tab closes). */
export function clearTabRequests(tabId: number): void {
  const buf = tabBuffers.get(tabId);
  if (!buf) return;
  for (const e of buf) allEntries.delete(e.id);
  tabBuffers.delete(tabId);
}

/** Query recorded requests for a tab (or all tabs), newest-first limit applied. */
export function getRequests(params: NetworkRequestsParams, tabId: number): NetworkRequestsResult {
  const { filter, limit = DEFAULT_LIMIT, all, clear } = params;

  if (clear) {
    let cleared = 0;
    if (all) {
      for (const buf of tabBuffers.values()) cleared += buf.length;
      tabBuffers.clear();
      allEntries.clear();
    } else {
      const buf = tabBuffers.get(tabId);
      cleared = buf?.length ?? 0;
      clearTabRequests(tabId);
    }
    return { requests: [], total: 0, cleared };
  }

  let entries: RequestEntry[];
  if (all) {
    entries = [];
    for (const buf of tabBuffers.values()) entries.push(...buf);
    entries.sort((a, b) => a.timestamp - b.timestamp);
  } else {
    entries = tabBuffers.get(tabId) ?? [];
  }

  if (filter) {
    const needle = filter.toLowerCase();
    entries = entries.filter((e) => e.url.toLowerCase().includes(needle));
  }

  const total = entries.length;
  const sliced = entries.slice(-limit);

  return { requests: sliced.map(toSummary), total };
}

/** Look up a single recorded request by its id across all tabs. */
export function getRequest(id: string): NetworkRequestResult {
  const entry = allEntries.get(id);
  if (!entry) {
    throw new BrowserCliError(
      'INVALID_ARGS',
      `No recorded request with id "${id}".`,
      'Run "network requests" first to list recorded request ids.',
    );
  }
  return { request: toDetail(entry) };
}
