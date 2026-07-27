/**
 * Command router for background-level commands.
 * These are commands handled directly by the background service worker
 * using browser APIs (not forwarded to content scripts).
 */

import type {
  RequestMessage,
  ResponseMessage,
  Command,
  ErrorCode,
  ScreenshotResult,
} from '@browser-cli/shared';
import { BrowserCliError } from '@browser-cli/shared';
import { classifyError } from './error-classifier';
import type { NetworkManager } from './network-manager';
import { startWatch, stopWatch, getActiveWatchTabId } from './network-watcher';
import { getRequests, getRequest } from './request-log';
import { listDownloads, waitForDownload } from './downloads';
import { sendCdpCommand, isDebuggerAvailable } from './debugger-input';
import { sendToContentScript, type ContentScriptResponse } from './send-to-content-script';
import {
  describeFrameId,
  getAllFrames,
  getFocusedFrameId,
  listFrameDescriptors,
  resolveFrameBySelector,
  setFocusedFrameId,
} from './frame-routing';

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

/** Re-throw a content-script failure without flattening its code and hint. */
function throwContentScriptError(
  response: ContentScriptResponse,
  fallback: { code: ErrorCode; message: string; hint?: string },
): never {
  const { code, message, hint, stack } = response.error ?? {};
  throw new BrowserCliError(
    (code as ErrorCode | undefined) ?? fallback.code,
    message ?? fallback.message,
    hint ?? fallback.hint,
    stack,
  );
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
      error: classifyError(err),
    };
  }
}

const BLOCKED_SCHEMES = ['javascript', 'data', 'vbscript'];

