import { z } from 'zod';
import { existsSync, readFileSync, statSync } from 'node:fs';
import type { ActionResultMap, ActionType, Command as BrowserCommand } from '@browser-cli/shared';
import { getDaemonLogPath } from '../util/paths.js';
import type { ToolProfile } from './profiles.js';

export type ToolContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export type SendCommand = (command: BrowserCommand) => Promise<unknown>;

export interface McpTool {
  name: string;
  profile: ToolProfile;
  config: {
    title: string;
    description: string;
    inputSchema: z.ZodRawShape;
    annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
  };
  run: (args: Record<string, unknown>, send: SendCommand) => Promise<ToolContent[]>;
}

type Position = { type: 'first' | 'last' | 'nth'; index?: number } | undefined;

const nthSchema = z
  .number()
  .int()
  .optional()
  .describe(
    'Which match to act on when the selector is ambiguous: 1-based index, or -1 for the last match. Without it an ambiguous selector fails with MULTIPLE_MATCHES.',
  );

const forceSchema = z
  .boolean()
  .optional()
  .describe(
    'Skip the disabled/occlusion actionability checks. Use only after a check falsely blocks a real element.',
  );

const debuggerSchema = z
  .boolean()
  .optional()
  .describe(
    'Dispatch the event through CDP so the page sees isTrusted=true. Chrome only; needed for sites that reject synthetic events.',
  );

const selectorDoc =
  'CSS selector, semantic locator (text=Submit, role=button[name="Save"], label=Email, testid=login, xpath=//button), or an @eN ref from snapshot.';

function positionOf(nth: number | undefined): Position {
  if (nth === undefined) return undefined;
  if (nth === -1) return { type: 'last' };
  if (nth === 1) return { type: 'first' };
  return { type: 'nth', index: nth };
}

function text(value: string): ToolContent[] {
  return [{ type: 'text', text: value }];
}

function json(value: unknown): ToolContent[] {
  return text(JSON.stringify(value, null, 2));
}

interface ToolSpec<Shape extends z.ZodRawShape, A extends ActionType> {
  name: string;
  profile: ToolProfile;
  title: string;
  description: string;
  inputSchema: Shape;
  readOnly?: boolean;
  destructive?: boolean;
  build: (args: z.infer<z.ZodObject<Shape>>) => BrowserCommand & { action: A };
  render?: (result: ActionResultMap[A]) => ToolContent[];
}

function defineTool<Shape extends z.ZodRawShape, A extends ActionType>(
  spec: ToolSpec<Shape, A>,
): McpTool {
  const build = spec.build as unknown as (args: Record<string, unknown>) => BrowserCommand;
  const render = spec.render as ((result: unknown) => ToolContent[]) | undefined;
  return {
    name: spec.name,
    profile: spec.profile,
    config: {
      title: spec.title,
      description: spec.description,
      inputSchema: spec.inputSchema,
      annotations: {
        readOnlyHint: spec.readOnly ?? false,
        destructiveHint: spec.destructive ?? false,
        openWorldHint: true,
      },
    },
    run: async (args, send) => {
      const result = await send(build(args));
      return render ? render(result) : json(result);
    },
  };
}

const navigationTools: McpTool[] = [
  defineTool({
    name: 'navigate',
    profile: 'core',
    title: 'Navigate',
    description:
      'Open a URL in the active browser tab and wait for the page to be ready. Returns the final URL and title, which may differ from the requested URL after redirects. Follow with `snapshot` to see what is on the page.',
    inputSchema: {
      url: z.string().describe('Absolute URL to open, e.g. https://example.com/login'),
    },
    build: (args) => ({ action: 'navigate', params: { url: args.url } }),
    render: (result) => {
      const lines = [`Navigated to ${result.url}`, `Title: ${result.title}`];
      if (result.warning) lines.push(`Warning: ${result.warning}`);
      return text(lines.join('\n'));
    },
  }),
  defineTool({
    name: 'go_back',
    profile: 'core',
    title: 'Go back',
    description: 'Go back one entry in the tab history. Returns the URL and title landed on.',
    inputSchema: {},
    build: () => ({ action: 'goBack', params: {} }),
    render: (result) => text(`Went back to ${result.url}\nTitle: ${result.title}`),
  }),
  defineTool({
    name: 'go_forward',
    profile: 'core',
    title: 'Go forward',
    description: 'Go forward one entry in the tab history. Returns the URL and title landed on.',
    inputSchema: {},
    build: () => ({ action: 'goForward', params: {} }),
    render: (result) => text(`Went forward to ${result.url}\nTitle: ${result.title}`),
  }),
  defineTool({
    name: 'reload',
    profile: 'core',
    title: 'Reload',
    description:
      'Reload the current page and wait for it to be ready. Element refs (@eN) from an earlier snapshot go stale — take a new snapshot afterwards.',
    inputSchema: {},
    build: () => ({ action: 'reload', params: {} }),
    render: (result) => text(`Reloaded ${result.url}\nTitle: ${result.title}`),
  }),
];

