/**
 * Command router for background-level commands.
 * These are commands handled directly by the background service worker
 * using browser APIs (not forwarded to content scripts).
 */

import type { RequestMessage, ResponseMessage, Command } from '@browser-cli/shared';
import { ErrorCode, createError, isProtocolError } from '@browser-cli/shared';
import { classifyError } from './error-classifier';
import type { NetworkManager } from './network-manager';

/** Firefox contextualIdentities API (not in WXT/Chrome types) */
interface ContextualIdentity {
  name: string;
  color: string;
  icon: string;
  cookieStoreId: string;
}
interface ContextualIdentitiesAPI {
  query: (filter: { name?: string }) => Promise<ContextualIdentity[]>;
  create: (details: { name: string; color: string; icon: string }) => Promise<ContextualIdentity>;
  remove: (cookieStoreId: string) => Promise<ContextualIdentity>;
}

/** Typed response from content script via browser.tabs.sendMessage */
interface ContentScriptResponse {
  success: boolean;
  data?: unknown;
  error?: { message?: string };
}

/** Send a typed message to content script and get a typed response */
async function sendToContentScript(
  tabId: number,
  message: unknown,
  options?: { frameId: number },
): Promise<ContentScriptResponse> {
  return await browser.tabs.sendMessage(tabId, message, options);
}

// Firefox: persistent listener for setHeaders (webRequest blocking mode)
let setHeadersListener:
  | ((
      details: Browser.webRequest.OnBeforeSendHeadersDetails,
    ) => Browser.webRequest.BlockingResponse)
  | null = null;

const TAB_GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

/** Add a tab to a named group, creating the group if it doesn't exist (Chrome only). */
async function addTabToNamedGroup(
  tabId: number,
  groupName: string,
): Promise<{ groupId: number; groupName: string }> {
  const chromeTabsGroup = (
    browser.tabs as unknown as {
      group: (opts: { tabIds: number[]; groupId?: number }) => Promise<number>;
    }
  ).group;

  interface ChromeTabGroup {
    id: number;
    title?: string;
  }
  const tabGroups = (
    globalThis as unknown as {
      chrome: {
        tabGroups: {
          query: (filter: object) => Promise<ChromeTabGroup[]>;
          update: (id: number, props: object) => Promise<ChromeTabGroup>;
        };
      };
    }
  ).chrome.tabGroups;

  // Try to find existing group by title
  const allGroups = await tabGroups.query({});
  const existing = allGroups.find((g) => g.title === groupName);

  if (existing) {
    await chromeTabsGroup({ tabIds: [tabId], groupId: existing.id });
    return { groupId: existing.id, groupName };
  }

  // Create new group with random color
  const groupId = await chromeTabsGroup({ tabIds: [tabId] });
  const color = TAB_GROUP_COLORS[Math.floor(Math.random() * TAB_GROUP_COLORS.length)];
  await tabGroups.update(groupId, { title: groupName, color });
  return { groupId, groupName };
}

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
    return {
      id,
      type: 'response',
      success: false,
      error: isProtocolError(err) ? err : classifyError(err, getFallbackErrorCode(command.action)),
    };
  }
}

const BLOCKED_SCHEMES = ['javascript', 'data', 'vbscript'];

