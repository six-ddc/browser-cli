import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_DIR } from '../helpers/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../../apps/cli/bin/cli.js');
const EXTENSION_PATH = path.resolve(
  __dirname,
  '../../../apps/extension/.output/chrome-mv3',
);

// Strip ANSI escape codes from CLI output
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

// Env vars: disable color output + point CLI to the E2E isolated directory
const CLI_ENV = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', BROWSER_CLI_DIR: E2E_DIR };

export interface BcliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export type BcliFn = (...args: string[]) => BcliResult;

export const test = base.extend<
  // test-scoped
  {
    bcli: BcliFn;
    navigateAndWait: (url: string) => Promise<void>;
    baseURL: string;
    _autoCleanup: void;
  },
  // worker-scoped
  { extensionContext: BrowserContext; activePage: Page }
>({
  // ── worker-scoped: entire worker lifecycle starts one browser ──
  extensionContext: [
    async ({}, use) => {
      const headless = process.env.HEADLESS !== '0';
      const profileDir = path.resolve(__dirname, '../../../.e2e-chrome-profile');

      // Write Chrome Preferences to disable password manager popups
      const defaultDir = path.join(profileDir, 'Default');
      if (!existsSync(defaultDir)) mkdirSync(defaultDir, { recursive: true });
      const prefs = {
        credentials_enable_service: false,
        profile: { password_manager_enabled: false, password_manager_leak_detection: false },
        password_manager: { leak_detection: false },
        safebrowsing: { enabled: false },
      };
      writeFileSync(path.join(defaultDir, 'Preferences'), JSON.stringify(prefs));

      const ctx = await chromium.launchPersistentContext(profileDir, {
        headless: false, // Playwright's built-in headless doesn't support extensions
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`,
          '--no-first-run',
          '--disable-default-apps',
          '--disable-popup-blocking',
          '--disable-features=PasswordLeakDetection,PasswordCheck,TranslateUI,CredentialLeakDetection,SafeBrowsingEnhancedProtection',
          '--disable-save-password-bubble',
          '--password-store=basic',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--disable-translate',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-component-update',
          ...(headless ? ['--headless=new'] : []),
        ],
        viewport: { width: 1280, height: 720 },
      });

      // Wait for extension to connect to daemon (up to 30s)
      // The extension's WS port is baked in at build time via VITE_WS_PORT
      await waitForExtensionConnection(30_000);
      await use(ctx);
      await ctx.close();
    },
    { scope: 'worker' },
  ],

  activePage: [
    async ({ extensionContext }, use) => {
      const page =
        extensionContext.pages()[0] || (await extensionContext.newPage());
      await use(page);
    },
    { scope: 'worker' },
  ],

  // ── test-scoped ──
  baseURL: async ({}, use) => {
    await use('http://localhost:4173');
  },

  bcli: async ({ extensionContext: _ctx }, use) => {
    const fn: BcliFn = (...args) => {
      try {
        const stdout = execFileSync(
          'node',
          [CLI_BIN, ...args],
          { encoding: 'utf-8', timeout: 15_000, env: CLI_ENV },
        );
        return { stdout: stripAnsi(stdout.trim()), stderr: '', exitCode: 0, success: true };
      } catch (err: unknown) {
        const e = err as {
          stdout?: Buffer | string;
          stderr?: Buffer | string;
          status?: number;
        };
        return {
          stdout: stripAnsi((e.stdout ?? '').toString().trim()),
          stderr: stripAnsi((e.stderr ?? '').toString().trim()),
          exitCode: e.status ?? 1,
          success: false,
        };
      }
    };
    await use(fn);
  },

  // Auto-cleanup: reset browser state between tests to prevent leakage
  _autoCleanup: [
    async ({ bcli }, use) => {
      // Clean before each test
      try { bcli('cookies', 'clear'); } catch { /* ignore if daemon not ready */ }
      try { bcli('storage', 'local', 'clear'); } catch { /* ignore */ }
      try { bcli('storage', 'session', 'clear'); } catch { /* ignore */ }
      await use();
    },
    { auto: true },
  ],

  navigateAndWait: async ({ bcli, activePage, baseURL }, use) => {
    const fn = async (urlOrPath: string) => {
      const url = urlOrPath.startsWith('http')
        ? urlOrPath
        : `${baseURL}/${urlOrPath}`;
      const result = bcli('navigate', url);
      if (!result.success) {
        throw new Error(`navigate failed: ${result.stderr || result.stdout}`);
      }
      // serve strips .html → 301 redirect, so final URL may differ from requested.
      // Wait for URL to contain the path portion (without .html).
      // If activePage is detached (e.g. after window/tab operations), skip the wait —
      // the CLI navigate already confirmed success.
      try {
        const urlObj = new URL(url);
        const targetPath = urlObj.pathname.replace(/\.html$/, '');
        await activePage.waitForURL(
          (u) => new URL(u).pathname.startsWith(targetPath),
          { timeout: 10_000 },
        );
        await activePage.waitForLoadState('domcontentloaded');
      } catch {
        // activePage may be detached after window/tab CLI operations — that's OK
      }
    };
    await use(fn);
  },
});

async function waitForExtensionConnection(timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const out = execFileSync(
        'node',
        [CLI_BIN, 'status'],
        { encoding: 'utf-8', timeout: 5_000, env: CLI_ENV },
      );
      if (/Browsers connected/i.test(out)) return;
    } catch {
      // Ignore — daemon may not be ready yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Extension not connected after ${timeoutMs}ms`);
}