const perceptionTools: McpTool[] = [
  defineTool({
    name: 'snapshot',
    profile: 'core',
    title: 'Page snapshot',
    description:
      'PREFERRED way to perceive a page. Returns an accessibility tree of the current page as indented text, where every interactive element carries a stable ref like @e12. Pass that ref straight to click/fill/type_text/press/select_option/get_text instead of writing CSS selectors. Call this after every navigation or state change; refs from an older snapshot may be stale. Cheaper and more reliable than screenshot for deciding what to do next — use screenshot only when the visual layout itself matters.',
    inputSchema: {
      interactive: z
        .boolean()
        .optional()
        .describe(
          'Only include interactive elements (links, buttons, inputs). Much smaller output.',
        ),
      compact: z.boolean().optional().describe('Drop decorative and redundant nodes.'),
      cursor: z
        .boolean()
        .optional()
        .describe('Also include elements that only look clickable via CSS cursor:pointer.'),
      depth: z.number().int().min(1).optional().describe('Maximum tree depth to render.'),
      selector: z.string().optional().describe(`Scope the snapshot to one subtree. ${selectorDoc}`),
      filter: z
        .string()
        .optional()
        .describe('Only show nodes with this ARIA role (plus their ancestors), e.g. "button".'),
      maxChars: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Truncate the snapshot to roughly this many characters.'),
    },
    readOnly: true,
    build: (args) => ({
      action: 'snapshot',
      params: {
        interactive: args.interactive,
        compact: args.compact,
        cursor: args.cursor,
        depth: args.depth,
        selector: args.selector,
        filter: args.filter,
        maxChars: args.maxChars,
      },
    }),
    render: (result) => text(result.snapshot || '(empty snapshot)'),
  }),
  defineTool({
    name: 'screenshot',
    profile: 'core',
    title: 'Screenshot',
    description:
      'Capture the visible viewport (or one element) as an image. Use when the visual appearance matters — layout, colours, canvas, charts. For deciding what to click, `snapshot` is cheaper and gives refs.',
    inputSchema: {
      selector: z
        .string()
        .optional()
        .describe(`Capture only this element instead of the viewport. ${selectorDoc}`),
      format: z.enum(['png', 'jpeg']).optional().describe('Image format, default png.'),
      quality: z.number().int().min(0).max(100).optional().describe('JPEG quality, 0-100.'),
    },
    readOnly: true,
    build: (args) => ({
      action: 'screenshot',
      params: { selector: args.selector, format: args.format, quality: args.quality },
    }),
    render: (result) => [{ type: 'image', data: result.data, mimeType: result.mimeType }],
  }),
  defineTool({
    name: 'get_url',
    profile: 'core',
    title: 'Get URL',
    description: 'Return the current URL of the active tab.',
    inputSchema: {},
    readOnly: true,
    build: () => ({ action: 'getUrl', params: {} }),
    render: (result) => text(result.url),
  }),
  defineTool({
    name: 'get_title',
    profile: 'core',
    title: 'Get title',
    description: 'Return the document title of the active tab.',
    inputSchema: {},
    readOnly: true,
    build: () => ({ action: 'getTitle', params: {} }),
    render: (result) => text(result.title),
  }),
  defineTool({
    name: 'get_text',
    profile: 'core',
    title: 'Get text',
    description:
      'Return the visible text content of one element. Use it to read a result, a message, or a table cell after acting on the page.',
    inputSchema: {
      selector: z.string().describe(selectorDoc),
      nth: nthSchema,
    },
    readOnly: true,
    build: (args) => ({
      action: 'getText',
      params: { selector: args.selector, position: positionOf(args.nth) },
    }),
    render: (result) => text(result.text),
  }),
];

