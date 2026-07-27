/**
 * Downloads: list and wait-for-completion for browser downloads.
 * Uses the `downloads` permission (Chrome and Firefox both support it).
 */

import { BrowserCliError } from '@browser-cli/shared';
import type {
  DownloadInfo,
  DownloadListParams,
  DownloadListResult,
  DownloadWaitParams,
  DownloadWaitResult,
} from '@browser-cli/shared';

const DEFAULT_WAIT_TIMEOUT_MS = 30000;

/** How far back a finished download still counts as "the one we just triggered". */
const RECENT_DOWNLOAD_WINDOW_MS = 10000;

function toDownloadInfo(item: Browser.downloads.DownloadItem): DownloadInfo {
  return {
    id: item.id,
    url: item.url,
    filename: item.filename,
    state: item.state,
    fileSize: item.fileSize,
    bytesReceived: item.bytesReceived,
    mime: item.mime,
    startTime: item.startTime,
    error: item.error,
    paused: item.paused,
  };
}

/** List recent downloads, most recent first. */
export async function listDownloads(params: DownloadListParams): Promise<DownloadListResult> {
  const query: Browser.downloads.DownloadQuery = { orderBy: ['-startTime'] };
  if (params.limit != null) query.limit = params.limit;
  if (params.state) query.state = params.state;

  const items = await browser.downloads.search(query);
  return { downloads: items.map(toDownloadInfo) };
}

/** Wait for a new download to be created (browser.downloads.onCreated), rejecting on timeout. */
function waitForNewDownload(deadline: number): Promise<Browser.downloads.DownloadItem> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(
      () => {
        if (settled) return;
        settled = true;
        browser.downloads.onCreated.removeListener(onCreated);
        reject(
          new BrowserCliError(
            'TIMEOUT',
            'Timed out waiting for a new download to start.',
            'Trigger the download (e.g. click a download link) before running "download wait", or pass --id to wait on a specific download.',
          ),
        );
      },
      Math.max(0, deadline - Date.now()),
    );

    const onCreated = (item: Browser.downloads.DownloadItem) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      browser.downloads.onCreated.removeListener(onCreated);
      resolve(item);
    };

    browser.downloads.onCreated.addListener(onCreated);
  });
}

/** Wait until a download reaches a terminal state (complete/interrupted), rejecting on timeout. */
async function waitForCompletion(
  id: number,
  deadline: number,
): Promise<Browser.downloads.DownloadItem> {
  const found = await browser.downloads.search({ id });
  if (found.length > 0 && (found[0].state === 'complete' || found[0].state === 'interrupted')) {
    return found[0];
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(
      () => {
        if (settled) return;
        settled = true;
        browser.downloads.onChanged.removeListener(onChanged);
        reject(
          new BrowserCliError(
            'TIMEOUT',
            `Timed out waiting for download ${id} to finish.`,
            'Increase --timeout, or check the browser is not blocked on a save-as dialog.',
          ),
        );
      },
      Math.max(0, deadline - Date.now()),
    );

    const onChanged = (delta: Browser.downloads.DownloadDelta) => {
      if (delta.id !== id) return;
      const newState = delta.state?.current;
      if (newState === 'complete' || newState === 'interrupted') {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        browser.downloads.onChanged.removeListener(onChanged);
        browser.downloads
          .search({ id })
          .then((items) => {
            if (items.length > 0) resolve(items[0]);
            else
              reject(
                new BrowserCliError(
                  'UNSUPPORTED',
                  `Download ${id} disappeared before it could be read back.`,
                  'Run "download list" to see current downloads.',
                ),
              );
          })
          .catch((err: unknown) => reject(err as Error));
      }
    };

    browser.downloads.onChanged.addListener(onChanged);
  });
}

/**
 * Wait for a download to finish. If `id` is omitted, resolves the target as:
 * the most recent download if it is still running or finished within
 * RECENT_DOWNLOAD_WINDOW_MS, otherwise the next download to start.
 *
 * The lookback matters: a small file often reaches `complete` before the CLI's
 * next command reaches the extension, so waiting only on in-progress or future
 * downloads would time out on exactly the common case.
 */
export async function waitForDownload(params: DownloadWaitParams): Promise<DownloadWaitResult> {
  const timeout = params.timeout ?? DEFAULT_WAIT_TIMEOUT_MS;
  const deadline = Date.now() + timeout;

  let targetId = params.id;

  if (targetId == null) {
    const [latest] = await browser.downloads.search({ orderBy: ['-startTime'], limit: 1 });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- search() may return an empty array
    if (latest) {
      if (latest.state === 'in_progress') {
        targetId = latest.id;
      } else if (startedWithin(latest, RECENT_DOWNLOAD_WINDOW_MS)) {
        return { download: toDownloadInfo(latest) };
      }
    }
    if (targetId == null) {
      const created = await waitForNewDownload(deadline);
      targetId = created.id;
    }
  }

  const item = await waitForCompletion(targetId, deadline);
  return { download: toDownloadInfo(item) };
}

/** True when the download started less than `windowMs` ago. */
function startedWithin(item: Browser.downloads.DownloadItem, windowMs: number): boolean {
  const started = Date.parse(item.startTime);
  if (Number.isNaN(started)) return false;
  return Date.now() - started < windowMs;
}