function assertSafeUrl(url: string): void {
  const scheme = url.trim().split(':')[0].toLowerCase();
  if (BLOCKED_SCHEMES.includes(scheme)) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- ProtocolError is caught and classified upstream
    throw createError(
      ErrorCode.INVALID_URL,
      `Blocked navigation to "${scheme}:" URL — this scheme is not allowed for security reasons`,
      'Use http: or https: URLs instead',
    );
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
      const { url } = command.params;
      assertSafeUrl(url);
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
      const { url, container, group } = command.params;
      if (url) assertSafeUrl(url);
      let cookieStoreId: string | undefined;
      if (container) {
        if (!import.meta.env.FIREFOX) {
          const tab = await browser.tabs.create({ url: url || 'about:blank' });
          const result: Record<string, unknown> = {
            tabId: tab.id,
            url: tab.url || url || 'about:blank',
            warning:
              '--container is not supported in Chrome; tab opened without container isolation.',
          };
          if (group && tab.id) {
            const groupResult = await addTabToNamedGroup(tab.id, group);
            Object.assign(result, groupResult);
          }
          return result;
        }
        const ctxIds = (browser as unknown as { contextualIdentities: ContextualIdentitiesAPI })
          .contextualIdentities;
        const identities = await ctxIds.query({ name: container });
        if (identities.length === 0) {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- ProtocolError is caught upstream
          throw createError(
            ErrorCode.CONTAINER_NOT_FOUND,
            `Container "${container}" not found`,
            'Use "container list" to see available containers, or "container create" to create one.',
          );
        }
        cookieStoreId = identities[0].cookieStoreId;
      }
      const tab = await browser.tabs.create({
        url: url || 'about:blank',
        ...((cookieStoreId != null ? { cookieStoreId } : {}) as Record<string, unknown>),
      } as Browser.tabs.CreateProperties);
      const result: Record<string, unknown> = {
        tabId: tab.id,
        url: tab.url || url || 'about:blank',
      };
      if (group && tab.id && !import.meta.env.FIREFOX) {
        const groupResult = await addTabToNamedGroup(tab.id, group);
        Object.assign(result, groupResult);
      }
      return result;
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
      const { tabId } = command.params;
      await browser.tabs.update(tabId, { active: true });
      const tab = await browser.tabs.get(tabId);
      return { tabId: tab.id, url: tab.url, title: tab.title };
    }
    case 'tabClose': {
      const { tabId: closeId } = command.params;
      await browser.tabs.remove(closeId ?? targetTabId);
      return { closed: true };
    }

    // ─── Cookies ───────────────────────────────────────────────
    case 'cookiesGet': {
      const { name, url, domain } = command.params;
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
      await browser.cookies.set(command.params);
      return { set: true };
    }
    case 'cookiesClear': {
      const { url: clearUrl, domain: clearDomain } = command.params;
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
      const { selector, format, quality } = command.params;

      // captureVisibleTab() can only capture the active tab (Chrome API limitation).
      // If targeting a non-active tab, auto-switch to it first.
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0] || tabs[0].id !== targetTabId) {
        await browser.tabs.update(targetTabId, { active: true });
        await waitForTabLoad(targetTabId, 5_000);
        // Brief delay to ensure the browser has painted the tab content
        await new Promise((r) => setTimeout(r, 150));
      }

      // If selector is provided, scroll element into view first via content script
      let cropRect: { x: number; y: number; width: number; height: number } | null = null;
      if (selector) {
        const csResponse = await sendToContentScript(
          targetTabId,
          {
            type: 'browser-cli-command',
            id: `screenshot-prep-${Date.now()}`,
            command: { action: 'scrollIntoView', params: { selector } },
          },
          { frameId: 0 },
        );
        if (!csResponse.success) {
          throw new Error(csResponse.error?.message || `Element not found: ${selector}`);
        }
        // Get bounding box for crop metadata
        const bboxResponse = await sendToContentScript(
          targetTabId,
          {
            type: 'browser-cli-command',
            id: `screenshot-bbox-${Date.now()}`,
            command: { action: 'boundingBox', params: { selector } },
          },
          { frameId: 0 },
        );
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
    // Tiered eval with automatic CSP fallback. See docs/EVAL_CSP.md.
    //
    //   Both ─── 1. MAIN world eval (page globals visible)
    //   Chrome ► 2. chrome.userScripts (USER_SCRIPT world, CSP-exempt)
    //   Firefox► 2. ISOLATED world eval (extension CSP, DOM only)
    //   Both ─── 3. Error with actionable hint
    //
    case 'evaluate': {
      const { expression } = command.params;

      // ── Step 1: MAIN world eval ────────────────────────────
      const mainWorldResult = await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        world: 'MAIN',
        func: (expr: string) => {
          try {
            let __r: unknown;
            // Handle Trusted Types (e.g. Gmail)
            const tt = (globalThis as Record<string, unknown>).trustedTypes as
              | {
                  createPolicy: (
                    name: string,
                    rules: { createScript: (s: string) => string },
                  ) => { createScript: (s: string) => string };
                }
              | undefined;
            if (tt?.createPolicy) {
              const __p = tt.createPolicy('browser-cli-eval', {
                createScript: (s: string) => s,
              });
              __r = (0, eval)(__p.createScript(expr));
            } else {
              __r = (0, eval)(expr);
            }
            return { __ok: true, value: __r };
          } catch (e: unknown) {
            return { __ok: false, error: (e as Error).message };
          }
        },
        args: [expression],
      });

      const raw = mainWorldResult[0]?.result as
        | { __ok: true; value: unknown }
        | { __ok: false; error: string }
        | undefined;

      if (raw?.__ok) {
        return { value: raw.value };
      }

      const evalError = raw?.error ?? 'eval() returned no result';
      const isCSP =
        evalError.includes('CSP') ||
        evalError.includes('Content Security Policy') ||
        evalError.includes('unsafe-eval') ||
        evalError.includes('Refused to evaluate');

      if (!isCSP) {
        throw new Error(evalError);
      }

      // ── Step 2: CSP fallback (platform-specific) ───────────

      if (!import.meta.env.FIREFOX) {
        // Chrome: userScripts API (USER_SCRIPT world, CSP-exempt)
        if (chrome.userScripts?.execute) {
          const usResults = await chrome.userScripts.execute({
            target: { tabId: targetTabId },
            js: [{ code: expression }],
          });
          const usResult = usResults[0] as
            | { result?: unknown; error?: { message?: string } | string }
            | undefined;
          if (usResult?.error) {
            const errDetail =
              typeof usResult.error === 'string'
                ? usResult.error
                : (usResult.error.message ?? JSON.stringify(usResult.error));
            throw new Error(`userScripts eval failed: ${errDetail}`);
          }
          return { value: usResult?.result };
        }
        // userScripts not available
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- ProtocolError is caught upstream
        throw createError(
          ErrorCode.EVAL_ERROR,
          "eval() is blocked by this page's Content Security Policy (CSP).",
          "Enable Developer Mode (or 'Allow User Scripts' on Chrome 138+) in chrome://extensions to auto-bypass CSP. " +
            "Or use 'snapshot -ic' / 'find' to interact with elements without eval.",
        );
      } else {
        // Firefox: ISOLATED world eval (extension CSP, always works)
        const response = await sendToContentScript(
          targetTabId,
          {
            type: 'browser-cli-command',
            id: `bg-evaluate-${Date.now()}`,
            command: { action: 'evaluate', params: { expression } },
          },
          { frameId: 0 },
        );
        if (!response.success) {
          throw new Error(response.error?.message || 'evaluate failed');
        }
        return response.data;
      }
    }

    // ─── Network ───────────────────────────────────────────────
    case 'route': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const { pattern, action, redirectUrl } = command.params;
      const route = await networkManager.addRoute(pattern, action, redirectUrl);
      return { routeId: route.id, pattern: route.pattern, action: route.action };
    }
    case 'unroute': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const { routeId } = command.params;
      const removed = await networkManager.removeRoute(routeId);
      if (!removed) throw new Error(`Route ${routeId} not found`);
      return { removed: true };
    }
    case 'getRequests': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const { pattern, tabId, blockedOnly, limit } = command.params;
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
      const { url } = command.params;
      if (url) assertSafeUrl(url);
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
      const { windowId } = command.params;
      if (windowId) {
        await browser.windows.remove(windowId);
      } else {
        const current = await browser.windows.getCurrent();
        if (current.id) await browser.windows.remove(current.id);
      }
      return { closed: true };
    }
    case 'windowFocus': {
      const { windowId } = command.params;
      const current = await browser.windows.getCurrent();
      const targetId = windowId ?? current.id ?? 0;
      await browser.windows.update(targetId, { focused: true });
      return { windowId: targetId, focused: true };
    }

    // ─── Tab Groups ────────────────────────────────────────────
    case 'tabGroupCreate': {
      if (import.meta.env.FIREFOX) {
        return { groupId: 0, tabCount: 0, warning: 'Tab groups are not supported in Firefox.' };
      }
      const { tabIds } = command.params;
      const chromeTabsGroup = (
        browser.tabs as unknown as { group: (opts: { tabIds: number[] }) => Promise<number> }
      ).group;
      const groupId = await chromeTabsGroup({ tabIds });
      return { groupId, tabCount: tabIds.length };
    }
    case 'tabGroupUpdate': {
      if (import.meta.env.FIREFOX) {
        return {
          groupId: command.params.groupId,
          title: null,
          color: 'grey',
          warning: 'Tab groups are not supported in Firefox.',
        };
      }
      const { groupId, title, color, collapsed } = command.params;
      interface TabGroupInfo {
        id: number;
        title?: string;
        color: string;
      }
      const tabGroups = (
        globalThis as unknown as {
          chrome: { tabGroups: { update: (id: number, props: object) => Promise<TabGroupInfo> } };
        }
      ).chrome.tabGroups;
      const group = await tabGroups.update(groupId, { title, color, collapsed });
      return { groupId: group.id, title: group.title ?? null, color: group.color };
    }
    case 'tabGroupList': {
      if (import.meta.env.FIREFOX) {
        return { groups: [], warning: 'Tab groups are not supported in Firefox.' };
      }
      interface ChromeTabGroup {
        id: number;
        title?: string;
        color: string;
        collapsed: boolean;
        windowId: number;
      }
      const tabGroups = (
        globalThis as unknown as {
          chrome: { tabGroups: { query: (filter: object) => Promise<ChromeTabGroup[]> } };
        }
      ).chrome.tabGroups;
      const groups = await tabGroups.query({});
      const tabs = await browser.tabs.query({});
      return {
        groups: groups.map((g) => ({
          id: g.id,
          title: g.title ?? null,
          color: g.color,
          collapsed: g.collapsed,
          windowId: g.windowId,
          tabCount: tabs.filter(
            (t) => (t as Browser.tabs.Tab & { groupId?: number }).groupId === g.id,
          ).length,
        })),
      };
    }
    case 'tabUngroup': {
      if (import.meta.env.FIREFOX) {
        return { ungrouped: 0, warning: 'Tab groups are not supported in Firefox.' };
      }
      const { tabIds } = command.params;
      const chromeTabsUngroup = (
        browser.tabs as unknown as { ungroup: (tabIds: number[]) => Promise<void> }
      ).ungroup;
      await chromeTabsUngroup(tabIds);
      return { ungrouped: tabIds.length };
    }

    // ─── Bookmarks ─────────────────────────────────────────────
    case 'bookmarkAdd': {
      const { url, title } = command.params;
      const bookmark = await browser.bookmarks.create({ url, title: title ?? url });
      return { id: bookmark.id, url: bookmark.url ?? url, title: bookmark.title };
    }
    case 'bookmarkRemove': {
      const { id } = command.params;
      await browser.bookmarks.remove(id);
      return { removed: true };
    }
    case 'bookmarkList': {
      const { query, limit } = command.params;
      const results = query
        ? await browser.bookmarks.search(query)
        : await browser.bookmarks.search({ query: '' });
      const bookmarks = results
        .filter((b) => b.url) // exclude folders
        .slice(0, limit ?? 100);
      return {
        bookmarks: bookmarks.map((b) => ({
          id: b.id,
          url: b.url ?? '',
          title: b.title,
          dateAdded: b.dateAdded,
        })),
        total: bookmarks.length,
      };
    }

    // ─── History ───────────────────────────────────────────────
    case 'historySearch': {
      const { text, limit, startTime, endTime } = command.params;
      const results = await browser.history.search({
        text: text ?? '',
        maxResults: limit ?? 100,
        startTime,
        endTime,
      });
      return {
        entries: results.map((h) => ({
          id: h.id,
          url: h.url ?? '',
          title: h.title ?? '',
          lastVisitTime: h.lastVisitTime,
          visitCount: h.visitCount,
        })),
        total: results.length,
      };
    }

    // ─── State Management ──────────────────────────────────────
    case 'stateExport': {
      const tab = await browser.tabs.get(targetTabId);
      const tabUrl = tab.url || '';

      // Get all cookies for the current tab's URL
      let cookies: Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        secure: boolean;
        httpOnly: boolean;
        sameSite: string;
        expirationDate?: number;
      }> = [];
      if (tabUrl && (tabUrl.startsWith('http://') || tabUrl.startsWith('https://'))) {
        const rawCookies = await browser.cookies.getAll({ url: tabUrl });
        cookies = rawCookies.map(cookieToInfo);
      }

      // Get localStorage and sessionStorage via content script
      const localStorageResp = await sendToContentScript(
        targetTabId,
        {
          type: 'browser-cli-command',
          id: `state-export-local-${Date.now()}`,
          command: { action: 'storageGet', params: { area: 'local' } },
        },
        { frameId: 0 },
      );
      const sessionStorageResp = await sendToContentScript(
        targetTabId,
        {
          type: 'browser-cli-command',
          id: `state-export-session-${Date.now()}`,
          command: { action: 'storageGet', params: { area: 'session' } },
        },
        { frameId: 0 },
      );

      return {
        url: tabUrl,
        cookies,
        localStorage: localStorageResp.success
          ? (localStorageResp.data as { entries: Record<string, string> }).entries
          : {},
        sessionStorage: sessionStorageResp.success
          ? (sessionStorageResp.data as { entries: Record<string, string> }).entries
          : {},
      };
    }
    case 'stateImport': {
      const params = command.params;

      let cookieCount = 0;
      let localCount = 0;
      let sessionCount = 0;

      // Import cookies
      if (params.cookies) {
        for (const cookie of params.cookies) {
          try {
            // chrome.cookies.set only accepts specific fields
            const { url, name, value, domain, path, secure, httpOnly, sameSite, expirationDate } =
              cookie;
            await browser.cookies.set({
              url,
              name,
              value,
              domain,
              path,
              secure,
              httpOnly,
              sameSite,
              expirationDate,
            });
            cookieCount++;
          } catch (err) {
            console.warn(`[browser-cli] Failed to set cookie "${cookie.name}":`, err);
          }
        }
      }

      // Import localStorage
      if (params.localStorage) {
        for (const [key, value] of Object.entries(params.localStorage)) {
          await sendToContentScript(
            targetTabId,
            {
              type: 'browser-cli-command',
              id: `state-import-local-${Date.now()}-${key}`,
              command: { action: 'storageSet', params: { key, value, area: 'local' } },
            },
            { frameId: 0 },
          );
          localCount++;
        }
      }

      // Import sessionStorage
      if (params.sessionStorage) {
        for (const [key, value] of Object.entries(params.sessionStorage)) {
          await sendToContentScript(
            targetTabId,
            {
              type: 'browser-cli-command',
              id: `state-import-session-${Date.now()}-${key}`,
              command: { action: 'storageSet', params: { key, value, area: 'session' } },
            },
            { frameId: 0 },
          );
          sessionCount++;
        }
      }

      return {
        imported: { cookies: cookieCount, localStorage: localCount, sessionStorage: sessionCount },
      };
    }

    // ─── Browser Config ─────────────────────────────────────────
    case 'setViewport': {
      const { width, height } = command.params;
      const current = await browser.windows.getCurrent();
      if (current.id) {
        await browser.windows.update(current.id, { width, height });
      }
      return { set: true, width, height };
    }
    case 'setHeaders': {
      const { headers } = command.params;

      if (import.meta.env.FIREFOX) {
        // Firefox: use webRequest.onBeforeSendHeaders with blocking to modify headers
        // Remove previous listener if any
        if (setHeadersListener) {
          browser.webRequest.onBeforeSendHeaders.removeListener(setHeadersListener);
        }
        if (Object.keys(headers).length > 0) {
          setHeadersListener = (details: Browser.webRequest.OnBeforeSendHeadersDetails) => {
            const requestHeaders = details.requestHeaders || [];
            for (const [name, value] of Object.entries(headers)) {
              const existing = requestHeaders.find(
                (h) => h.name.toLowerCase() === name.toLowerCase(),
              );
              if (existing) {
                existing.value = value;
              } else {
                requestHeaders.push({ name, value });
              }
            }
            return { requestHeaders };
          };
          browser.webRequest.onBeforeSendHeaders.addListener(
            setHeadersListener,
            { urls: ['<all_urls>'] },
            ['blocking', 'requestHeaders'],
          );
        } else {
          setHeadersListener = null;
        }
        return { set: true, ruleCount: Object.keys(headers).length };
      }

      // Chrome: use declarativeNetRequest
      const rules: Array<{
        id: number;
        priority: number;
        action: {
          type: string;
          requestHeaders: Array<{ header: string; operation: string; value: string }>;
        };
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
            resourceTypes: [
              'main_frame',
              'sub_frame',
              'xmlhttprequest',
              'script',
              'stylesheet',
              'image',
              'font',
              'media',
              'other',
            ],
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

    // ─── Container (Firefox contextualIdentities) ───────────────
    case 'containerList': {
      if (!import.meta.env.FIREFOX) {
        return { containers: [], warning: 'Containers are only supported in Firefox.' };
      }
      const ctxIdsL = (browser as unknown as { contextualIdentities: ContextualIdentitiesAPI })
        .contextualIdentities;
      const identitiesL = await ctxIdsL.query({});
      return {
        containers: identitiesL.map((i) => ({
          name: i.name,
          color: i.color,
          icon: i.icon,
          cookieStoreId: i.cookieStoreId,
        })),
      };
    }
    case 'containerCreate': {
      if (!import.meta.env.FIREFOX) {
        return {
          name: '',
          color: '',
          icon: '',
          cookieStoreId: '',
          warning: 'Containers are only supported in Firefox.',
        };
      }
      const { name, color = 'blue', icon = 'circle' } = command.params;
      const ctxIdsC = (browser as unknown as { contextualIdentities: ContextualIdentitiesAPI })
        .contextualIdentities;
      const identity = await ctxIdsC.create({ name, color, icon });
      return {
        name: identity.name,
        color: identity.color,
        icon: identity.icon,
        cookieStoreId: identity.cookieStoreId,
      };
    }
    case 'containerRemove': {
      if (!import.meta.env.FIREFOX) {
        return { removed: true, warning: 'Containers are only supported in Firefox.' };
      }
      const { name } = command.params;
      const ctxIdsR = (browser as unknown as { contextualIdentities: ContextualIdentitiesAPI })
        .contextualIdentities;
      const identitiesR = await ctxIdsR.query({ name });
      if (identitiesR.length === 0) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- ProtocolError is caught upstream
        throw createError(
          ErrorCode.CONTAINER_NOT_FOUND,
          `Container "${name}" not found`,
          'Use "container list" to see available containers.',
        );
      }
      await ctxIdsR.remove(identitiesR[0].cookieStoreId);
      return { removed: true };
    }

    default:
      throw new Error(`Unknown background command: ${command.action}`);
  }
}