const interactionTools: McpTool[] = [
  defineTool({
    name: 'click',
    profile: 'core',
    title: 'Click',
    description:
      'Click an element. Prefer an @eN ref from `snapshot`. Fails with ELEMENT_NOT_FOUND, MULTIPLE_MATCHES (pass `nth`), or ELEMENT_OCCLUDED (pass `force`) rather than clicking the wrong thing.',
    inputSchema: {
      selector: z.string().describe(selectorDoc),
      button: z
        .enum(['left', 'right', 'middle'])
        .optional()
        .describe('Mouse button, default left.'),
      nth: nthSchema,
      force: forceSchema,
      trusted: debuggerSchema,
    },
    build: (args) => ({
      action: 'click',
      params: {
        selector: args.selector,
        button: args.button,
        force: args.force,
        debugger: args.trusted,
        position: positionOf(args.nth),
      },
    }),
    render: () => text('Clicked'),
  }),
  defineTool({
    name: 'hover',
    profile: 'core',
    title: 'Hover',
    description:
      'Move the pointer over an element to reveal menus or tooltips. Pass `trusted: true` to also activate the CSS :hover pseudo-class.',
    inputSchema: {
      selector: z.string().describe(selectorDoc),
      nth: nthSchema,
      force: forceSchema,
      trusted: debuggerSchema,
    },
    build: (args) => ({
      action: 'hover',
      params: {
        selector: args.selector,
        force: args.force,
        debugger: args.trusted,
        position: positionOf(args.nth),
      },
    }),
    render: () => text('Hovered'),
  }),
  defineTool({
    name: 'fill',
    profile: 'core',
    title: 'Fill input',
    description:
      'Replace the value of an input, textarea or contenteditable in one step. Works with React/Vue controlled components. Use `type_text` instead when the page reacts to individual keystrokes (autocomplete, search-as-you-type).',
    inputSchema: {
      selector: z.string().describe(selectorDoc),
      value: z.string().describe('The full value to set; existing content is replaced.'),
      nth: nthSchema,
      force: forceSchema,
      trusted: debuggerSchema,
    },
    build: (args) => ({
      action: 'fill',
      params: {
        selector: args.selector,
        value: args.value,
        force: args.force,
        debugger: args.trusted,
        position: positionOf(args.nth),
      },
    }),
    render: () => text('Filled'),
  }),
  defineTool({
    name: 'type_text',
    profile: 'core',
    title: 'Type text',
    description:
      'Type text key by key into the focused/target element, appending to what is there. Use for autocomplete or any field that listens to keystrokes; otherwise `fill` is faster.',
    inputSchema: {
      selector: z.string().describe(selectorDoc),
      text: z.string().describe('Text to type, appended to the current value.'),
      delay: z.number().int().min(0).optional().describe('Milliseconds between keystrokes.'),
      nth: nthSchema,
      force: forceSchema,
      trusted: debuggerSchema,
    },
    build: (args) => ({
      action: 'type',
      params: {
        selector: args.selector,
        text: args.text,
        delay: args.delay,
        force: args.force,
        debugger: args.trusted,
        position: positionOf(args.nth),
      },
    }),
    render: () => text('Typed'),
  }),
  defineTool({
    name: 'press',
    profile: 'core',
    title: 'Press key',
    description:
      'Press a key. Without `selector` it goes to the page (the focused element). Key names follow the DOM: Enter, Escape, Tab, ArrowDown, Backspace, or combinations like Control+a and Meta+Shift+p.',
    inputSchema: {
      key: z.string().describe('Key or combination, e.g. "Enter", "Escape", "Control+a".'),
      selector: z
        .string()
        .optional()
        .describe(`Focus this element first instead of pressing on the page. ${selectorDoc}`),
      nth: nthSchema,
      trusted: debuggerSchema,
    },
    build: (args) => ({
      action: 'press',
      params: {
        key: args.key,
        selector: args.selector,
        debugger: args.trusted,
        position: positionOf(args.nth),
      },
    }),
    render: () => text('Pressed'),
  }),
  defineTool({
    name: 'select_option',
    profile: 'core',
    title: 'Select option',
    description:
      'Choose an option in a native <select>. The value is matched against the option value first, then its visible label.',
    inputSchema: {
      selector: z.string().describe(selectorDoc),
      value: z.string().describe('Option value or visible label.'),
      nth: nthSchema,
      force: forceSchema,
    },
    build: (args) => ({
      action: 'select',
      params: {
        selector: args.selector,
        value: args.value,
        force: args.force,
        position: positionOf(args.nth),
      },
    }),
    render: (result) => text(`Selected ${result.value}`),
  }),
  defineTool({
    name: 'wait_for',
    profile: 'core',
    title: 'Wait',
    description:
      'Wait for a condition before continuing: an element to appear (`selector`), text to appear (`text`), the URL to match (`url`, glob like "**/dashboard"), a page load state (`load`), or a fixed delay (`duration`). Exactly one condition should be given. Prefer waiting on a selector or URL over a fixed delay.',
    inputSchema: {
      selector: z.string().optional().describe(`Wait until this element exists. ${selectorDoc}`),
      text: z.string().optional().describe('Wait until this text appears on the page.'),
      url: z
        .string()
        .optional()
        .describe('Wait until the URL matches this glob or regex, e.g. "**/dashboard".'),
      load: z
        .enum(['load', 'domcontentloaded', 'networkidle'])
        .optional()
        .describe('Wait for a page load state.'),
      duration: z.number().int().min(0).optional().describe('Wait a fixed number of milliseconds.'),
      visible: z
        .boolean()
        .optional()
        .describe('Require the element to be visible, not just present.'),
      timeout: z.number().int().min(1).optional().describe('Give up after this many milliseconds.'),
    },
    readOnly: true,
    build: (args) => {
      if (args.url !== undefined) {
        return { action: 'waitForUrl', params: { pattern: args.url, timeout: args.timeout } };
      }
      return {
        action: 'wait',
        params: {
          selector: args.selector,
          text: args.text,
          load: args.load,
          duration: args.duration,
          visible: args.visible,
          timeout: args.timeout,
        },
      };
    },
    render: (result) => text('url' in result ? `URL is now ${result.url}` : 'Condition met'),
  }),
  defineTool({
    name: 'eval_js',
    profile: 'core',
    title: 'Evaluate JavaScript',
    description:
      'Run a JavaScript expression in the page (MAIN world) and return the result, serialized by structured clone — DOM nodes and functions come back as null. Use it for things the other tools cannot express; prefer the dedicated tools when one fits. An arrow function plus `args` lets you pass values in: expression "(a, b) => a + b" with args [1, 2].',
    inputSchema: {
      expression: z
        .string()
        .describe('JavaScript expression, e.g. "document.querySelectorAll(\'a\').length".'),
      args: z
        .array(z.unknown())
        .optional()
        .describe('Arguments applied when the expression is a function: (expr)(...args).'),
    },
    build: (args) => ({
      action: 'evaluate',
      params: { expression: args.expression, args: args.args },
    }),
    render: (result) => {
      const out = [
        result.value === undefined ? 'undefined' : JSON.stringify(result.value, null, 2),
      ];
      if (result.logs?.length) {
        out.push('', 'Console output:');
        for (const entry of result.logs) {
          const args = entry.args
            .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
            .join(' ');
          out.push(`[${entry.level}] ${args}`);
        }
      }
      return text(out.join('\n'));
    },
  }),
];

