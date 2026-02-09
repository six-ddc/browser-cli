/**
 * Command router for background-level commands.
 * These are commands handled directly by the background service worker
 * using chrome.* APIs (not forwarded to content scripts).
 */

import type { RequestMessage, ResponseMessage, Command } from '@browser-cli/shared';
import { ErrorCode, createError } from '@browser-cli/shared';

export async function handleBackgroundCommand(
  msg: RequestMessage,
  targetTabId: number,
): Promise<ResponseMessage> {
  const { id, command } = msg;

  try {
    const data = await routeCommand(command, targetTabId);
    return { id, type: 'response', success: true, data };
  } catch (err) {
    return {
      id,
      type: 'response',
      success: false,
      error: createError(
        ErrorCode.CONTENT_SCRIPT_ERROR,
        (err as Error).message || 'Unknown error',
      ),
    };
  }
}

async function routeCommand(
  command: Command,
  targetTabId: number,
): Promise<unknown> {
  switch (command.action) {
    // ─── Navigation ────────────────────────────────────────────
    case 'navigate': {
      const { url } = command.params as { url: string };
      await chrome.tabs.update(targetTabId, { url });
      // Wait for navigation to complete
      await waitForTabLoad(targetTabId);
      const tab = await chrome.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'goBack': {
      await chrome.tabs.goBack(targetTabId);
      await waitForTabLoad(targetTabId);
      const tab = await chrome.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'goForward': {
      await chrome.tabs.goForward(targetTabId);
      await waitForTabLoad(targetTabId);
      const tab = await chrome.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'reload': {
      await chrome.tabs.reload(targetTabId);
      await waitForTabLoad(targetTabId);
      const tab = await chrome.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'getUrl': {
      const tab = await chrome.tabs.get(targetTabId);
      return { url: tab.url };
    }
    case 'getTitle': {
      const tab = await chrome.tabs.get(targetTabId);
      return { title: tab.title };
    }

    // ─── Tabs ──────────────────────────────────────────────────
    case 'tabNew': {
      const { url } = command.params as { url?: string };
      const tab = await chrome.tabs.create({ url: url || 'about:blank' });
      return { tabId: tab.id, url: tab.url || url || 'about:blank' };
    }
    case 'tabList': {
      const tabs = await chrome.tabs.query({});
      return {
        tabs: tabs.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          active: t.active,
        })),
      };
    }
    case 'tabSwitch': {
      const { tabId } = command.params as { tabId: number };
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      return { tabId: tab.id, url: tab.url, title: tab.title };
    }
    case 'tabClose': {
      const { tabId: closeId } = command.params as { tabId?: number };
      await chrome.tabs.remove(closeId ?? targetTabId);
      return { closed: true };
    }

    // ─── Cookies ───────────────────────────────────────────────
    case 'cookiesGet': {
      const { name, url, domain } = command.params as {
        name?: string;
        url?: string;
        domain?: string;
      };
      // Need a URL to get cookies
      let cookieUrl = url;
      if (!cookieUrl) {
        const tab = await chrome.tabs.get(targetTabId);
        cookieUrl = tab.url;
      }
      if (!cookieUrl) throw new Error('No URL available for cookies');

      if (name) {
        const cookie = await chrome.cookies.get({ url: cookieUrl, name });
        return { cookies: cookie ? [cookieToInfo(cookie)] : [] };
      }

      const cookies = await chrome.cookies.getAll(domain ? { domain } : { url: cookieUrl });
      return { cookies: cookies.map(cookieToInfo) };
    }
    case 'cookiesSet': {
      const params = command.params as {
        url: string;
        name: string;
        value: string;
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: 'no_restriction' | 'lax' | 'strict';
        expirationDate?: number;
      };
      await chrome.cookies.set(params);
      return { set: true };
    }
    case 'cookiesClear': {
      const { url: clearUrl, domain: clearDomain } = command.params as {
        url?: string;
        domain?: string;
      };
      let targetUrl = clearUrl;
      if (!targetUrl) {
        const tab = await chrome.tabs.get(targetTabId);
        targetUrl = tab.url;
      }
      if (!targetUrl) throw new Error('No URL available for clearing cookies');

      const toRemove = await chrome.cookies.getAll(
        clearDomain ? { domain: clearDomain } : { url: targetUrl },
      );
      for (const c of toRemove) {
        const protocol = c.secure ? 'https' : 'http';
        await chrome.cookies.remove({
          url: `${protocol}://${c.domain}${c.path}`,
          name: c.name,
        });
      }
      return { cleared: toRemove.length };
    }

    // ─── Screenshot ────────────────────────────────────────────
    case 'screenshot': {
      const { selector, format, quality } = command.params as {
        selector?: string;
        format?: 'png' | 'jpeg';
        quality?: number;
      };

      // If selector is provided, scroll element into view first via content script
      let cropRect: { x: number; y: number; width: number; height: number } | null = null;
      if (selector) {
        const csResponse = await chrome.tabs.sendMessage(targetTabId, {
          type: 'browser-cli-command',
          id: `screenshot-prep-${Date.now()}`,
          command: { action: 'scrollIntoView', params: { selector } },
        });
        if (!csResponse.success) {
          throw new Error(csResponse.error?.message || `Element not found: ${selector}`);
        }
        // Get bounding box for crop metadata
        const bboxResponse = await chrome.tabs.sendMessage(targetTabId, {
          type: 'browser-cli-command',
          id: `screenshot-bbox-${Date.now()}`,
          command: { action: 'boundingBox', params: { selector } },
        });
        if (bboxResponse.success && bboxResponse.data) {
          cropRect = bboxResponse.data as { x: number; y: number; width: number; height: number };
        }
      }

      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: format || 'png',
        quality: quality,
      });
      // Parse data URL: data:image/png;base64,xxxxx
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.split(':')[1].split(';')[0];

      // Get viewport dimensions from the window
      const win = await chrome.windows.getCurrent();
      const viewportWidth = win.width ?? 0;
      const viewportHeight = win.height ?? 0;

      return {
        data: base64Data,
        mimeType,
        width: viewportWidth,
        height: viewportHeight,
        ...(cropRect ? { cropRect } : {}),
      };
    }

    default:
      throw new Error(`Unknown background command: ${command.action}`);
  }
}

function cookieToInfo(c: chrome.cookies.Cookie) {
  return {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expirationDate: c.expirationDate,
  };
}

function waitForTabLoad(tabId: number, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // Resolve anyway, don't block on slow pages
    }, timeoutMs);

    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Check if already complete
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}
