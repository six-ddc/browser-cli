/**
 * Command router for background-level commands.
 * These are commands handled directly by the background service worker
 * using browser APIs (not forwarded to content scripts).
 */

import type { RequestMessage, ResponseMessage, Command } from '@browser-cli/shared';
import { ErrorCode } from '@browser-cli/shared';
import { classifyError } from './error-classifier';
import type { NetworkManager } from './network-manager';

export async function handleBackgroundCommand(
  msg: RequestMessage,
  targetTabId: number,
  networkManager: NetworkManager | null = null,
): Promise<ResponseMessage> {
  const { id, command } = msg;

  try {
    const data = await routeCommand(command, targetTabId, networkManager);
    return { id, type: 'response', success: true, data };
  } catch (err) {
    const fallbackCode = getFallbackErrorCode(command.action);
    return {
      id,
      type: 'response',
      success: false,
      error: classifyError(err, fallbackCode),
    };
  }
}

async function routeCommand(
  command: Command,
  targetTabId: number,
  networkManager: NetworkManager | null = null,
): Promise<unknown> {
  switch (command.action) {
    // ─── Navigation ────────────────────────────────────────────
    case 'navigate': {
      const { url } = command.params as { url: string };
      await browser.tabs.update(targetTabId, { url });
      // Wait for navigation to complete
      await waitForTabLoad(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'goBack': {
      await browser.tabs.goBack(targetTabId);
      await waitForTabLoad(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'goForward': {
      await browser.tabs.goForward(targetTabId);
      await waitForTabLoad(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'reload': {
      await browser.tabs.reload(targetTabId);
      await waitForTabLoad(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'getUrl': {
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url };
    }
    case 'getTitle': {
      const tab = await browser.tabs.get(targetTabId);
      return { title: tab.title };
    }

    // ─── Tabs ──────────────────────────────────────────────────
    case 'tabNew': {
      const { url } = command.params as { url?: string };
      const tab = await browser.tabs.create({ url: url || 'about:blank' });
      return { tabId: tab.id, url: tab.url || url || 'about:blank' };
    }
    case 'tabList': {
      const tabs = await browser.tabs.query({});
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
      await browser.tabs.update(tabId, { active: true });
      const tab = await browser.tabs.get(tabId);
      return { tabId: tab.id, url: tab.url, title: tab.title };
    }
    case 'tabClose': {
      const { tabId: closeId } = command.params as { tabId?: number };
      await browser.tabs.remove(closeId ?? targetTabId);
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
        const tab = await browser.tabs.get(targetTabId);
        cookieUrl = tab.url;
      }
      if (!cookieUrl) throw new Error('No URL available for cookies');

      if (name) {
        const cookie = await browser.cookies.get({ url: cookieUrl, name });
        return { cookies: cookie ? [cookieToInfo(cookie)] : [] };
      }

      const cookies = await browser.cookies.getAll(domain ? { domain } : { url: cookieUrl });
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
      await browser.cookies.set(params);
      return { set: true };
    }
    case 'cookiesClear': {
      const { url: clearUrl, domain: clearDomain } = command.params as {
        url?: string;
        domain?: string;
      };
      let targetUrl = clearUrl;
      if (!targetUrl) {
        const tab = await browser.tabs.get(targetTabId);
        targetUrl = tab.url;
      }
      if (!targetUrl) throw new Error('No URL available for clearing cookies');

      const toRemove = await browser.cookies.getAll(
        clearDomain ? { domain: clearDomain } : { url: targetUrl },
      );
      for (const c of toRemove) {
        const protocol = c.secure ? 'https' : 'http';
        await browser.cookies.remove({
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
        const csResponse = await browser.tabs.sendMessage(targetTabId, {
          type: 'browser-cli-command',
          id: `screenshot-prep-${Date.now()}`,
          command: { action: 'scrollIntoView', params: { selector } },
        });
        if (!csResponse.success) {
          throw new Error(csResponse.error?.message || `Element not found: ${selector}`);
        }
        // Get bounding box for crop metadata
        const bboxResponse = await browser.tabs.sendMessage(targetTabId, {
          type: 'browser-cli-command',
          id: `screenshot-bbox-${Date.now()}`,
          command: { action: 'boundingBox', params: { selector } },
        });
        if (bboxResponse.success && bboxResponse.data) {
          cropRect = bboxResponse.data as { x: number; y: number; width: number; height: number };
        }
      }

      const dataUrl = await browser.tabs.captureVisibleTab({
        format: format || 'png',
        quality: quality,
      });
      // Parse data URL: data:image/png;base64,xxxxx
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.split(':')[1].split(';')[0];

      // Get viewport dimensions from the window
      const win = await browser.windows.getCurrent();
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

    // ─── Network ───────────────────────────────────────────────
    case 'route': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const { pattern, action, redirectUrl } = command.params as {
        pattern: string;
        action: 'block' | 'redirect';
        redirectUrl?: string;
      };
      const route = await networkManager.addRoute(pattern, action, redirectUrl);
      return { routeId: route.id, pattern: route.pattern, action: route.action };
    }
    case 'unroute': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const { routeId } = command.params as { routeId: number };
      const removed = await networkManager.removeRoute(routeId);
      if (!removed) throw new Error(`Route ${routeId} not found`);
      return { removed: true };
    }
    case 'getRequests': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const { pattern, tabId, blockedOnly, limit } = command.params as {
        pattern?: string;
        tabId?: number;
        blockedOnly?: boolean;
        limit?: number;
      };
      const result = networkManager.getRequests({ pattern, tabId, blockedOnly, limit });
      return result;
    }
    case 'getRoutes': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const routes = networkManager.getRoutes();
      return { routes };
    }
    case 'clearRequests': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const cleared = networkManager.clearRequests();
      return { cleared };
    }

    // ─── Window Management ─────────────────────────────────────
    case 'windowNew': {
      const { url } = command.params as { url?: string };
      const win = await browser.windows.create({ url: url || 'about:blank' });
      if (!win) throw new Error('Failed to create window');
      const tab = win.tabs?.[0];
      return {
        windowId: win.id,
        tabId: tab?.id,
        url: tab?.url || url || 'about:blank',
      };
    }
    case 'windowList': {
      const windows = await browser.windows.getAll({ populate: true });
      return {
        windows: windows.map((w) => ({
          id: w.id,
          focused: w.focused,
          type: w.type || 'normal',
          tabs: w.tabs?.length || 0,
        })),
      };
    }
    case 'windowClose': {
      const { windowId } = command.params as { windowId?: number };
      if (windowId) {
        await browser.windows.remove(windowId);
      } else {
        const current = await browser.windows.getCurrent();
        if (current.id) await browser.windows.remove(current.id);
      }
      return { closed: true };
    }

    // ─── Browser Config ─────────────────────────────────────────
    case 'setViewport': {
      const { width, height } = command.params as { width: number; height: number };
      const current = await browser.windows.getCurrent();
      if (current.id) {
        await browser.windows.update(current.id, { width, height });
      }
      return { set: true, width, height };
    }
    case 'setHeaders': {
      const { headers } = command.params as { headers: Record<string, string> };
      const rules: Array<{
        id: number;
        priority: number;
        action: { type: string; requestHeaders: Array<{ header: string; operation: string; value: string }> };
        condition: { resourceTypes: string[] };
      }> = [];
      let ruleId = 9000; // Use high IDs to avoid conflicts with network manager
      for (const [header, value] of Object.entries(headers)) {
        rules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [{ header, operation: 'set', value }],
          },
          condition: {
            resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet', 'image', 'font', 'media', 'other'],
          },
        });
      }

      // Remove old header rules first (IDs 9000+)
      const existingRules = await browser.declarativeNetRequest.getDynamicRules();
      const oldIds = existingRules
        .filter((r: { id: number }) => r.id >= 9000)
        .map((r: { id: number }) => r.id);

      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: oldIds,
        addRules: rules as unknown as Browser.declarativeNetRequest.Rule[],
      });

      return { set: true, ruleCount: rules.length };
    }

    default:
      throw new Error(`Unknown background command: ${command.action}`);
  }
}

function getFallbackErrorCode(action: string): ErrorCode {
  if (['navigate', 'goBack', 'goForward', 'reload'].includes(action)) {
    return ErrorCode.NAVIGATION_FAILED;
  }
  if (['tabNew', 'tabList', 'tabSwitch', 'tabClose'].includes(action)) {
    return ErrorCode.TAB_NOT_FOUND;
  }
  if (action === 'screenshot') {
    return ErrorCode.SCREENSHOT_FAILED;
  }
  if (['windowNew', 'windowList', 'windowClose'].includes(action)) {
    return ErrorCode.UNKNOWN;
  }
  return ErrorCode.UNKNOWN;
}

function cookieToInfo(c: Browser.cookies.Cookie) {
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
      browser.tabs.onUpdated.removeListener(listener);
      resolve(); // Resolve anyway, don't block on slow pages
    }, timeoutMs);

    const listener = (
      updatedTabId: number,
      changeInfo: Browser.tabs.OnUpdatedInfo,
    ) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    browser.tabs.onUpdated.addListener(listener);

    // Check if already complete
    browser.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}