const tabTools: McpTool[] = [
  defineTool({
    name: 'tab_list',
    profile: 'core',
    title: 'List tabs',
    description:
      'List the open tabs with their id, url, title and which one is active. Tab ids feed `tab_select` and `tab_close`.',
    inputSchema: {},
    readOnly: true,
    build: () => ({ action: 'tabList', params: {} }),
    render: (result) =>
      text(
        result.tabs.length === 0
          ? 'No open tabs'
          : result.tabs
              .map((t) => `${t.active ? '*' : ' '} [${t.id}] ${t.title} — ${t.url}`)
              .join('\n'),
      ),
  }),
  defineTool({
    name: 'tab_new',
    profile: 'core',
    title: 'New tab',
    description: 'Open a new tab and make it the active target for subsequent tools.',
    inputSchema: {
      url: z.string().optional().describe('URL to open; blank tab when omitted.'),
    },
    build: (args) => ({ action: 'tabNew', params: { url: args.url } }),
    render: (result) => text(`Opened tab ${result.tabId} at ${result.url}`),
  }),
  defineTool({
    name: 'tab_select',
    profile: 'core',
    title: 'Switch tab',
    description: 'Make an existing tab the active target. Get ids from `tab_list`.',
    inputSchema: {
      tabId: z.number().int().describe('Tab id from tab_list.'),
    },
    build: (args) => ({ action: 'tabSwitch', params: { tabId: args.tabId } }),
    render: (result) => text(`Switched to tab ${result.tabId}: ${result.title} — ${result.url}`),
  }),
  defineTool({
    name: 'tab_close',
    profile: 'tabs',
    title: 'Close tab',
    description: 'Close a tab, or the active tab when no id is given.',
    inputSchema: {
      tabId: z.number().int().optional().describe('Tab id from tab_list; active tab when omitted.'),
    },
    destructive: true,
    build: (args) => ({ action: 'tabClose', params: { tabId: args.tabId } }),
    render: () => text('Tab closed'),
  }),
  defineTool({
    name: 'tab_group_create',
    profile: 'tabs',
    title: 'Group tabs',
    description: 'Put the given tabs into a new tab group (Chrome only).',
    inputSchema: {
      tabIds: z.array(z.number().int()).describe('Tab ids to group.'),
    },
    build: (args) => ({ action: 'tabGroupCreate', params: { tabIds: args.tabIds } }),
    render: (result) => text(`Created group ${result.groupId} with ${result.tabCount} tabs`),
  }),
  defineTool({
    name: 'tab_group_list',
    profile: 'tabs',
    title: 'List tab groups',
    description: 'List the tab groups with id, title, colour and tab count (Chrome only).',
    inputSchema: {},
    readOnly: true,
    build: () => ({ action: 'tabGroupList', params: {} }),
    render: (result) => json(result.groups),
  }),
  defineTool({
    name: 'window_list',
    profile: 'tabs',
    title: 'List windows',
    description: 'List the browser windows with id, focus state and tab count.',
    inputSchema: {},
    readOnly: true,
    build: () => ({ action: 'windowList', params: {} }),
    render: (result) => json(result.windows),
  }),
  defineTool({
    name: 'window_new',
    profile: 'tabs',
    title: 'New window',
    description: 'Open a new browser window and make its tab the active target.',
    inputSchema: {
      url: z.string().optional().describe('URL to open in the new window.'),
    },
    build: (args) => ({ action: 'windowNew', params: { url: args.url } }),
    render: (result) =>
      text(`Opened window ${result.windowId}, tab ${result.tabId} at ${result.url}`),
  }),
  defineTool({
    name: 'window_close',
    profile: 'tabs',
    title: 'Close window',
    description: 'Close a browser window, or the current one when no id is given.',
    inputSchema: {
      windowId: z.number().int().optional().describe('Window id from window_list.'),
    },
    destructive: true,
    build: (args) => ({ action: 'windowClose', params: { windowId: args.windowId } }),
    render: () => text('Window closed'),
  }),
  defineTool({
    name: 'window_focus',
    profile: 'tabs',
    title: 'Focus window',
    description: 'Bring a browser window to the front. Get window ids from `window_list`.',
    inputSchema: {
      windowId: z.number().int().optional().describe('Window id from window_list.'),
    },
    build: (args) => ({ action: 'windowFocus', params: { windowId: args.windowId } }),
    render: (result) => text(`Focused window ${result.windowId}`),
  }),
];

