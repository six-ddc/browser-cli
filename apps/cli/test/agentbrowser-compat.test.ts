/**
 * AgentBrowser Compatibility Test Suite
 *
 * Verifies that browser-cli's CLI syntax matches AgentBrowser exactly.
 * Each test simulates parsing real CLI argv through Commander.js and
 * asserts the correct protocol command + params are sent to the daemon.
 *
 * Reference: https://github.com/anthropics/anthropic-quickstarts/tree/main/agent-browser
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Command } from 'commander';
import { registerCommands } from '../src/commands/index.js';

// ─── Mock sendCommand ──────────────────────────────────────────────────
// We mock the shared module so every command's action captures what it
// would have sent to the daemon, without actually connecting.

let lastCommand: { action: string; params: Record<string, unknown> } | null = null;
let sendCommandMock: Mock;
let stopDaemonMock: Mock;

vi.mock('../src/daemon/process.js', () => ({
  stopDaemon: (...args: unknown[]) => {
    stopDaemonMock(...args);
    return true;
  },
  getDaemonPid: () => null,
  startDaemon: () => Promise.resolve(12345),
  ensureDaemon: () => Promise.resolve(),
}));

vi.mock('../src/commands/shared.js', () => ({
  getRootOpts: () => ({ session: 'default', json: false }),
  sendCommand: (...args: unknown[]) => {
    sendCommandMock(...args);
    lastCommand = args[1] as { action: string; params: Record<string, unknown> };
    // Return a generic success result to prevent console.log errors
    return Promise.resolve({
      url: 'https://example.com',
      title: 'Example',
      text: 'hello',
      html: '<div>hi</div>',
      value: 'val',
      snapshot: 'tree',
      refCount: 5,
      count: 3,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      visible: true,
      enabled: true,
      checked: false,
      cookies: [],
      tabs: [],
      routes: [],
      requests: [],
      total: 0,
      cleared: 0,
      frame: { index: 0, name: null, src: 'about:blank', isMainFrame: true, isSameOrigin: true },
      currentFrame: 0,
      frames: [],
      frameIndex: 0,
      tabId: 1,
      pressed: true,
      routeId: 1,
      pattern: '*',
      action: 'block',
      // State management
      localStorage: {},
      sessionStorage: {},
      imported: { cookies: 0, localStorage: 0, sessionStorage: 0 },
      // New features
      dragged: true,
      released: true,
      moved: true,
      scrolled: true,
      found: true,
      windowId: 1,
      windows: [],
      closed: true,
      set: true,
      ruleCount: 0,
      // Tab groups
      groupId: 1,
      tabCount: 2,
      groups: [],
      ungrouped: 0,
      focused: true,
      // Bookmarks
      bookmarks: [],
      id: '1',
      removed: true,
      // History
      entries: [],
    });
  },
}));

/**
 * Helper: create a fresh Commander program and parse argv.
 * Commander calls process.exit on errors — we override that.
 */
async function parseArgs(...args: string[]): Promise<void> {
  const program = new Command().name('browser-cli').option('--json', 'JSON output').exitOverride(); // throw instead of process.exit

  registerCommands(program);

  // Suppress console output from command actions
  const origLog = console.log;
  const origErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    await program.parseAsync(['node', 'browser-cli', ...args]);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
}

function expectCommand(action: string, params: Record<string, unknown>): void {
  expect(lastCommand).not.toBeNull();
  expect(lastCommand!.action).toBe(action);
  // Check each expected param — ignore undefined values in params
  for (const [key, value] of Object.entries(params)) {
    expect(lastCommand!.params[key]).toEqual(value);
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  lastCommand = null;
  sendCommandMock = vi.fn();
  stopDaemonMock = vi.fn();
});