export function getFallbackErrorCode(action: string): ErrorCode {
  if (['navigate', 'goBack', 'goForward', 'reload'].includes(action)) {
    return ErrorCode.NAVIGATION_FAILED;
  }
  if (['tabNew', 'tabList', 'tabSwitch', 'tabClose'].includes(action)) {
    return ErrorCode.TAB_NOT_FOUND;
  }
  if (action === 'screenshot') {
    return ErrorCode.SCREENSHOT_FAILED;
  }
  if (['windowNew', 'windowList', 'windowClose', 'windowFocus'].includes(action)) {
    return ErrorCode.UNKNOWN;
  }
  if (['tabGroupCreate', 'tabGroupUpdate', 'tabGroupList', 'tabUngroup'].includes(action)) {
    return ErrorCode.TAB_NOT_FOUND;
  }
  if (['bookmarkAdd', 'bookmarkRemove', 'bookmarkList'].includes(action)) {
    return ErrorCode.UNKNOWN;
  }
  if (action === 'historySearch') {
    return ErrorCode.UNKNOWN;
  }
  if (['containerList', 'containerCreate', 'containerRemove'].includes(action)) {
    return ErrorCode.CONTAINER_NOT_FOUND;
  }
  return ErrorCode.UNKNOWN;
}

export function cookieToInfo(c: Browser.cookies.Cookie) {
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
function waitForUrlChange(tabId: number, previousUrl: string, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      resolve(); // Resolve anyway on timeout — page may have no history
    }, timeoutMs);

    let navigationStarted = false;

    const listener = (updatedTabId: number, changeInfo: Browser.tabs.OnUpdatedInfo) => {
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

    const listener = (updatedTabId: number, changeInfo: Browser.tabs.OnUpdatedInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    browser.tabs.onUpdated.addListener(listener);

    // Check if already complete
    void browser.tabs.get(tabId).then((tab) => {
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

    return (results[0]?.result as number) || 1;
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
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d canvas context');
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