const networkTools: McpTool[] = [
  defineTool({
    name: 'network_requests',
    profile: 'network',
    title: 'List network requests',
    description:
      'List HTTP requests the browser recorded, newest last, with method, URL, status and duration. Use it to check whether an API call fired and what it returned. Narrow with `filter` (substring or glob on the URL).',
    inputSchema: {
      filter: z.string().optional().describe('Substring or glob matched against the request URL.'),
      limit: z.number().int().min(1).optional().describe('Return at most this many requests.'),
      all: z
        .boolean()
        .optional()
        .describe('Include requests from every tab, not just the active one.'),
      clear: z.boolean().optional().describe('Clear the buffer after reading.'),
    },
    readOnly: true,
    build: (args) => ({
      action: 'networkRequests',
      params: { filter: args.filter, limit: args.limit, all: args.all, clear: args.clear },
    }),
    render: (result) =>
      text(
        result.requests.length === 0
          ? `No matching requests (total ${result.total})`
          : result.requests
              .map(
                (r) =>
                  `${r.id} ${r.method} ${r.status ?? '---'} ${r.url}${r.duration === undefined ? '' : ` (${r.duration}ms)`}`,
              )
              .join('\n'),
      ),
  }),
  defineTool({
    name: 'network_request',
    profile: 'network',
    title: 'Inspect network request',
    description:
      'Return the full detail of one recorded request. Get the id from `network_requests`.',
    inputSchema: {
      id: z.string().describe('Request id from network_requests.'),
    },
    readOnly: true,
    build: (args) => ({ action: 'networkRequest', params: { id: args.id } }),
    render: (result) => json(result.request),
  }),
  defineTool({
    name: 'network_route',
    profile: 'network',
    title: 'Add network route',
    description:
      'Intercept requests matching a URL pattern and either block them or redirect them elsewhere. Use it to simulate failures or stub a third-party dependency. Remove with `network_unroute`.',
    inputSchema: {
      pattern: z.string().describe('URL pattern to match, e.g. "**/api/user*".'),
      action: z.enum(['block', 'redirect']).describe('Block the request or redirect it.'),
      redirectUrl: z
        .string()
        .optional()
        .describe('Target URL; required when action is "redirect".'),
    },
    build: (args) => ({
      action: 'route',
      params: { pattern: args.pattern, action: args.action, redirectUrl: args.redirectUrl },
    }),
    render: (result) => text(`Route ${result.routeId} added: ${result.action} ${result.pattern}`),
  }),
  defineTool({
    name: 'network_unroute',
    profile: 'network',
    title: 'Remove network route',
    description: 'Remove a route previously added with `network_route`.',
    inputSchema: {
      routeId: z.number().int().describe('Route id returned by network_route or network_routes.'),
    },
    build: (args) => ({ action: 'unroute', params: { routeId: args.routeId } }),
    render: () => text('Route removed'),
  }),
  defineTool({
    name: 'network_routes',
    profile: 'network',
    title: 'List network routes',
    description:
      'List the interception routes currently installed by `network_route`, with their ids.',
    inputSchema: {},
    readOnly: true,
    build: () => ({ action: 'getRoutes', params: {} }),
    render: (result) => json(result.routes),
  }),
];