function assertSafeUrl(url: string): void {
  const scheme = url.trim().split(':')[0].toLowerCase();
  if (BLOCKED_SCHEMES.includes(scheme)) {
    throw new BrowserCliError(
      'INVALID_ARGS',
      `Blocked navigation to "${scheme}:" URL — this scheme is not allowed for security reasons.`,
      'Use an http: or https: URL instead.',
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
      const before = await browser.tabs.get(targetTabId);
      await browser.tabs.update(targetTabId, { url });
      const load = await waitForTabLoad(targetTabId, 15_000, {
        requireNavigation: true,
        previousUrl: before.url,
      });
      const ready = await waitForContentScriptReady(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title, ...navigationWarnings(load, ready) };
    }
    case 'goBack': {
      const beforeBack = await browser.tabs.get(targetTabId);
      await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: () => history.back(),
      });
      const load = await waitForUrlChange(targetTabId, beforeBack.url || '');
      const ready = await waitForContentScriptReady(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title, ...navigationWarnings(load, ready) };
    }
    case 'goForward': {
      const beforeFwd = await browser.tabs.get(targetTabId);
      await browser.scripting.executeScript({
        target: { tabId: targetTabId },
        func: () => history.forward(),
      });
      const load = await waitForUrlChange(targetTabId, beforeFwd.url || '');
      const ready = await waitForContentScriptReady(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title, ...navigationWarnings(load, ready) };
    }
    case 'reload': {
      await browser.tabs.reload(targetTabId);
      const load = await waitForTabLoad(targetTabId, 15_000, { requireNavigation: true });
      const ready = await waitForContentScriptReady(targetTabId);
      const tab = await browser.tabs.get(targetTabId);
      return { url: tab.url, title: tab.title, ...navigationWarnings(load, ready) };
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
          if (url && tab.id) {
            await waitForTabLoad(tab.id);
            await waitForContentScriptReady(tab.id);
          }
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
          throw new BrowserCliError(
            'INVALID_ARGS',
            `Container "${container}" not found.`,
            'Run "container list" to see available containers, or "container create" to make one.',
          );
        }
        cookieStoreId = identities[0].cookieStoreId;
      }
      const tab = await browser.tabs.create({
        url: url || 'about:blank',
        ...((cookieStoreId != null ? { cookieStoreId } : {}) as Record<string, unknown>),
      } as Browser.tabs.CreateProperties);
      if (url && tab.id) {
        await waitForTabLoad(tab.id);
        await waitForContentScriptReady(tab.id);
      }
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
      const { selector, format, quality, full } = command.params;

      if (full) {
        if (import.meta.env.FIREFOX || !isDebuggerAvailable()) {
          throw new BrowserCliError(
            'UNSUPPORTED',
            'screenshot --full requires the chrome.debugger API, which Firefox does not provide.',
            'Drop --full to capture the viewport, or run this against a Chrome session.',
          );
        }
        return await captureFullPage(targetTabId, selector, format || 'png', quality);
      }

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
          throwContentScriptError(csResponse, {
            code: 'ELEMENT_NOT_FOUND',
            message: `Element not found: ${selector}`,
            hint: "Run 'snapshot -i' to list the elements currently on the page.",
          });
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
        const croppedSize = await imageSize(cropped);
        return {
          data: croppedBase64,
          mimeType: croppedMime,
          width: croppedSize.width,
          height: croppedSize.height,
        };
      }

      // Parse data URL: data:image/png;base64,xxxxx
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      const size = await imageSize(dataUrl);

      return {
        data: base64Data,
        mimeType,
        width: size.width,
        height: size.height,
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
      const { expression, args } = command.params;

      // Evaluate inside the focused frame, so `frame <selector>` also scopes eval
      const evalFrameId = await getFocusedFrameId(targetTabId);
      const evalTarget =
        evalFrameId === 0
          ? { tabId: targetTabId }
          : { tabId: targetTabId, frameIds: [evalFrameId] };

      // ── Step 1: MAIN world eval ────────────────────────────
      const mainWorldResult = await browser.scripting.executeScript({
        target: evalTarget,
        world: 'MAIN',
        func: async (expr: string, callArgs?: unknown[]) => {
          // Capture console output during eval
          const __logs: Array<{ level: string; args: unknown[]; timestamp: number }> = [];
          const __origConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug,
          };
          const __capture =
            (level: string) =>
            (...args: unknown[]) => {
              __logs.push({
                level,
                args: args.map((a) => {
                  if (a instanceof Error) {
                    return { __error: true, name: a.name, message: a.message, stack: a.stack };
                  }
                  try {
                    return JSON.parse(JSON.stringify(a)) as unknown;
                  } catch {
                    return String(a);
                  }
                }),
                timestamp: Date.now(),
              });
              (__origConsole as Record<string, (...a: unknown[]) => void>)[level](...args);
            };
          console.log = __capture('log');
          console.warn = __capture('warn');
          console.error = __capture('error');
          console.info = __capture('info');
          console.debug = __capture('debug');

          // Probe whether eval() is available (CSP / Trusted Types may block it)
          const tt = (globalThis as Record<string, unknown>).trustedTypes as
            | {
                createPolicy: (
                  name: string,
                  rules: { createScript: (s: string) => string },
                ) => { createScript: (s: string) => string };
              }
            | undefined;
          let __evalFn: (code: string) => unknown;
          try {
            if (tt?.createPolicy) {
              const __p = tt.createPolicy('browser-cli-eval', {
                createScript: (s: string) => s,
              });
              (0, eval)(__p.createScript('1'));
              __evalFn = (code: string) => (0, eval)(__p.createScript(code));
            } else {
              (0, eval)('1');
              __evalFn = (code: string) => (0, eval)(code);
            }
          } catch (e: unknown) {
            return { __ok: false, error: (e as Error).message, __blocked: true, logs: __logs };
          }

          // eval() works — any error from here is a genuine expression error
          try {
            // With args the expression must evaluate to a function: (expr)(...args)
            const __r = callArgs
              ? await (__evalFn(`(${expr})`) as (...a: unknown[]) => unknown)(...callArgs)
              : await __evalFn(expr);
            return { __ok: true, value: __r, logs: __logs };
          } catch (e: unknown) {
            return {
              __ok: false,
              error: (e as Error).message,
              stack: (e as Error).stack,
              logs: __logs,
            };
          } finally {
            console.log = __origConsole.log;
            console.warn = __origConsole.warn;
            console.error = __origConsole.error;
            console.info = __origConsole.info;
            console.debug = __origConsole.debug;
          }
        },
        // executeScript rejects `undefined` inside args, so omit the slot entirely.
        args: args ? [expression, args] : [expression],
      });

      const raw = mainWorldResult[0]?.result as
        | {
            __ok: true;
            value: unknown;
            logs?: Array<{ level: string; args: unknown[]; timestamp: number }>;
          }
        | {
            __ok: false;
            error: string;
            stack?: string;
            __blocked?: boolean;
            logs?: Array<{ level: string; args: unknown[]; timestamp: number }>;
          }
        | undefined;

      if (raw?.__ok) {
        const result: {
          value: unknown;
          logs?: Array<{ level: string; args: unknown[]; timestamp: number }>;
        } = { value: raw.value };
        if (raw.logs?.length) result.logs = raw.logs;
        return result;
      }

      const step1Error = raw?.error ?? 'eval() returned no result';

      // eval() ran the expression but it threw — genuine expression error.
      // Carry the page-side stack so the caller sees where in their code it broke.
      if (raw && !raw.__blocked) {
        throw new BrowserCliError('UNKNOWN', step1Error, undefined, raw.stack);
      }

      // ── Step 2: Fallback (platform-specific) ─────────────
      // eval() never reached the expression (CSP / Trusted Types blocked
      // it), so try a CSP-exempt execution path.

      if (!import.meta.env.FIREFOX) {
        // Chrome: userScripts API (USER_SCRIPT world, CSP-exempt)
        // Note: chrome.userScripts may exist but .execute() throws at
        // runtime when "Allow User Scripts" is disabled, so we must catch.
        if (chrome.userScripts?.execute) {
          try {
            // Wrap in eval() + try/catch — userScripts.execute() returns
            // { result: null } on errors instead of setting an error property.
            // eval() ensures syntax errors are caught at runtime, not parse time.
            const escaped = expression
              .replace(/\\/g, '\\\\')
              .replace(/`/g, '\\`')
              .replace(/\$/g, '\\$');
            const invocation = args
              ? `(await (0, eval)(\`(${escaped})\`))(...${JSON.stringify(args)})`
              : `(0, eval)(\`${escaped}\`)`;
            const wrappedCode = `(async () => { try { return { __ok: true, value: await ${invocation} }; } catch(e) { return { __ok: false, error: e.message, stack: e.stack }; } })()`;
            const usResults = await chrome.userScripts.execute({
              target: evalTarget,
              js: [{ code: wrappedCode }],
            });
            const usResult = usResults[0]?.result as
              | { __ok: true; value: unknown }
              | { __ok: false; error: string; stack?: string }
              | null
              | undefined;
            if (usResult && !usResult.__ok) {
              throw new BrowserCliError('UNKNOWN', usResult.error, undefined, usResult.stack);
            }
            return { value: usResult?.__ok ? usResult.value : usResult };
          } catch (usErr) {
            // Re-throw expression errors from userScripts
            if (usErr instanceof Error && !usErr.message.includes('not available')) {
              throw usErr;
            }
            // userScripts not available at runtime — fall through to CSP hint
          }
        }
        // userScripts not available
        throw new BrowserCliError(
          'CSP_BLOCKED',
          "eval() is blocked by this page's Content Security Policy (CSP).",
          "Enable Developer Mode (or 'Allow User Scripts' on Chrome 138+) in chrome://extensions to auto-bypass CSP, or use 'snapshot -ic' / 'find' to interact with elements without eval.",
        );
      } else {
        // Firefox: ISOLATED world eval (extension CSP, always works)
        const response = await sendToContentScript(
          targetTabId,
          {
            type: 'browser-cli-command',
            id: `bg-evaluate-${Date.now()}`,
            command: { action: 'evaluate', params: { expression, args } },
          },
          { frameId: evalFrameId },
        );
        if (!response.success) {
          throwContentScriptError(response, {
            code: 'UNKNOWN',
            message: 'evaluate failed',
          });
        }
        return response.data;
      }
    }

    // ─── Network Watch (CDP) ──────────────────────────────────
    case 'networkWatch': {
      const { pattern, body, method } = command.params;
      const result = await startWatch(targetTabId, {
        pattern,
        captureBody: body,
        method,
      });
      return result;
    }
    case 'networkUnwatch': {
      const tabId = getActiveWatchTabId() ?? targetTabId;
      await stopWatch(tabId);
      return { stopped: true };
    }

    // ─── Network request log (webRequest) ─────────────────────
    case 'networkRequests': {
      return getRequests(command.params, targetTabId);
    }
    case 'networkRequest': {
      return getRequest(command.params.id);
    }

    // ─── CDP escape hatch ───────────────────────────────────────
    case 'cdp': {
      if (import.meta.env.FIREFOX || !isDebuggerAvailable()) {
        throw new BrowserCliError(
          'UNSUPPORTED',
          'cdp requires the chrome.debugger API, which Firefox does not provide.',
          'Run this command against a Chrome session, or use the extension-native commands instead.',
        );
      }
      const { method, params } = command.params;
      try {
        const result = await sendCdpCommand(targetTabId, method, params);
        return { method, result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new BrowserCliError(
          'DEBUGGER_ERROR',
          `CDP command "${method}" failed: ${message}`,
          'Check the method name and params against https://chromedevtools.github.io/devtools-protocol/',
        );
      }
    }

    // ─── Downloads ────────────────────────────────────────────
    case 'downloadList': {
      return listDownloads(command.params);
    }
    case 'downloadWait': {
      return waitForDownload(command.params);
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
    case 'getRoutes': {
      if (!networkManager) throw new Error('NetworkManager not initialized');
      const routes = networkManager.getRoutes();
      return { routes };
    }
    // ─── Window Management ─────────────────────────────────────
    case 'windowNew': {
      const { url } = command.params;
      if (url) assertSafeUrl(url);
      const win = await browser.windows.create({ url: url || 'about:blank' });
      if (!win) throw new Error('Failed to create window');
      const tab = win.tabs?.[0];
      if (url && tab?.id) {
        await waitForTabLoad(tab.id);
        await waitForContentScriptReady(tab.id);
      }
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

    // ─── Frame Management ──────────────────────────────────────
    case 'switchFrame': {
      const { main, selector, frameId } = command.params;

      if (main) {
        await setFocusedFrameId(targetTabId, 0);
        return { frame: await describeFrameId(targetTabId, 0), matchedBy: 'main' };
      }

      if (frameId != null) {
        const frames = await getAllFrames(targetTabId);
        if (!frames.some((f) => f.frameId === frameId)) {
          throw new BrowserCliError(
            'FRAME_ERROR',
            `No frame with id ${frameId} in this tab.`,
            "Run 'frame list' to see the frame ids that exist now.",
          );
        }
        await setFocusedFrameId(targetTabId, frameId);
        return { frame: await describeFrameId(targetTabId, frameId), matchedBy: 'frameId' };
      }

      if (!selector) {
        throw new BrowserCliError(
          'INVALID_ARGS',
          'switchFrame needs a selector, a frameId, or main: true.',
          "Use 'frame <selector>' to enter an iframe, 'frame main' to go back to the top document, or 'frame list' to see the frame ids.",
        );
      }

      const picked = await resolveFrameBySelector(targetTabId, selector);
      await setFocusedFrameId(targetTabId, picked.frameId);
      return {
        frame: await describeFrameId(targetTabId, picked.frameId),
        matchedBy: picked.matchedBy,
      };
    }

    case 'listFrames':
      return listFrameDescriptors(targetTabId);

    case 'getCurrentFrame': {
      const currentFrameId = await getFocusedFrameId(targetTabId);
      return { frame: await describeFrameId(targetTabId, currentFrameId) };
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
        throw new BrowserCliError(
          'INVALID_ARGS',
          `Container "${name}" not found.`,
          'Run "container list" to see available containers.',
        );
      }
      await ctxIdsR.remove(identitiesR[0].cookieStoreId);
      return { removed: true };
    }

    default:
      throw new Error(`Unknown background command: ${command.action}`);
  }
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
function waitForUrlChange(
  tabId: number,
  previousUrl: string,
  timeoutMs = 15_000,
): Promise<{ timedOut: boolean }> {
  return new Promise((resolve) => {
    let navigationStarted = false;
    let settled = false;

    let poll: ReturnType<typeof setInterval> | undefined;

    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      browser.tabs.onUpdated.removeListener(listener);
      resolve({ timedOut });
    };

    const timer = setTimeout(() => finish(true), timeoutMs);

    // A same-document history entry (SPA route) never runs a load cycle, so
    // once the URL has moved, poll the status instead of waiting for 'complete'.
    const startPolling = () => {
      poll ??= setInterval(() => {
        void browser.tabs.get(tabId).then((tab) => {
          if (tab.status === 'complete') finish(false);
        });
      }, 100);
    };

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
      if (navigationStarted) {
        if (changeInfo.status === 'complete') {
          finish(false);
          return;
        }
        startPolling();
      }
    };

    browser.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Ping the content script to verify it's ready to receive commands.
 * Used after navigation to ensure the new page's content script is injected.
 * Resolves (never rejects) — special pages (chrome://, about:, PDF) may never
 * have a content script, so we don't want to block the command flow.
 */
/**
 * Whether the tab's top-level document is parsed and usable. `complete` is not
 * the bar here: the top document's load event also waits on every subframe,
 * which is the very thing this check exists to stop waiting for.
 */
async function isTopFrameLoaded(tabId: number): Promise<boolean> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => document.readyState,
    });
    const state = results[0]?.result;
    return state === 'interactive' || state === 'complete';
  } catch {
    return false;
  }
}

