import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../../apps/cli/bin/cli.js');
const EXTENSION_PATH = path.resolve(
  __dirname,
  '../../../apps/extension/.output/chrome-mv3',
);
const SESSION = 'e2e-pw';

// Strip ANSI escape codes from CLI output
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, '');

// Env vars to disable color output from Node.js / CLI
const CLI_ENV = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };

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
  },
  // worker-scoped
  { extensionContext: BrowserContext; activePage: Page }
>({
  // ── worker-scoped: entire worker lifecycle starts one browser ──
  extensionContext: [
    async ({}, use) => {
      const ctx = await chromium.launchPersistentContext(
        path.resolve(__dirname, '../../../.e2e-chrome-profile'),
        {
          headless: false,
          args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
            '--no-first-run',
            '--disable-default-apps',
            '--disable-popup-blocking',
          ],
          viewport: { width: 1280, height: 720 },
        },
      );
      // Wait for extension to connect to daemon (up to 30s)
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
          [CLI_BIN, '--session', SESSION, ...args],
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
        [CLI_BIN, 'status', '--session', SESSION],
        { encoding: 'utf-8', timeout: 5_000 },
      );
      if (/extension.*connected|connected.*extension/i.test(out)) return;
    } catch {
      // Ignore — daemon may not be ready yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Extension not connected after ${timeoutMs}ms`);
}