const stateTools: McpTool[] = [
  defineTool({
    name: 'cookies_get',
    profile: 'state',
    title: 'Get cookies',
    description: 'Read cookies, optionally narrowed by name, URL or domain.',
    inputSchema: {
      name: z.string().optional().describe('Only return the cookie with this name.'),
      url: z.string().optional().describe('Only cookies visible to this URL.'),
      domain: z.string().optional().describe('Only cookies for this domain.'),
    },
    readOnly: true,
    build: (args) => ({
      action: 'cookiesGet',
      params: { name: args.name, url: args.url, domain: args.domain },
    }),
    render: (result) => json(result.cookies),
  }),
  defineTool({
    name: 'cookies_set',
    profile: 'state',
    title: 'Set cookie',
    description: 'Create or overwrite a cookie. `url` decides the origin the cookie belongs to.',
    inputSchema: {
      url: z.string().describe('URL the cookie is scoped to, e.g. https://example.com.'),
      name: z.string().describe('Cookie name.'),
      value: z.string().describe('Cookie value.'),
      domain: z.string().optional().describe('Explicit domain, defaults to the URL host.'),
      path: z.string().optional().describe('Cookie path, defaults to "/".'),
      secure: z.boolean().optional().describe('Mark the cookie Secure.'),
      httpOnly: z.boolean().optional().describe('Mark the cookie HttpOnly.'),
      sameSite: z.enum(['no_restriction', 'lax', 'strict']).optional().describe('SameSite policy.'),
      expirationDate: z.number().optional().describe('Expiry as a Unix timestamp in seconds.'),
    },
    build: (args) => ({
      action: 'cookiesSet',
      params: {
        url: args.url,
        name: args.name,
        value: args.value,
        domain: args.domain,
        path: args.path,
        secure: args.secure,
        httpOnly: args.httpOnly,
        sameSite: args.sameSite,
        expirationDate: args.expirationDate,
      },
    }),
    render: () => text('Cookie set'),
  }),
  defineTool({
    name: 'cookies_clear',
    profile: 'state',
    title: 'Clear cookies',
    description: 'Delete cookies for a URL or domain, or all cookies when neither is given.',
    inputSchema: {
      url: z.string().optional().describe('Only clear cookies visible to this URL.'),
      domain: z.string().optional().describe('Only clear cookies for this domain.'),
    },
    destructive: true,
    build: (args) => ({ action: 'cookiesClear', params: { url: args.url, domain: args.domain } }),
    render: (result) => text(`Cleared ${result.cleared} cookies`),
  }),
  defineTool({
    name: 'storage_get',
    profile: 'state',
    title: 'Read web storage',
    description:
      'Read localStorage or sessionStorage of the current page. Returns every entry, or just one when `key` is given.',
    inputSchema: {
      key: z.string().optional().describe('Read only this key.'),
      area: z.enum(['local', 'session']).optional().describe('Storage area, default local.'),
    },
    readOnly: true,
    build: (args) => ({ action: 'storageGet', params: { key: args.key, area: args.area } }),
    render: (result) => json(result.entries),
  }),
  defineTool({
    name: 'storage_set',
    profile: 'state',
    title: 'Write web storage',
    description: 'Write one key into localStorage or sessionStorage of the current page.',
    inputSchema: {
      key: z.string().describe('Storage key.'),
      value: z.string().describe('Storage value; stringify objects yourself.'),
      area: z.enum(['local', 'session']).optional().describe('Storage area, default local.'),
    },
    build: (args) => ({
      action: 'storageSet',
      params: { key: args.key, value: args.value, area: args.area },
    }),
    render: () => text('Stored'),
  }),
  defineTool({
    name: 'storage_clear',
    profile: 'state',
    title: 'Clear web storage',
    description: 'Remove every entry from localStorage or sessionStorage of the current page.',
    inputSchema: {
      area: z.enum(['local', 'session']).optional().describe('Storage area, default local.'),
    },
    destructive: true,
    build: (args) => ({ action: 'storageClear', params: { area: args.area } }),
    render: () => text('Storage cleared'),
  }),
  defineTool({
    name: 'state_export',
    profile: 'state',
    title: 'Export browser state',
    description:
      'Capture cookies plus localStorage and sessionStorage of the current origin as one JSON object. Save it to replay a logged-in session later with `state_import`.',
    inputSchema: {},
    readOnly: true,
    build: () => ({ action: 'stateExport', params: {} }),
    render: (result) => json(result),
  }),
  defineTool({
    name: 'state_import',
    profile: 'state',
    title: 'Import browser state',
    description:
      'Restore cookies and web storage previously captured by `state_export`. Navigate to the target origin first — storage is written to the current page.',
    inputSchema: {
      cookies: z
        .array(
          z.object({
            url: z.string(),
            name: z.string(),
            value: z.string(),
            domain: z.string().optional(),
            path: z.string().optional(),
            secure: z.boolean().optional(),
            httpOnly: z.boolean().optional(),
            sameSite: z.enum(['no_restriction', 'lax', 'strict', 'unspecified']).optional(),
            expirationDate: z.number().optional(),
          }),
        )
        .optional()
        .describe('Cookies to restore, in the shape state_export returns.'),
      localStorage: z.record(z.string(), z.string()).optional().describe('localStorage entries.'),
      sessionStorage: z
        .record(z.string(), z.string())
        .optional()
        .describe('sessionStorage entries.'),
    },
    build: (args) => ({
      action: 'stateImport',
      params: {
        cookies: args.cookies,
        localStorage: args.localStorage,
        sessionStorage: args.sessionStorage,
      },
    }),
    render: (result) =>
      text(
        `Imported ${result.imported.cookies} cookies, ${result.imported.localStorage} localStorage and ${result.imported.sessionStorage} sessionStorage entries`,
      ),
  }),
];