function waitForContentScriptReady(tabId: number, timeoutMs = 5_000): Promise<boolean> {
  const POLL_INTERVAL = 200;
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      if (Date.now() > deadline) {
        resolve(false);
        return;
      }
      browser.tabs
        .sendMessage(tabId, { type: 'browser-cli-ping' }, { frameId: 0 })
        .then((response: unknown) => {
          if (response && (response as { ready?: boolean }).ready) {
            resolve(true);
          } else {
            setTimeout(attempt, POLL_INTERVAL);
          }
        })
        .catch(() => {
          setTimeout(attempt, POLL_INTERVAL);
        });
    };
    attempt();
  });
}

/**
 * Warnings appended to navigation results when the page did not fully settle.
 * The command still succeeds — the agent decides whether to wait further.
 */
function navigationWarnings(load: { timedOut: boolean }, contentScriptReady: boolean) {
  const warnings: string[] = [];
  if (load.timedOut) {
    warnings.push('the page did not reach load state within 15s');
  }
  if (!contentScriptReady) {
    warnings.push(
      'the content script never became ready (privileged page, PDF viewer, or a very slow load)',
    );
  }
  if (warnings.length === 0) return {};
  return {
    contentScriptReady,
    warning: `Navigation finished but ${warnings.join(' and ')}. Commands that touch the DOM may fail — retry after 'wait --load domcontentloaded'.`,
  };
}