describe('AgentBrowser CLI syntax compatibility', () => {
  // ─── Navigation ────────────────────────────────────────────────────

  describe('navigate / goto / open', () => {
    it('navigate <url>', async () => {
      await parseArgs('navigate', 'https://example.com');
      expectCommand('navigate', { url: 'https://example.com' });
    });

    it('goto alias', async () => {
      await parseArgs('goto', 'https://example.com');
      expectCommand('navigate', { url: 'https://example.com' });
    });

    it('open alias', async () => {
      await parseArgs('open', 'https://example.com');
      expectCommand('navigate', { url: 'https://example.com' });
    });
  });

  describe('back / forward / reload', () => {
    it('back', async () => {
      await parseArgs('back');
      expectCommand('goBack', {});
    });

    it('forward', async () => {
      await parseArgs('forward');
      expectCommand('goForward', {});
    });

    it('reload', async () => {
      await parseArgs('reload');
      expectCommand('reload', {});
    });
  });

  // ─── Interaction ───────────────────────────────────────────────────

  describe('click / dblclick / hover', () => {
    it('click <selector>', async () => {
      await parseArgs('click', '#btn');
      expectCommand('click', { selector: '#btn', button: 'left' });
    });

    it('click with semantic locator', async () => {
      await parseArgs('click', 'role=button[name="Submit"]');
      expectCommand('click', { selector: 'role=button[name="Submit"]' });
    });

    it('click with element ref', async () => {
      await parseArgs('click', '@e1');
      expectCommand('click', { selector: '@e1' });
    });

    it('dblclick <selector>', async () => {
      await parseArgs('dblclick', '.item');
      expectCommand('dblclick', { selector: '.item' });
    });

    it('hover <selector>', async () => {
      await parseArgs('hover', 'text=Menu');
      expectCommand('hover', { selector: 'text=Menu' });
    });
  });

  describe('fill / type / clear / focus', () => {
    it('fill <selector> <value>', async () => {
      await parseArgs('fill', 'label=Email', 'user@example.com');
      expectCommand('fill', { selector: 'label=Email', value: 'user@example.com' });
    });

    it('fill with placeholder locator', async () => {
      await parseArgs('fill', 'placeholder=Search...', 'query');
      expectCommand('fill', { selector: 'placeholder=Search...', value: 'query' });
    });

    it('type <selector> <text>', async () => {
      await parseArgs('type', '#input', 'hello world');
      expectCommand('type', { selector: '#input', text: 'hello world' });
    });

    it('clear <selector>', async () => {
      await parseArgs('clear', '#input');
      expectCommand('clear', { selector: '#input' });
    });

    it('focus <selector>', async () => {
      await parseArgs('focus', '#input');
      expectCommand('focus', { selector: '#input' });
    });
  });

  // ─── press / key (page-level, no selector) ────────────────────────

  describe('press <key> (page-level)', () => {
    it('press Enter', async () => {
      await parseArgs('press', 'Enter');
      expectCommand('press', { key: 'Enter' });
    });

    it('press Tab', async () => {
      await parseArgs('press', 'Tab');
      expectCommand('press', { key: 'Tab' });
    });

    it('press Escape', async () => {
      await parseArgs('press', 'Escape');
      expectCommand('press', { key: 'Escape' });
    });

    it('key alias for press', async () => {
      await parseArgs('key', 'Enter');
      expectCommand('press', { key: 'Enter' });
    });

    it('press with modifier key', async () => {
      await parseArgs('press', 'Control+a');
      expectCommand('press', { key: 'Control+a' });
    });
  });

  // ─── Form commands ────────────────────────────────────────────────

  describe('check / uncheck / select', () => {
    it('check <selector>', async () => {
      await parseArgs('check', '#agree');
      expectCommand('check', { selector: '#agree' });
    });

    it('uncheck <selector>', async () => {
      await parseArgs('uncheck', '#agree');
      expectCommand('uncheck', { selector: '#agree' });
    });

    it('select <selector> <value>', async () => {
      await parseArgs('select', '#country', 'US');
      expectCommand('select', { selector: '#country', value: 'US' });
    });
  });

  // ─── Scroll ───────────────────────────────────────────────────────

  describe('scroll', () => {
    it('scroll <direction>', async () => {
      await parseArgs('scroll', 'down');
      expectCommand('scroll', { direction: 'down', amount: 400 });
    });

    it('scroll with --amount', async () => {
      await parseArgs('scroll', 'up', '--amount', '200');
      expectCommand('scroll', { direction: 'up', amount: 200 });
    });

    it('scroll with --selector', async () => {
      await parseArgs('scroll', 'down', '--selector', '.container');
      expectCommand('scroll', { direction: 'down', selector: '.container' });
    });

    it('scrollintoview <selector>', async () => {
      await parseArgs('scrollintoview', '#target');
      expectCommand('scrollIntoView', { selector: '#target' });
    });
  });

  // ─── Snapshot ─────────────────────────────────────────────────────

  describe('snapshot', () => {
    it('snapshot (bare)', async () => {
      await parseArgs('snapshot');
      expectCommand('snapshot', {});
    });

    it('snapshot -i (interactive)', async () => {
      await parseArgs('snapshot', '-i');
      expectCommand('snapshot', { interactive: true });
    });

    it('snapshot -c (compact)', async () => {
      await parseArgs('snapshot', '-c');
      expectCommand('snapshot', { compact: true });
    });

    it('snapshot -C (cursor)', async () => {
      await parseArgs('snapshot', '-C');
      expectCommand('snapshot', { cursor: true });
    });

    it('snapshot -i -c (interactive + compact)', async () => {
      await parseArgs('snapshot', '-i', '-c');
      expectCommand('snapshot', { interactive: true, compact: true });
    });

    it('snapshot -d 3 (max depth)', async () => {
      await parseArgs('snapshot', '-d', '3');
      expectCommand('snapshot', { depth: 3 });
    });

    it('snapshot -s "role=nav" (scoped)', async () => {
      await parseArgs('snapshot', '-s', 'role=nav');
      expectCommand('snapshot', { selector: 'role=nav' });
    });

    it('snapshot --interactive --compact --depth 5 --selector .main', async () => {
      await parseArgs(
        'snapshot',
        '--interactive',
        '--compact',
        '--depth',
        '5',
        '--selector',
        '.main',
      );
      expectCommand('snapshot', { interactive: true, compact: true, depth: 5, selector: '.main' });
    });
  });

  // ─── Wait ─────────────────────────────────────────────────────────

  describe('wait', () => {
    it('wait <selector> — CSS selector', async () => {
      await parseArgs('wait', '.loaded');
      expectCommand('wait', { selector: '.loaded' });
    });

    it('wait <ms> — numeric duration', async () => {
      await parseArgs('wait', '1000');
      expectCommand('wait', { duration: 1000 });
    });

    it('wait <ms> — zero duration', async () => {
      await parseArgs('wait', '0');
      expectCommand('wait', { duration: 0 });
    });

    it('wait --url <pattern>', async () => {
      await parseArgs('wait', '--url', '*/dashboard');
      expectCommand('waitForUrl', { pattern: '*/dashboard' });
    });

    it('wait <selector> --timeout 5000', async () => {
      await parseArgs('wait', '.item', '--timeout', '5000');
      expectCommand('wait', { selector: '.item', timeout: 5000 });
    });

    it('wait <selector> --hidden', async () => {
      await parseArgs('wait', '.spinner', '--hidden');
      expectCommand('wait', { selector: '.spinner', visible: false });
    });
  });

  // ─── Tab management ───────────────────────────────────────────────

  describe('tab', () => {
    it('tab (bare) — list tabs', async () => {
      await parseArgs('tab');
      expectCommand('tabList', {});
    });

    it('tab <n> — switch to tab', async () => {
      await parseArgs('tab', '2');
      expectCommand('tabSwitch', { tabId: 2 });
    });

    it('tab new <url>', async () => {
      await parseArgs('tab', 'new', 'https://github.com');
      expectCommand('tabNew', { url: 'https://github.com' });
    });

    it('tab new (no url)', async () => {
      await parseArgs('tab', 'new');
      expectCommand('tabNew', {});
    });

    it('tab list', async () => {
      await parseArgs('tab', 'list');
      expectCommand('tabList', {});
    });

    it('tab close', async () => {
      await parseArgs('tab', 'close');
      expectCommand('tabClose', {});
    });

    it('tab close <n>', async () => {
      await parseArgs('tab', 'close', '5');
      expectCommand('tabClose', { tabId: 5 });
    });
  });

  // ─── Frame management ─────────────────────────────────────────────

  describe('frame', () => {
    it('frame <selector> — switch to iframe', async () => {
      await parseArgs('frame', 'iframe#content');
      expectCommand('switchFrame', { selector: 'iframe#content' });
    });

    it('frame main — back to top', async () => {
      await parseArgs('frame', 'main');
      expectCommand('switchFrame', { main: true });
    });

    it('frame list', async () => {
      await parseArgs('frame', 'list');
      expectCommand('listFrames', {});
    });

    it('frame current', async () => {
      await parseArgs('frame', 'current');
      expectCommand('getCurrentFrame', {});
    });
  });

  // ─── Cookies ──────────────────────────────────────────────────────

  describe('cookies', () => {
    it('cookies (bare) — list all', async () => {
      await parseArgs('cookies');
      expectCommand('cookiesGet', {});
    });

    it('cookies get', async () => {
      await parseArgs('cookies', 'get');
      expectCommand('cookiesGet', {});
    });

    it('cookies get <name>', async () => {
      await parseArgs('cookies', 'get', 'session');
      expectCommand('cookiesGet', { name: 'session' });
    });

    it('cookies get --domain example.com', async () => {
      await parseArgs('cookies', 'get', '--domain', 'example.com');
      expectCommand('cookiesGet', { domain: 'example.com' });
    });

    it('cookies set <name> <value> --url <url>', async () => {
      await parseArgs('cookies', 'set', 'session', 'abc123', '--url', 'https://example.com');
      expectCommand('cookiesSet', {
        name: 'session',
        value: 'abc123',
        url: 'https://example.com',
      });
    });

    it('cookies set with all flags', async () => {
      await parseArgs(
        'cookies',
        'set',
        'token',
        'xyz',
        '--url',
        'https://example.com',
        '--domain',
        '.example.com',
        '--path',
        '/',
        '--secure',
        '--httponly',
        '--samesite',
        'lax',
      );
      expectCommand('cookiesSet', {
        name: 'token',
        value: 'xyz',
        url: 'https://example.com',
        domain: '.example.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      });
    });

    it('cookies clear', async () => {
      await parseArgs('cookies', 'clear');
      expectCommand('cookiesClear', {});
    });

    it('cookies clear --domain example.com', async () => {
      await parseArgs('cookies', 'clear', '--domain', 'example.com');
      expectCommand('cookiesClear', { domain: 'example.com' });
    });
  });

  // ─── Storage ──────────────────────────────────────────────────────

  describe('storage', () => {
    it('storage local — list all', async () => {
      await parseArgs('storage', 'local');
      expectCommand('storageGet', { area: 'local' });
    });

    it('storage local <key> — get single', async () => {
      await parseArgs('storage', 'local', 'token');
      expectCommand('storageGet', { key: 'token', area: 'local' });
    });

    it('storage local set <key> <value>', async () => {
      await parseArgs('storage', 'local', 'set', 'theme', 'dark');
      expectCommand('storageSet', { key: 'theme', value: 'dark', area: 'local' });
    });

    it('storage local clear', async () => {
      await parseArgs('storage', 'local', 'clear');
      expectCommand('storageClear', { area: 'local' });
    });

    it('storage session — list all', async () => {
      await parseArgs('storage', 'session');
      expectCommand('storageGet', { area: 'session' });
    });

    it('storage session <key>', async () => {
      await parseArgs('storage', 'session', 'cart');
      expectCommand('storageGet', { key: 'cart', area: 'session' });
    });

    it('storage session set <key> <value>', async () => {
      await parseArgs('storage', 'session', 'set', 'cart', '[]');
      expectCommand('storageSet', { key: 'cart', value: '[]', area: 'session' });
    });

    it('storage session clear', async () => {
      await parseArgs('storage', 'session', 'clear');
      expectCommand('storageClear', { area: 'session' });
    });
  });

  // ─── Network ──────────────────────────────────────────────────────

  describe('network', () => {
    it('network route <pattern> --abort', async () => {
      await parseArgs('network', 'route', '*.png', '--abort');
      expectCommand('route', { pattern: '*.png', action: 'block' });
    });

    it('network route <pattern> --redirect <url>', async () => {
      await parseArgs('network', 'route', '*/api/v1/*', '--redirect', 'https://mock.com/api');
      expectCommand('route', {
        pattern: '*/api/v1/*',
        action: 'redirect',
        redirectUrl: 'https://mock.com/api',
      });
    });

    it('network unroute <routeId>', async () => {
      await parseArgs('network', 'unroute', '1');
      expectCommand('unroute', { routeId: 1 });
    });

    it('network routes — list', async () => {
      await parseArgs('network', 'routes');
      expectCommand('getRoutes', {});
    });

    it('network requests', async () => {
      await parseArgs('network', 'requests');
      expectCommand('getRequests', {});
    });

    it('network requests --pattern *.js --blocked', async () => {
      await parseArgs('network', 'requests', '--pattern', '*.js', '--blocked');
      expectCommand('getRequests', { pattern: '*.js', blockedOnly: true });
    });

    it('network clear', async () => {
      await parseArgs('network', 'clear');
      expectCommand('clearRequests', {});
    });
  });

  // ─── Get (data queries) ───────────────────────────────────────────

  describe('get', () => {
    it('get url', async () => {
      await parseArgs('get', 'url');
      expectCommand('getUrl', {});
    });

    it('get title', async () => {
      await parseArgs('get', 'title');
      expectCommand('getTitle', {});
    });

    it('get text <selector>', async () => {
      await parseArgs('get', 'text', '.heading');
      expectCommand('getText', { selector: '.heading' });
    });

    it('get html <selector>', async () => {
      await parseArgs('get', 'html', '.content');
      expectCommand('getHtml', { selector: '.content' });
    });

    it('get html <selector> --outer', async () => {
      await parseArgs('get', 'html', '.content', '--outer');
      expectCommand('getHtml', { selector: '.content', outer: true });
    });

    it('get value <selector>', async () => {
      await parseArgs('get', 'value', '#email');
      expectCommand('getValue', { selector: '#email' });
    });

    it('get attr <selector> <attribute>', async () => {
      await parseArgs('get', 'attr', '#link', 'href');
      expectCommand('getAttribute', { selector: '#link', attribute: 'href' });
    });

    it('get count <selector>', async () => {
      await parseArgs('get', 'count', '.item');
      expectCommand('count', { selector: '.item' });
    });

    it('get box <selector>', async () => {
      await parseArgs('get', 'box', '#element');
      expectCommand('boundingBox', { selector: '#element' });
    });
  });

  // ─── is (state queries) ───────────────────────────────────────────

  describe('is', () => {
    it('is visible <selector>', async () => {
      await parseArgs('is', 'visible', '#modal');
      expectCommand('isVisible', { selector: '#modal' });
    });

    it('is enabled <selector>', async () => {
      await parseArgs('is', 'enabled', '#submit');
      expectCommand('isEnabled', { selector: '#submit' });
    });

    it('is checked <selector>', async () => {
      await parseArgs('is', 'checked', '#agree');
      expectCommand('isChecked', { selector: '#agree' });
    });
  });

  // ─── Find (AgentBrowser-compatible) ───────────────────────────────

  describe('find', () => {
    it('find role button click', async () => {
      await parseArgs('find', 'role', 'button', 'click');
      expectCommand('click', { selector: 'role=button', button: 'left' });
    });

    it('find role button click --name "Submit"', async () => {
      await parseArgs('find', 'role', 'button', 'click', '--name', 'Submit');
      expectCommand('click', { selector: 'role=button[name="Submit"]', button: 'left' });
    });

    it('find role button --name "Submit" (default click)', async () => {
      await parseArgs('find', 'role', 'button', '--name', 'Submit');
      expectCommand('click', { selector: 'role=button[name="Submit"]', button: 'left' });
    });

    it('find text "Sign In" (default click)', async () => {
      await parseArgs('find', 'text', 'Sign In');
      expectCommand('click', { selector: 'text=Sign In', button: 'left' });
    });

    it('find label Email fill user@test.com', async () => {
      await parseArgs('find', 'label', 'Email', 'fill', 'user@test.com');
      expectCommand('fill', { selector: 'label=Email', value: 'user@test.com' });
    });

    it('find placeholder Search... fill query', async () => {
      await parseArgs('find', 'placeholder', 'Search...', 'fill', 'query');
      expectCommand('fill', { selector: 'placeholder=Search...', value: 'query' });
    });

    it('find testid login-btn click', async () => {
      await parseArgs('find', 'testid', 'login-btn', 'click');
      expectCommand('click', { selector: 'testid=login-btn', button: 'left' });
    });

    it('find xpath //button[@type="submit"] click', async () => {
      await parseArgs('find', 'xpath', '//button[@type="submit"]', 'click');
      expectCommand('click', { selector: 'xpath=//button[@type="submit"]', button: 'left' });
    });

    it('find first .item click', async () => {
      await parseArgs('find', 'first', '.item', 'click');
      expectCommand('click', { selector: '.item', button: 'left' });
    });

    it('find last .item click', async () => {
      await parseArgs('find', 'last', '.item', 'click');
      expectCommand('click', { selector: '.item', button: 'left' });
    });

    it('find nth 2 .item click', async () => {
      await parseArgs('find', 'nth', '2', '.item', 'click');
      expectCommand('click', { selector: '.item', button: 'left' });
    });

    it('find role textbox fill hello --name Email', async () => {
      await parseArgs('find', 'role', 'textbox', 'fill', 'hello', '--name', 'Email');
      expectCommand('fill', { selector: 'role=textbox[name="Email"]', value: 'hello' });
    });

    it('find text Submit hover', async () => {
      await parseArgs('find', 'text', 'Submit', 'hover');
      expectCommand('hover', { selector: 'text=Submit' });
    });

    it('find role checkbox check --name "Agree"', async () => {
      await parseArgs('find', 'role', 'checkbox', 'check', '--name', 'Agree');
      expectCommand('check', { selector: 'role=checkbox[name="Agree"]' });
    });

    it('find text Submit (no action = default click)', async () => {
      await parseArgs('find', 'text', 'Submit');
      expectCommand('click', { selector: 'text=Submit', button: 'left' });
    });

    it('find role button --exact', async () => {
      await parseArgs('find', 'role', 'button', '--exact');
      expectCommand('click', { selector: 'role=button[exact]', button: 'left' });
    });

    it('find text Submit --exact (wraps in quotes)', async () => {
      await parseArgs('find', 'text', 'Submit', '--exact');
      expectCommand('click', { selector: 'text="Submit"', button: 'left' });
    });
  });

  // ─── Semantic locators in standard commands ───────────────────────

  describe('semantic locators used in standard commands', () => {
    it('click with text= locator', async () => {
      await parseArgs('click', 'text=Sign In');
      expectCommand('click', { selector: 'text=Sign In' });
    });

    it('click with role= locator', async () => {
      await parseArgs('click', 'role=button[name="Submit"]');
      expectCommand('click', { selector: 'role=button[name="Submit"]' });
    });

    it('fill with label= locator', async () => {
      await parseArgs('fill', 'label=Password', 'secret123');
      expectCommand('fill', { selector: 'label=Password', value: 'secret123' });
    });

    it('fill with placeholder= locator', async () => {
      await parseArgs('fill', 'placeholder=Search...', 'query');
      expectCommand('fill', { selector: 'placeholder=Search...', value: 'query' });
    });

    it('hover with title= locator', async () => {
      await parseArgs('hover', 'title=Help Center');
      expectCommand('hover', { selector: 'title=Help Center' });
    });

    it('click with testid= locator', async () => {
      await parseArgs('click', 'testid=login-button');
      expectCommand('click', { selector: 'testid=login-button' });
    });

    it('click with xpath= locator', async () => {
      await parseArgs('click', 'xpath=//button[@type="submit"]');
      expectCommand('click', { selector: 'xpath=//button[@type="submit"]' });
    });

    it('click with alt= locator', async () => {
      await parseArgs('click', 'alt=Company Logo');
      expectCommand('click', { selector: 'alt=Company Logo' });
    });

    it('wait with semantic locator', async () => {
      await parseArgs('wait', 'text=Loading');
      expectCommand('wait', { selector: 'text=Loading' });
    });

    it('get text with semantic locator', async () => {
      await parseArgs('get', 'text', 'role=heading');
      expectCommand('getText', { selector: 'role=heading' });
    });
  });

  // ─── Element refs (@e1) in commands ───────────────────────────────

  describe('element refs (@e1, @e2, etc.)', () => {
    it('click @e1', async () => {
      await parseArgs('click', '@e1');
      expectCommand('click', { selector: '@e1' });
    });

    it('fill @e5 value', async () => {
      await parseArgs('fill', '@e5', 'test@example.com');
      expectCommand('fill', { selector: '@e5', value: 'test@example.com' });
    });

    it('hover @e3', async () => {
      await parseArgs('hover', '@e3');
      expectCommand('hover', { selector: '@e3' });
    });

    it('get text @e2', async () => {
      await parseArgs('get', 'text', '@e2');
      expectCommand('getText', { selector: '@e2' });
    });

    it('get count @e1', async () => {
      await parseArgs('get', 'count', '@e1');
      expectCommand('count', { selector: '@e1' });
    });
  });

  // ─── Drag and Drop ─────────────────────────────────────────────────

  describe('drag', () => {
    it('drag <source> <target>', async () => {
      await parseArgs('drag', '#item', '#dropzone');
      expectCommand('drag', { source: '#item', target: '#dropzone' });
    });

    it('drag with semantic locators', async () => {
      await parseArgs('drag', 'text=Card', 'text=Column B');
      expectCommand('drag', { source: 'text=Card', target: 'text=Column B' });
    });

    it('drag with @refs', async () => {
      await parseArgs('drag', '@e1', '@e5');
      expectCommand('drag', { source: '@e1', target: '@e5' });
    });
  });

  // ─── Key down/up ──────────────────────────────────────────────────

  describe('keydown / keyup', () => {
    it('keydown <key>', async () => {
      await parseArgs('keydown', 'Shift');
      expectCommand('keydown', { key: 'Shift' });
    });

    it('keyup <key>', async () => {
      await parseArgs('keyup', 'Shift');
      expectCommand('keyup', { key: 'Shift' });
    });

    it('keydown Control', async () => {
      await parseArgs('keydown', 'Control');
      expectCommand('keydown', { key: 'Control' });
    });

    it('keyup Control', async () => {
      await parseArgs('keyup', 'Control');
      expectCommand('keyup', { key: 'Control' });
    });
  });

  // ─── Mouse control ───────────────────────────────────────────────

  describe('mouse', () => {
    it('mouse move <x> <y>', async () => {
      await parseArgs('mouse', 'move', '100', '200');
      expectCommand('mouseMove', { x: 100, y: 200 });
    });

    it('mouse down', async () => {
      await parseArgs('mouse', 'down');
      expectCommand('mouseDown', {});
    });

    it('mouse down right', async () => {
      await parseArgs('mouse', 'down', 'right');
      expectCommand('mouseDown', { button: 'right' });
    });

    it('mouse up', async () => {
      await parseArgs('mouse', 'up');
      expectCommand('mouseUp', {});
    });

    it('mouse up left', async () => {
      await parseArgs('mouse', 'up', 'left');
      expectCommand('mouseUp', { button: 'left' });
    });

    it('mouse wheel <deltaY>', async () => {
      await parseArgs('mouse', 'wheel', '100');
      expectCommand('mouseWheel', { deltaY: 100 });
    });

    it('mouse wheel <deltaY> <deltaX>', async () => {
      await parseArgs('mouse', 'wheel', '100', '50');
      expectCommand('mouseWheel', { deltaY: 100, deltaX: 50 });
    });
  });

  // ─── Wait extensions ─────────────────────────────────────────────

  describe('wait extensions', () => {
    it('wait --text <text>', async () => {
      await parseArgs('wait', '--text', 'Loading complete');
      expectCommand('wait', { text: 'Loading complete' });
    });

    it('wait --load', async () => {
      await parseArgs('wait', '--load');
      expectCommand('wait', { load: 'load' });
    });

    it('wait --load domcontentloaded', async () => {
      await parseArgs('wait', '--load', 'domcontentloaded');
      expectCommand('wait', { load: 'domcontentloaded' });
    });

    it('wait --load networkidle', async () => {
      await parseArgs('wait', '--load', 'networkidle');
      expectCommand('wait', { load: 'networkidle' });
    });

    it('wait --fn <expression>', async () => {
      await parseArgs('wait', '--fn', 'window.ready === true');
      expectCommand('wait', { fn: 'window.ready === true' });
    });
  });

  // ─── Window management ───────────────────────────────────────────

  describe('window', () => {
    it('window (bare) — list windows', async () => {
      await parseArgs('window');
      expectCommand('windowList', {});
    });

    it('window new', async () => {
      await parseArgs('window', 'new');
      expectCommand('windowNew', {});
    });

    it('window new <url>', async () => {
      await parseArgs('window', 'new', 'https://example.com');
      expectCommand('windowNew', { url: 'https://example.com' });
    });

    it('window list', async () => {
      await parseArgs('window', 'list');
      expectCommand('windowList', {});
    });

    it('window close', async () => {
      await parseArgs('window', 'close');
      expectCommand('windowClose', {});
    });

    it('window close <windowId>', async () => {
      await parseArgs('window', 'close', '42');
      expectCommand('windowClose', { windowId: 42 });
    });
  });

  // ─── Browser config (set) ────────────────────────────────────────

  describe('set', () => {
    it('set viewport <width> <height>', async () => {
      await parseArgs('set', 'viewport', '1920', '1080');
      expectCommand('setViewport', { width: 1920, height: 1080 });
    });

    it('set geo <lat> <lng>', async () => {
      await parseArgs('set', 'geo', '37.7749', '-122.4194');
      expectCommand('setGeo', { latitude: 37.7749, longitude: -122.4194 });
    });

    it('set geo with --accuracy', async () => {
      await parseArgs('set', 'geo', '51.5074', '-0.1278', '--accuracy', '50');
      expectCommand('setGeo', { latitude: 51.5074, longitude: -0.1278, accuracy: 50 });
    });

    it('set media dark', async () => {
      await parseArgs('set', 'media', 'dark');
      expectCommand('setMedia', { colorScheme: 'dark' });
    });

    it('set media light', async () => {
      await parseArgs('set', 'media', 'light');
      expectCommand('setMedia', { colorScheme: 'light' });
    });

    it('set headers <json>', async () => {
      await parseArgs('set', 'headers', '{"X-Custom":"value"}');
      expectCommand('setHeaders', { headers: { 'X-Custom': 'value' } });
    });
  });

  // ─── Tab groups ────────────────────────────────────────────────────

  describe('tab group', () => {
    it('tab group <tabIds...> — create group', async () => {
      await parseArgs('tab', 'group', '1', '2', '3');
      expectCommand('tabGroupCreate', { tabIds: [1, 2, 3] });
    });

    it('tab group update <groupId> --title --color', async () => {
      await parseArgs('tab', 'group', 'update', '5', '--title', 'Work', '--color', 'blue');
      expectCommand('tabGroupUpdate', { groupId: 5, title: 'Work', color: 'blue' });
    });

    it('tab group update <groupId> --collapse', async () => {
      await parseArgs('tab', 'group', 'update', '5', '--collapse');
      expectCommand('tabGroupUpdate', { groupId: 5, collapsed: true });
    });

    it('tab group update <groupId> --expand', async () => {
      await parseArgs('tab', 'group', 'update', '5', '--expand');
      expectCommand('tabGroupUpdate', { groupId: 5, collapsed: false });
    });

    it('tab groups — list groups', async () => {
      await parseArgs('tab', 'groups');
      expectCommand('tabGroupList', {});
    });

    it('tab ungroup <tabIds...>', async () => {
      await parseArgs('tab', 'ungroup', '1', '2');
      expectCommand('tabUngroup', { tabIds: [1, 2] });
    });
  });

  // ─── Window focus ──────────────────────────────────────────────────

  describe('window focus', () => {
    it('window focus (bare) — focus current window', async () => {
      await parseArgs('window', 'focus');
      expectCommand('windowFocus', {});
    });

    it('window focus <windowId>', async () => {
      await parseArgs('window', 'focus', '42');
      expectCommand('windowFocus', { windowId: 42 });
    });
  });

  // ─── Bookmarks ────────────────────────────────────────────────────

  describe('bookmark', () => {
    it('bookmark (bare) — list all bookmarks', async () => {
      await parseArgs('bookmark');
      expectCommand('bookmarkList', {});
    });

    it('bookmark <search> — search bookmarks', async () => {
      await parseArgs('bookmark', 'github');
      expectCommand('bookmarkList', { query: 'github' });
    });

    it('bookmark add <url>', async () => {
      await parseArgs('bookmark', 'add', 'https://example.com');
      expectCommand('bookmarkAdd', { url: 'https://example.com' });
    });

    it('bookmark add <url> <title>', async () => {
      await parseArgs('bookmark', 'add', 'https://example.com', 'Example Site');
      expectCommand('bookmarkAdd', { url: 'https://example.com', title: 'Example Site' });
    });

    it('bookmark remove <id>', async () => {
      await parseArgs('bookmark', 'remove', '42');
      expectCommand('bookmarkRemove', { id: '42' });
    });
  });

  // ─── History ──────────────────────────────────────────────────────

  describe('history', () => {
    it('history (bare) — list recent history', async () => {
      await parseArgs('history');
      expectCommand('historySearch', { text: '', limit: 20 });
    });

    it('history --limit 5', async () => {
      await parseArgs('history', '--limit', '5');
      expectCommand('historySearch', { text: '', limit: 5 });
    });

    it('history search <text>', async () => {
      await parseArgs('history', 'search', 'github');
      expectCommand('historySearch', { text: 'github', limit: 20 });
    });

    it('history --limit 50 search <text>', async () => {
      await parseArgs('history', '--limit', '50', 'search', 'example');
      expectCommand('historySearch', { text: 'example', limit: 50 });
    });
  });

  // ─── Close / Quit / Exit ────────────────────────────────────────────

  describe('close / quit / exit', () => {
    it('close — stops daemon', async () => {
      await parseArgs('close');
      expect(stopDaemonMock).toHaveBeenCalled();
    });

    it('quit — alias for close', async () => {
      await parseArgs('quit');
      expect(stopDaemonMock).toHaveBeenCalled();
    });

    it('exit — alias for close', async () => {
      await parseArgs('exit');
      expect(stopDaemonMock).toHaveBeenCalled();
    });
  });

  // ─── State save/load ──────────────────────────────────────────────

  describe('state', () => {
    it('state save <path>', async () => {
      await parseArgs('state', 'save', '/tmp/test-state.json');
      expectCommand('stateExport', {});
    });

    it('state load <path>', async () => {
      // Create a temp state file for the load command to read
      const { writeFileSync } = await import('node:fs');
      const tmpPath = '/tmp/test-state-load.json';
      writeFileSync(
        tmpPath,
        JSON.stringify({
          version: 1,
          timestamp: new Date().toISOString(),
          url: 'https://example.com',
          cookies: [],
          localStorage: { key: 'value' },
          sessionStorage: {},
        }),
      );

      await parseArgs('state', 'load', tmpPath);
      expectCommand('stateImport', {
        cookies: [],
        localStorage: { key: 'value' },
        sessionStorage: {},
      });
    });
  });

  // ─── Eval enhancements ────────────────────────────────────────────

  describe('eval', () => {
    it('eval <expression>', async () => {
      await parseArgs('eval', 'document.title');
      expectCommand('evaluate', { expression: 'document.title' });
    });

    it('eval -b <base64>', async () => {
      const encoded = Buffer.from('document.title').toString('base64');
      await parseArgs('eval', '-b', encoded);
      expectCommand('evaluate', { expression: 'document.title' });
    });

    it('eval --base64 <base64>', async () => {
      const encoded = Buffer.from('1 + 2').toString('base64');
      await parseArgs('eval', '--base64', encoded);
      expectCommand('evaluate', { expression: '1 + 2' });
    });
  });

  // ─── Combined flags & edge cases ──────────────────────────────────

  describe('edge cases', () => {
    it('selector with spaces (CSS)', async () => {
      await parseArgs('click', 'div.container > button.submit');
      expectCommand('click', { selector: 'div.container > button.submit' });
    });

    it('fill value with spaces', async () => {
      await parseArgs('fill', '#name', 'John Doe');
      expectCommand('fill', { selector: '#name', value: 'John Doe' });
    });

    it('type value with special characters', async () => {
      await parseArgs('type', '#search', 'test@example.com');
      expectCommand('type', { selector: '#search', text: 'test@example.com' });
    });

    it('navigate with query params', async () => {
      await parseArgs('navigate', 'https://example.com/search?q=test&page=1');
      expectCommand('navigate', { url: 'https://example.com/search?q=test&page=1' });
    });

    it('wait with --url containing wildcards', async () => {
      await parseArgs('wait', '--url', '*/api/v2/*');
      expectCommand('waitForUrl', { pattern: '*/api/v2/*' });
    });
  });
});
