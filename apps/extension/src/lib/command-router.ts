/**
 * Command router for background-level commands.
 * These are commands handled directly by the background service worker
 * using browser APIs (not forwarded to content scripts).
 */

import type { RequestMessage, ResponseMessage, Command } from '@browser-cli/shared';
import { ErrorCode, createError } from '@browser-cli/shared';
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
      // Block dangerous URL schemes
      const scheme = url.split(':')[0].toLowerCase();
      if (['javascript', 'data', 'vbscript'].includes(scheme)) {
        throw createError(
          ErrorCode.INVALID_URL,
          `Blocked navigation to "${scheme}:" URL — this scheme is not allowed for security reasons`,
          'Use http: or https: URLs instead',
        );
      }
      await browser.tabs.update(targetTabId, { url });
      // Wait for navigation to complete
      await waitForTabLoad(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title };
    }
    case 'goBack': {
      const beforeBack = await browser.tabs.get(targetTabId);
      await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        world: 'MAIN',
        func: () => history.back(),
      });
      await waitForUrlChange(targetTabId, beforeBack.url || '');
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url };
    }
    case 'goForward': {
      const beforeFwd = await browser.tabs.get(targetTabId);
      await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        world: 'MAIN',
        func: () => history.forward(),
      });
      await waitForUrlChange(targetTabId, beforeFwd.url || '');
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url };
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

      // If we have a cropRect, crop the image using OffscreenCanvas
      if (cropRect) {
        const dpr = await getDevicePixelRatio(targetTabId);
        const cropped = await cropImage(dataUrl, cropRect, dpr, format || 'png', quality);
        const [croppedHeader, croppedBase64] = cropped.split(',');
        const croppedMime = croppedHeader.split(':')[1].split(';')[0];
        return {
          data: croppedBase64,
          mimeType: croppedMime,
          width: Math.round(cropRect.width),
          height: Math.round(cropRect.height),
        };
      }

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
      };
    }

    // ─── Evaluate ──────────────────────────────────────────────
    case 'evaluate': {
      const { expression } = command.params as { expression: string };
      const results = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        world: 'MAIN',
        func: (expr: string) => {
          return (0, eval)(expr);
        },
        args: [expression],
      });
      const result = results?.[0]?.result;
      return { value: result };
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

    // ─── State Management ──────────────────────────────────────
    case 'stateExport': {
      const tab = await browser.tabs.get(targetTabId);
      const tabUrl = tab.url || '';

      // Get all cookies for the current tab's URL
      let cookies: Array<{
        name: string; value: string; domain: string; path: string;
        secure: boolean; httpOnly: boolean; sameSite: string;
        expirationDate?: number;
      }> = [];
      if (tabUrl && (tabUrl.startsWith('http://') || tabUrl.startsWith('https://'))) {
        const rawCookies = await browser.cookies.getAll({ url: tabUrl });
        cookies = rawCookies.map(cookieToInfo);
      }

      // Get localStorage and sessionStorage via content script
      const localStorageResp = await browser.tabs.sendMessage(targetTabId, {
        type: 'browser-cli-command',
        id: `state-export-local-${Date.now()}`,
        command: { action: 'storageGet', params: { area: 'local' } },
      });
      const sessionStorageResp = await browser.tabs.sendMessage(targetTabId, {
        type: 'browser-cli-command',
        id: `state-export-session-${Date.now()}`,
        command: { action: 'storageGet', params: { area: 'session' } },
      });

      return {
        url: tabUrl,
        cookies,
        localStorage: localStorageResp.success ? (localStorageResp.data as { entries: Record<string, string> }).entries : {},
        sessionStorage: sessionStorageResp.success ? (sessionStorageResp.data as { entries: Record<string, string> }).entries : {},
      };
    }
    case 'stateImport': {
      const params = command.params as {
        cookies?: Array<{
          url: string; name: string; value: string;
          domain?: string; path?: string; secure?: boolean;
          httpOnly?: boolean; sameSite?: 'no_restriction' | 'lax' | 'strict';
          expirationDate?: number;
        }>;
        localStorage?: Record<string, string>;
        sessionStorage?: Record<string, string>;
      };

      let cookieCount = 0;
      let localCount = 0;
      let sessionCount = 0;

      // Import cookies
      if (params.cookies) {
        for (const cookie of params.cookies) {
          await browser.cookies.set(cookie);
          cookieCount++;
        }
      }

      // Import localStorage
      if (params.localStorage) {
        for (const [key, value] of Object.entries(params.localStorage)) {
          await browser.tabs.sendMessage(targetTabId, {
            type: 'browser-cli-command',
            id: `state-import-local-${Date.now()}-${key}`,
            command: { action: 'storageSet', params: { key, value, area: 'local' } },
          });
          localCount++;
        }
      }

      // Import sessionStorage
      if (params.sessionStorage) {
        for (const [key, value] of Object.entries(params.sessionStorage)) {
          await browser.tabs.sendMessage(targetTabId, {
            type: 'browser-cli-command',
            id: `state-import-session-${Date.now()}-${key}`,
            command: { action: 'storageSet', params: { key, value, area: 'session' } },
          });
          sessionCount++;
        }
      }

      return {
        imported: { cookies: cookieCount, localStorage: localCount, sessionStorage: sessionCount },
      };
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

/**
 * Wait for the tab URL to change from `previousUrl`, then wait for load to complete.
 * Used for goBack/goForward where `tabs.goBack()` resolves before navigation starts.
 */
function waitForUrlChange(
  tabId: number,
  previousUrl: string,
  timeoutMs = 15_000,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      resolve(); // Resolve anyway on timeout — page may have no history
    }, timeoutMs);

    let navigationStarted = false;

    const listener = (
      updatedTabId: number,
      changeInfo: Browser.tabs.OnUpdatedInfo,
    ) => {
      if (updatedTabId !== tabId) return;

      // Detect navigation start via URL change or loading status
      if (changeInfo.url && changeInfo.url !== previousUrl) {
        navigationStarted = true;
      }
      if (changeInfo.status === 'loading') {
        navigationStarted = true;
      }

      // Once navigation started, wait for complete
      if (navigationStarted && changeInfo.status === 'complete') {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    browser.tabs.onUpdated.addListener(listener);
  });
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

async function getDevicePixelRatio(tabId: number): Promise<number> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: () => window.devicePixelRatio,
    });
    return results?.[0]?.result ?? 1;
  } catch {
    return 1;
  }
}

async function cropImage(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  dpr: number,
  format: string,
  quality?: number,
): Promise<string> {
  // Convert data URL to blob without fetch (not supported in MV3 service worker)
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const srcMime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: srcMime });
  const bitmap = await createImageBitmap(blob);

  const sx = Math.round(rect.x * dpr);
  const sy = Math.round(rect.y * dpr);
  const sw = Math.round(rect.width * dpr);
  const sh = Math.round(rect.height * dpr);

  const canvas = new OffscreenCanvas(sw, sh);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();

  const outMime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const outBlob = await canvas.convertToBlob({
    type: outMime,
    quality: quality ? quality / 100 : undefined,
  });

  // Convert blob to data URL without FileReader (not available in service worker)
  const buffer = await outBlob.arrayBuffer();
  const outBytes = new Uint8Array(buffer);
  let outBinary = '';
  for (let i = 0; i < outBytes.length; i++) {
    outBinary += String.fromCharCode(outBytes[i]);
  }
  return `data:${outMime};base64,${btoa(outBinary)}`;
}