/**
 * Wait for a tab to finish loading.
 *
 * With `requireNavigation`, a `complete` status only counts once navigation has
 * actually started — otherwise the stale `complete` of the *previous* page
 * resolves immediately and the caller reads the old DOM.
 *
 * Resolves with `timedOut: true` rather than rejecting, so slow pages degrade
 * into a warning instead of a hard failure.
 */
function waitForTabLoad(
  tabId: number,
  timeoutMs = 15_000,
  options?: { requireNavigation?: boolean; previousUrl?: string },
): Promise<{ timedOut: boolean }> {
  return new Promise((resolve) => {
    let navigationStarted = !options?.requireNavigation;
    let settled = false;

    const finish = (timedOut: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      resolve({ timedOut });
    };

    const timer = setTimeout(() => finish(true), timeoutMs);

    const listener = (updatedTabId: number, changeInfo: Browser.tabs.OnUpdatedInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'loading') navigationStarted = true;
      if (changeInfo.url && changeInfo.url !== options?.previousUrl) navigationStarted = true;
      if (navigationStarted && changeInfo.status === 'complete') finish(false);
    };

    browser.tabs.onUpdated.addListener(listener);

    // A local page can finish loading before the listener is attached, and then
    // no onUpdated event ever arrives — polling is what keeps the latch from
    // waiting out the full timeout on a page that is already done.
    const startedAt = Date.now();
    const POLL_INTERVAL = 100;
    /** Past this, a tab still sitting at `complete` never started loading. */
    const ALREADY_COMPLETE_GRACE = 1_500;
    /**
     * Only pages that would otherwise stall fall back to the top frame alone:
     * a normally-loading page reaches `complete` well inside this window, so
     * its callers keep the stronger "everything settled" guarantee.
     */
    const TOP_FRAME_GRACE = 3_000;

    const poll = () => {
      if (settled) return;
      void browser.tabs
        .get(tabId)
        .then((tab) => {
          if (settled) return;
          if (tab.status === 'loading') {
            navigationStarted = true;
            // A tab stays `loading` until every subframe settles, so one slow
            // or never-finishing iframe would hold navigate for the full
            // timeout. The document the caller asked for being done is what
            // they actually waited for.
            if (Date.now() - startedAt > TOP_FRAME_GRACE) {
              void isTopFrameLoaded(tabId).then((loaded) => {
                if (loaded) finish(false);
              });
            }
          } else if (tab.status === 'complete') {
            const urlChanged =
              options?.previousUrl !== undefined && tab.url !== options.previousUrl;
            if (navigationStarted || urlChanged) {
              finish(false);
              return;
            }
            if (Date.now() - startedAt > ALREADY_COMPLETE_GRACE) {
              finish(false);
              return;
            }
          }
          setTimeout(poll, POLL_INTERVAL);
        })
        .catch(() => setTimeout(poll, POLL_INTERVAL));
    };
    poll();
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

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeMatch ? mimeMatch[1] : 'image/png' });
}