function renderConsoleEntries(
  entries: Array<{ level: string; args: unknown[]; timestamp: number; source?: string }>,
): ToolContent[] {
  if (entries.length === 0) return text('(no entries)');
  return text(
    entries
      .map((e) => {
        const args = e.args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        return `[${e.level}]${e.source ? ` ${e.source}` : ''} ${args}`;
      })
      .join('\n'),
  );
}

const debugTools: McpTool[] = [
  defineTool({
    name: 'get_console',
    profile: 'debug',
    title: 'Read console',
    description:
      'Read the console output the page produced since it loaded. Use it to find out why an interaction did not do what you expected.',
    inputSchema: {
      level: z
        .enum(['log', 'warn', 'error', 'info', 'debug', 'pageerror'])
        .optional()
        .describe('Only entries of this level.'),
      limit: z.number().int().min(1).optional().describe('Return at most this many entries.'),
      clear: z.boolean().optional().describe('Clear the buffer after reading.'),
    },
    readOnly: true,
    build: (args) => ({
      action: 'getConsole',
      params: { level: args.level, limit: args.limit, clear: args.clear },
    }),
    render: (result) => renderConsoleEntries(result.entries),
  }),
  defineTool({
    name: 'get_errors',
    profile: 'debug',
    title: 'Read page errors',
    description:
      'Read uncaught exceptions and unhandled promise rejections from the page, with stack traces. Check this first when a page behaves oddly.',
    inputSchema: {
      limit: z.number().int().min(1).optional().describe('Return at most this many errors.'),
      clear: z.boolean().optional().describe('Clear the buffer after reading.'),
    },
    readOnly: true,
    build: (args) => ({
      action: 'getErrors',
      params: { limit: args.limit, clear: args.clear },
    }),
    render: (result) => renderConsoleEntries(result.errors),
  }),
  defineTool({
    name: 'cdp',
    profile: 'debug',
    title: 'Chrome DevTools Protocol',
    description:
      'Escape hatch: send a raw Chrome DevTools Protocol command to the active tab, e.g. "Emulation.setCPUThrottlingRate". Chrome only, attaches the debugger. Use it only when no other tool covers what you need.',
    inputSchema: {
      method: z.string().describe('CDP method name, e.g. "Network.setCacheDisabled".'),
      params: z.record(z.string(), z.unknown()).optional().describe('CDP method parameters.'),
    },
    build: (args) => ({ action: 'cdp', params: { method: args.method, params: args.params } }),
    render: (result) => json(result.result),
  }),
];

