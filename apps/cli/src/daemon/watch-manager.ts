/**
 * WatchManager — manages network watch lifecycle on the daemon side.
 * Receives structured events from the extension, formats them as HTTP-readable text,
 * and writes to output files.
 */

import {
  mkdirSync,
  openSync,
  writeSync,
  closeSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import type { EventMessage, RequestMessage } from '@browser-cli/shared';
import type { WsServer } from './ws-server.js';
import { logger } from '../util/logger.js';
import { getAppDir } from '../util/paths.js';

interface NetworkRecord {
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

interface CapturedRequest {
  method: string;
  url: string;
}

interface WatchEntry {
  watchId: string;
  tabId: number;
  pattern: string;
  filePath: string;
  fd: number;
  startedAt: number;
  requestCount: number;
  timeout: number;
  timer: ReturnType<typeof setTimeout>;
  unsubscribe: () => void;
  /** Captured request URLs for structured return in networkUnwatch */
  capturedRequests: CapturedRequest[];
}

function getWatchesDir(): string {
  const dir = join(getAppDir(), 'watches');
  mkdirSync(dir, { recursive: true });
  return dir;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Remove watch files older than 7 days. Best-effort, errors are silently ignored. */
function pruneOldWatchFiles(dir: string): void {
  try {
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    for (const name of readdirSync(dir)) {
      try {
        const filePath = join(dir, name);
        if (statSync(filePath).mtimeMs < cutoff) {
          unlinkSync(filePath);
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
}

function formatSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function tryPrettyJson(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

function formatRequestResponse(record: NetworkRecord): string {
  const lines: string[] = [];
  const sep = '\u2500'.repeat(40);
  lines.push(sep);
  lines.push('');

  // Request line
  const duration = record.duration != null ? `, ${record.duration}ms` : '';
  lines.push(`>>> ${record.method} ${record.url}  [${record.resourceType}${duration}]`);

  if (record.requestHeaders) {
    for (const [k, v] of Object.entries(record.requestHeaders)) {
      lines.push(`${k}: ${v}`);
    }
  }
  if (record.postData) {
    lines.push('');
    lines.push(tryPrettyJson(record.postData));
  }
  lines.push('');

  // Response line
  if (record.error) {
    lines.push(`<<< ERROR: ${record.error}  (${record.duration ?? 0}ms)`);
  } else if (record.status != null) {
    const size = formatSize(record.size);
    const statusText = record.statusText ? ` ${record.statusText}` : '';
    lines.push(`<<< ${record.status}${statusText}  (${size})`);
    if (record.responseHeaders) {
      for (const [k, v] of Object.entries(record.responseHeaders)) {
        lines.push(`${k}: ${v}`);
      }
    }
    if (record.body !== undefined || record.isBinary) {
      lines.push('');
      if (record.isBinary) {
        lines.push(`[binary: ${record.mimeType ?? 'unknown'}, ${formatSize(record.size)}]`);
      } else if (record.bodyTruncated && record.body) {
        lines.push(`[truncated, showing first 100KB of ${formatSize(record.size)}]`);
        lines.push(tryPrettyJson(record.body));
      } else if (record.body) {
        lines.push(tryPrettyJson(record.body));
      }
    }
  }
  lines.push('');

  return lines.join('\n');
}

export class WatchManager {
  private watches = new Map<string, WatchEntry>();
  private wsServer: WsServer;

  constructor(wsServer: WsServer) {
    this.wsServer = wsServer;
  }

  async startWatch(
    tabId: number,
    params: { pattern?: string; timeout?: number; body?: boolean; method?: string },
    sendToExtension: (msg: RequestMessage) => Promise<unknown>,
  ): Promise<{
    watchId: string;
    tabId: number;
    pattern: string;
    timeout: number;
    filePath: string;
  }> {
    const watchId = `watch-${Date.now()}`;
    const timeout = params.timeout ?? 30000;
    const pattern = params.pattern ?? '*';

    // Prune old watch files (>7 days) before creating new one
    const watchesDir = getWatchesDir();
    pruneOldWatchFiles(watchesDir);
    const filePath = join(watchesDir, `${watchId}.txt`);
    const fd = openSync(filePath, 'w');

    // Send networkWatch to extension — it resolves the real tabId
    const requestId = `watch-start-${Date.now()}`;
    let resolvedTabId = tabId;
    try {
      const extResult = await sendToExtension({
        id: requestId,
        type: 'request',
        command: {
          action: 'networkWatch',
          params: {
            pattern: params.pattern,
            body: params.body,
            method: params.method,
          },
        },
        tabId,
      });
      // Extension returns { watchId, tabId } with the real resolved tabId
      const extData = extResult as { watchId?: string; tabId?: number } | undefined;
      if (extData?.tabId) {
        resolvedTabId = extData.tabId;
      }
    } catch (err) {
      closeSync(fd);
      throw err;
    }

    // Write file header with the resolved tab ID
    const header = [
      `# Watch started: ${new Date().toISOString()}`,
      `# Pattern: ${pattern}`,
      `# Tab: ${resolvedTabId}`,
      '',
    ].join('\n');
    writeSync(fd, header);

    // Subscribe to events — use resolvedTabId from extension
    const unsubscribe = this.wsServer.addEventListener((msg: EventMessage) => {
      if (msg.event !== 'networkWatch') return;
      if (msg.tabId !== resolvedTabId) return;

      const entry = this.watches.get(watchId);
      if (!entry) return;

      const record = msg.data as NetworkRecord;
      const formatted = formatRequestResponse(record);
      try {
        writeSync(entry.fd, formatted);
      } catch {
        // File may have been closed
      }
      entry.requestCount++;
      entry.capturedRequests.push({ method: record.method, url: record.url });
    });

    // Start timeout timer
    const timer = setTimeout(() => {
      void this.stopWatch(resolvedTabId, sendToExtension);
    }, timeout);

    this.watches.set(watchId, {
      watchId,
      tabId: resolvedTabId,
      pattern,
      filePath,
      fd,
      startedAt: Date.now(),
      requestCount: 0,
      timeout,
      timer,
      unsubscribe,
      capturedRequests: [],
    });

    logger.info(
      `Watch ${watchId} started for tab ${resolvedTabId} (pattern=${pattern}, timeout=${timeout}ms)`,
    );

    return { watchId, tabId: resolvedTabId, pattern, timeout, filePath };
  }

  async stopWatch(
    tabId: number | undefined,
    sendToExtension: (msg: RequestMessage) => Promise<unknown>,
  ): Promise<{
    watchId: string;
    requestCount: number;
    duration: number;
    filePath: string;
    requests: CapturedRequest[];
  }> {
    // Find the watch entry by tabId, or stop the first active watch
    let entry: WatchEntry | undefined;
    if (tabId) {
      for (const w of this.watches.values()) {
        if (w.tabId === tabId) {
          entry = w;
          break;
        }
      }
    } else {
      // No tab specified — stop the first (most recent) watch
      const firstKey = this.watches.keys().next();
      if (!firstKey.done) {
        entry = this.watches.get(firstKey.value);
      }
    }

    if (!entry) {
      throw new Error('No active network watch found. Use "network watch" to start one first.');
    }

    const {
      watchId,
      tabId: entryTabId,
      filePath,
      fd,
      startedAt,
      requestCount,
      timer,
      unsubscribe,
      capturedRequests,
    } = entry;

    // Clean up
    clearTimeout(timer);
    unsubscribe();
    this.watches.delete(watchId);

    const duration = Math.round((Date.now() - startedAt) / 1000);

    // Write file footer
    const footer = [
      '',
      `# Watch ended: ${new Date().toISOString()}`,
      `# Duration: ${duration}s | Requests: ${requestCount}`,
      '',
    ].join('\n');
    try {
      writeSync(fd, footer);
      closeSync(fd);
    } catch {
      // File may already be closed
    }

    // Send networkUnwatch to extension
    try {
      const requestId = `watch-stop-${Date.now()}`;
      await sendToExtension({
        id: requestId,
        type: 'request',
        command: {
          action: 'networkUnwatch',
          params: {},
        },
        tabId: entryTabId,
      });
    } catch {
      // Extension may have disconnected
    }

    logger.info(`Watch ${watchId} stopped (${requestCount} requests in ${duration}s)`);

    return { watchId, requestCount, duration, filePath, requests: capturedRequests };
  }

  /** Stop all watches (used during shutdown) */
  async stopAll(sendToExtension: (msg: RequestMessage) => Promise<unknown>): Promise<void> {
    const entries = Array.from(this.watches.values());
    for (const entry of entries) {
      try {
        await this.stopWatch(entry.tabId, sendToExtension);
      } catch {
        // Best effort
      }
    }
  }

  /** Check if there's an active watch */
  get hasActiveWatch(): boolean {
    return this.watches.size > 0;
  }
}
