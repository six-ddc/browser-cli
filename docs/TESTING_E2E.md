# Playwright E2E Testing Guide

Automated end-to-end tests for browser-cli using [Playwright](https://playwright.dev/). These tests exercise the full CLI → Daemon → Extension pipeline against a real Chrome browser with the extension loaded.

## Architecture

```
Playwright test runner
  │
  ├─ globalSetup:  Rebuild extension (VITE_WS_PORT=19222)
  │                Start daemon (--port 19222, BROWSER_CLI_DIR=/tmp/browser-cli-e2e)
  ├─ webServer:    Serve test/e2e-pw/pages/ → localhost:4173
  ├─ worker fixture: chromium.launchPersistentContext (load Extension)
  │                  Wait for Extension to connect to Daemon
  │
  │   ┌─── Each test ──────────────────────────────────────┐
  │   │ bcli('navigate', url)  ← execFileSync CLI          │
  │   │         ↓                                           │
  │   │ CLI → Daemon → Extension → Browser                  │
  │   │         ↓                                           │
  │   │ expect(page.locator(...)).toHaveValue(...)          │ ← Playwright verification
  │   └────────────────────────────────────────────────────┘
  │
  └─ globalTeardown: Stop daemon, clean up temp dir
```

Key design decisions:
- **CLI is the operator**: All browser actions go through the CLI (testing the full pipeline)
- **Playwright provides verification**: Independent browser state assertions via Playwright locators
- **Local HTML fixtures**: No external dependencies — all test pages served locally
- **Extension auto-loaded**: Playwright launches Chrome with `--load-extension` (works in CI)

### E2E Isolation

E2E tests are fully isolated from a user's running daemon via two mechanisms:

| Layer | Mechanism | Detail |
|-------|-----------|--------|
| **Socket / PID files** | `BROWSER_CLI_DIR` env var | Points to `/tmp/browser-cli-e2e/` instead of `~/.browser-cli/` |
| **WS port (daemon)** | `start --port 19222` | Daemon binds to a non-default port |
| **WS port (extension)** | `VITE_WS_PORT=19222` at build time | Baked into extension via Vite `import.meta.env` |

All E2E constants (`E2E_WS_PORT`, `E2E_DIR`) are defined in `test/e2e-pw/helpers/constants.ts` and imported by global-setup, fixtures, and test files.

The `global-setup` rebuilds the extension with `VITE_WS_PORT=19222` before starting the daemon. This ensures the extension connects to the E2E daemon on port 19222 immediately on startup, with no runtime configuration needed.

## Prerequisites

### 1. System Requirements

- **Node.js >= 20** (required by WXT + Vite 7)
- **pnpm** (package manager)

### 2. Install Dependencies

```bash
pnpm install
```

This installs `@playwright/test` and `serve` as dev dependencies.

### 3. Install Playwright Browsers

```bash
npx playwright install chromium --with-deps
```

### 4. Build the Project

```bash
pnpm build
```

This builds the CLI (tsdown), extension (WXT + Vite), and shared package. The E2E global-setup will rebuild the extension with the E2E WS port automatically.

## Test Directory Structure

```
test/e2e-pw/
├── playwright.config.ts          # Playwright configuration
├── tsconfig.json                 # E2E TypeScript configuration
├── global-setup.ts               # Extension rebuild + daemon startup
├── global-teardown.ts            # Daemon shutdown + temp dir cleanup
├── fixtures/
│   ├── bcli.ts                   # Core fixture: bcli() + context + page
│   └── index.ts                  # Unified exports: test, expect
├── helpers/
│   ├── constants.ts              # Page paths, selectors, E2E_WS_PORT, E2E_DIR
│   └── assertions.ts             # Custom expect matchers
├── pages/                        # Local HTML fixture pages (~28 files)
│   ├── home.html
│   ├── login.html
│   ├── checkboxes.html
│   └── ...
├── basic/                        # Basic command tests
│   ├── 01-navigation.spec.ts
│   ├── 02-interaction.spec.ts
│   ├── 03-selectors.spec.ts
│   ├── 04-snapshot.spec.ts
│   ├── 05-tab-management.spec.ts
│   ├── 06-frame-management.spec.ts
│   ├── 07-scroll.spec.ts
│   ├── 08-window-management.spec.ts
│   └── 09-shadow-dom.spec.ts
├── advanced/                     # Advanced feature tests
│   ├── 10-find-command.spec.ts
│   ├── 11-semantic-locators.spec.ts
│   ├── 12-element-refs.spec.ts
│   ├── 13-position-selectors.spec.ts
│   ├── 14-screenshot.spec.ts
│   ├── 15-eval.spec.ts
│   ├── 16-dialog.spec.ts
│   ├── 17-highlight.spec.ts
│   ├── 18-upload-drag.spec.ts
│   └── 19-mouse-keydown.spec.ts
├── data/                         # Data query tests
│   ├── 20-get-commands.spec.ts
│   ├── 21-is-commands.spec.ts
│   ├── 22-wait-commands.spec.ts
│   ├── 23-dynamic-state.spec.ts
│   └── 24-tables-and-content.spec.ts
├── state/                        # State management tests
│   ├── 30-cookies.spec.ts
│   ├── 31-storage.spec.ts
│   ├── 32-network.spec.ts
│   ├── 33-console-errors.spec.ts
│   ├── 34-state-management.spec.ts
│   └── 35-browser-config.spec.ts
└── cross/                        # Cross-command tests
    ├── 40-cross-command.spec.ts
    ├── 41-global-options.spec.ts
    ├── 42-json-coverage.spec.ts
    ├── 43-error-handling.spec.ts
    └── 44-lifecycle-commands.spec.ts
```

## Running Tests

### Run All E2E Tests

```bash
pnpm test:e2e
```

### Run by Category

```bash
pnpm test:e2e:basic      # Navigation, interaction, selectors, snapshot, tabs, frames, scroll, windows
pnpm test:e2e:advanced   # Find, semantic locators, refs, position, screenshot, eval, dialog, highlight, upload, mouse
pnpm test:e2e:data       # get, is, wait commands
pnpm test:e2e:state      # Cookies, storage, network, console, state mgmt, browser config
pnpm test:e2e:cross      # Cross-command interactions, --json flag, lifecycle, error handling
```

### Run a Single File

```bash
npx playwright test --config test/e2e-pw/playwright.config.ts basic/01-navigation.spec.ts
```

### Run by Test Name

```bash
npx playwright test --config test/e2e-pw/playwright.config.ts -g "fill"
```

### Debug Mode (Headed + Inspector)

```bash
HEADLESS=0 npx playwright test --config test/e2e-pw/playwright.config.ts --debug basic/01-navigation.spec.ts
```

### View HTML Report

```bash
npx playwright show-report test/e2e-pw/playwright-report
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('navigate command', () => {
  test('loads a page and returns title + URL', async ({ bcli, baseURL }) => {
    const r = bcli('navigate', `${baseURL}/${PAGES.HOME}`);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('localhost');
  });

  test('URL is correct after navigation', async ({ navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.LOGIN);
    expect(activePage.url()).toContain('/login');
  });
});
```

### Available Fixtures

| Fixture | Scope | Description |
|---------|-------|-------------|
| `bcli` | test | CLI wrapper: `bcli('navigate', url)` returns `{ stdout, stderr, exitCode, success }` |
| `navigateAndWait` | test | Navigate via CLI + wait for page load: `await navigateAndWait(PAGES.LOGIN)` |
| `activePage` | worker | Playwright Page with extension loaded |
| `extensionContext` | worker | Persistent browser context with extension |
| `baseURL` | test | `http://localhost:4173` (local fixture server) |

All CLI calls include `BROWSER_CLI_DIR` in the environment, so they connect to the isolated E2E daemon automatically.

### Custom Matchers

```typescript
expect(result).toBcliSuccess();           // exitCode === 0
expect(result).toBcliFailure();           // exitCode !== 0
expect(result).toContainOutput('text');   // stdout or stderr includes text
```

### Dual Verification Pattern

The key architectural pattern: **CLI operates, Playwright verifies**.

```typescript
test('fill sets input value', async ({ bcli, navigateAndWait, activePage }) => {
  await navigateAndWait(PAGES.LOGIN);

  // CLI operates
  const r = bcli('fill', '#username', 'testuser');
  expect(r).toBcliSuccess();
  expect(r.stdout).toContain('Filled');

  // Playwright verifies independently
  await expect(activePage.locator('#username')).toHaveValue('testuser');
});
```

### Lifecycle Tests

Lifecycle tests (`cross/44-lifecycle-commands.spec.ts`) test `start`/`stop`/`status`/`close` commands. They start and stop their own daemon instances using the same `BROWSER_CLI_DIR` and `E2E_WS_PORT`. Since tests run sequentially (`workers: 1`) and lifecycle tests are in the last file (44-*), they run after all other tests that depend on a running daemon.

## CI/CD Integration

The GitHub Actions CI workflow runs E2E tests automatically:

```yaml
e2e:
  runs-on: ubuntu-latest
  needs: ci
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: npx playwright install chromium --with-deps
    - run: pnpm turbo build
    - name: Run E2E tests
      run: xvfb-run --auto-servernum pnpm test:e2e
      env: { CI: true }
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: |
          test/e2e-pw/playwright-report/
          test/e2e-pw/test-results/
```

Key CI features:
- `xvfb-run` provides virtual display (extension requires headed mode)
- `npx playwright install chromium --with-deps` installs browser + OS deps
- Auto-retry on first failure (`retries: 1` in CI)
- Trace, screenshot, and video captured on failure
- HTML report uploaded as artifact

## Troubleshooting

### "Extension not connected" Timeout

The extension must connect to the daemon within 30s. If this fails:
1. Ensure the extension is built: `pnpm --filter @browser-cli/extension build`
2. Check the extension output exists: `ls apps/extension/.output/chrome-mv3/`
3. Check daemon socket: `ls /tmp/browser-cli-e2e/daemon.sock`
4. Check the extension was built with the right port: `grep 19222 apps/extension/.output/chrome-mv3/background.js`

### Element Not Found Errors

1. Use `await activePage.waitForLoadState('domcontentloaded')` after navigation
2. Check the element exists with `await expect(activePage.locator(sel)).toBeVisible()`
3. Use `bcli('snapshot', '-ic')` to inspect available elements

### Stale Element References

Element refs (`@e1`, `@e2`) are bound to the current page. After navigation, re-run `bcli('snapshot', '-ic')` to get fresh refs.

### Tests Pass Locally but Fail in CI

1. **Timing**: CI machines are slower. The config uses longer timeouts in CI.
2. **Display**: Extension requires headed mode. `xvfb-run` provides this in CI.
3. **Retries**: CI retries failed tests once with trace capture.

### Port Conflict

If port 19222 conflicts with another service, change `E2E_WS_PORT` in `test/e2e-pw/helpers/constants.ts`. The global-setup will rebuild the extension and start the daemon on the new port automatically.

### Build/Reload Checklist

| Changed Package | Rebuild Command | Action |
|----------------|----------------|--------|
| `apps/cli/` | `pnpm --filter @browser-cli/cli build` | Daemon auto-restarts in globalSetup |
| `apps/extension/` | `pnpm --filter @browser-cli/extension build` | globalSetup rebuilds with `VITE_WS_PORT` |
| `packages/shared/` | Rebuild **both** CLI and extension | Full rebuild required |
| Test files only | No rebuild needed | Just re-run tests |