const MAX_LOG_READ_BYTES = 1024 * 1024;

const daemonLogsTool: McpTool = {
  name: 'daemon_logs',
  profile: 'debug',
  config: {
    title: 'Daemon logs',
    description:
      'Read the tail of the browser-cli daemon log. Use it when tools fail with connection or extension errors and you need to see what the daemon did.',
    inputSchema: {
      lines: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('How many trailing lines to return, default 100.'),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  run: (args) => {
    const path = getDaemonLogPath();
    if (!existsSync(path)) {
      return Promise.resolve(text(`No daemon log yet at ${path}`));
    }
    const size = statSync(path).size;
    const content = readFileSync(path)
      .subarray(Math.max(0, size - MAX_LOG_READ_BYTES))
      .toString('utf-8');
    const all = content.split('\n').filter((l) => l.length > 0);
    const count = typeof args.lines === 'number' ? args.lines : 100;
    return Promise.resolve(text(all.slice(-count).join('\n') || '(empty)'));
  },
};

const ALL_TOOLS: McpTool[] = [
  ...navigationTools,
  ...perceptionTools,
  ...interactionTools,
  ...tabTools,
  ...networkTools,
  ...stateTools,
  ...debugTools,
  daemonLogsTool,
];

/** Tools belonging to the selected profiles, in a stable order. */
export function toolsForProfiles(profiles: Set<ToolProfile>): McpTool[] {
  return ALL_TOOLS.filter((tool) => profiles.has(tool.profile));
}

export function allTools(): McpTool[] {
  return ALL_TOOLS;
}