/**
 * Real pixel dimensions of an encoded image. The window/viewport sizes the
 * caller has on hand are CSS pixels and disagree with the capture on any
 * HiDPI display.
 */
async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(dataUrlToBlob(dataUrl));
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}

/**
 * Capture the whole scrollable page via CDP. captureVisibleTab() cannot see
 * past the viewport, and unlike it this path does not have to make the tab
 * active first.
 */
async function captureFullPage(
  tabId: number,
  selector: string | undefined,
  format: string,
  quality: number | undefined,
): Promise<ScreenshotResult> {
  const params: Record<string, unknown> = {
    format,
    captureBeyondViewport: true,
    fromSurface: true,
  };
  if (format === 'jpeg' && quality !== undefined) params.quality = quality;

  if (selector) {
    const bboxResponse = await sendToContentScript(tabId, {
      type: 'browser-cli-command',
      id: `screenshot-full-bbox-${Date.now()}`,
      command: { action: 'boundingBox', params: { selector } },
    });
    if (!bboxResponse.success) {
      throwContentScriptError(bboxResponse, {
        code: 'ELEMENT_NOT_FOUND',
        message: `Element not found: ${selector}`,
        hint: "Run 'snapshot -i' to list the elements currently on the page.",
      });
    }
    const rect = bboxResponse.data as { x: number; y: number; width: number; height: number };
    // boundingBox is viewport-relative; a beyond-viewport capture is anchored
    // at the document origin, so shift by the current scroll offset.
    const scrollResults = await browser.scripting.executeScript({
      target: { tabId },
      func: () => ({ x: window.scrollX, y: window.scrollY }),
    });
    const offset = (scrollResults[0]?.result as { x: number; y: number } | undefined) ?? {
      x: 0,
      y: 0,
    };
    params.clip = {
      x: rect.x + offset.x,
      y: rect.y + offset.y,
      width: rect.width,
      height: rect.height,
      scale: 1,
    };
  }

  let result: unknown;
  try {
    result = await sendCdpCommand(tabId, 'Page.captureScreenshot', params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new BrowserCliError(
      'DEBUGGER_ERROR',
      `Full-page screenshot failed: ${message}`,
      'Another debugger client (DevTools) may be attached to this tab. Close it, or drop --full to capture the viewport.',
    );
  }

  const base64Data = (result as { data?: string }).data;
  if (!base64Data) {
    throw new BrowserCliError(
      'DEBUGGER_ERROR',
      'Page.captureScreenshot returned no image data.',
      'Drop --full to capture the viewport instead.',
    );
  }

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const { width, height } = await imageSize(`data:${mimeType};base64,${base64Data}`);
  return { data: base64Data, mimeType, width, height, fullPage: true };
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
