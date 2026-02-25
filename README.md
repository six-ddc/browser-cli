# Browser-CLI

[![npm version](https://img.shields.io/npm/v/@browser-cli/cli.svg)](https://www.npmjs.com/package/@browser-cli/cli)
[![license](https://img.shields.io/npm/l/@browser-cli/cli.svg)](LICENSE)

Skill-powered browser automation CLI for AI agents — real browser extensions, no CDP or Playwright.

## Why Browser-CLI?

Most browser automation tools (Playwright, Puppeteer, Selenium) rely on CDP or WebDriver protocols — running a headless or debug-mode browser that doesn't behave like a real user's browser. Browser-CLI takes a different approach:

- **Real browser, zero fingerprint** — Runs inside your actual Chrome/Firefox via a lightweight extension. No `navigator.webdriver`, no headless flags, no CDP traces — behaves exactly like a human user, minimizing the risk of triggering anti-bot detection.
- **Same session, same identity** — Operates in your existing browser with all your cookies, login state, and extensions intact. No separate browser profile or cold start.
- **Skill-first design** — Ships with a [skill definition](skills/browser-cli/SKILL.md) so AI agents (Claude Code, etc.) can call `/browser-cli` as a tool and automate tasks autonomously.
- **No CDP, no WebDriver** — The extension communicates over WebSocket, with zero dependency on Chrome DevTools Protocol or browser drivers.
- **Agent-friendly output** — Accessibility snapshots with element refs (`@e1`, `@e2`), semantic locators, structured errors with hints, and `--json` mode.

```bash
# AI agents use browser-cli as a skill:
# /browser-cli navigate to hacker news and get the top 3 stories
```

## Architecture

```
┌─────────┐  Unix socket   ┌────────┐  WebSocket   ┌───────────┐
│   CLI   │ ──── NDJSON ──→│ Daemon │ ──── JSON ──→│ Extension │
│(client) │                │(server)│              │(browser)  │
└─────────┘                └────────┘              └───────────┘
```

- **CLI** — Commander.js client that sends commands over a Unix socket
- **Daemon** — Background process with a WebSocket server (port 9222) + Unix socket server
- **Extension** — Browser extension (Chrome MV3 + Firefox MV2) that routes commands to chrome APIs or content scripts

## Features

**Navigation & Pages** — goto, back, forward, reload, markdown extraction, screenshots

**Interaction** — click, fill, type, press, hover, drag & drop, scroll, focus, check/uncheck, select, upload

**Semantic Locators** — Find elements by role, text, label, placeholder, alt, title, testid, or xpath

**Find Command** — Locate + act in one step: `find role button click --name "Submit"`

**Snapshots** — Accessibility tree with interactive element refs (`@e1`, `@e2`, ...)

**Data Queries** — get text/html/value/attribute, check element state, count, bounding box

**Wait** — Wait for selector, URL, duration, text, load state, or custom function

**JavaScript** — Evaluate expressions in page context (base64, stdin, MAIN world)

**Tabs & Windows** — Open, list, switch, close tabs and windows; tab groups (Chrome)

**Frames** — Switch between main page and iframes

**State** — Cookies, localStorage, sessionStorage; save/load state snapshots

**Network** — Block or redirect requests, track network activity

**Dialogs & Console** — Handle alert/confirm/prompt, capture console logs and errors

**Browser Config** — Viewport, geolocation, media preferences, custom headers

**Bookmarks & History** — Search and manage bookmarks and browsing history

**Containers** — Firefox container management

## Quick Start

### Prerequisites

- Node.js >= 20
- Chrome / Chromium or Firefox

### Install

```bash
npm install -g @browser-cli/cli
```

### Load the Extension

The browser extension is required for Browser-CLI to communicate with the browser. Download the latest extension from [GitHub Releases](https://github.com/six-ddc/browser-cli/releases).

**Chrome:**

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode**
3. Click **Load unpacked** and select the extracted extension folder

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox` in Firefox
2. Click **Load Temporary Add-on**
3. Select the extension zip file

### Usage

```bash
# Start the daemon
browser-cli start

# Check connection status
browser-cli status

# Navigate and inspect
browser-cli navigate https://example.com
browser-cli snapshot -ic

# Interact with elements
browser-cli click 'role=button[name="Submit"]'
browser-cli fill 'label=Email' user@example.com
browser-cli find role button --name "Submit"

# Extract page content
browser-cli markdown

# Stop the daemon
browser-cli stop
```

For the full command reference — including all operations, selector types, semantic locators, and workflow examples — see **[skills/browser-cli/SKILL.md](skills/browser-cli/SKILL.md)**.

## Development

### Prerequisites

- Node.js >= 20
- pnpm >= 10

### Setup

```bash
git clone https://github.com/six-ddc/browser-cli.git
cd browser-cli
pnpm install
pnpm build

# Link the CLI command globally for local development
cd apps/cli && pnpm link --global
```

After linking, the `browser-cli` command will be available system-wide. Changes to the code will be reflected after running `pnpm build` (no need to re-link).

```bash
# Start extension in dev mode (hot reload)
pnpm --filter @browser-cli/extension dev

# Build CLI only
pnpm --filter @browser-cli/cli build

# Run quality checks
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Vitest

# Format code
pnpm format
```

To unlink the global command:

```bash
cd apps/cli && pnpm unlink --global
```

## Packages

| Package                  | Path              | Description                                        |
| ------------------------ | ----------------- | -------------------------------------------------- |
| `@browser-cli/cli`       | `apps/cli`        | CLI client + daemon process                        |
| `@browser-cli/extension` | `apps/extension`  | Browser extension — Chrome + Firefox (WXT + React) |
| `@browser-cli/shared`    | `packages/shared` | Protocol types, Zod schemas, constants             |

## License

[MIT](LICENSE)
