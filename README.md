# Browser-CLI

[![npm version](https://img.shields.io/npm/v/@browser-cli/cli.svg)](https://www.npmjs.com/package/@browser-cli/cli)
[![license](https://img.shields.io/npm/l/@browser-cli/cli.svg)](LICENSE)

Agentic browser automation CLI with skill support — control Chrome or Firefox via extension.

Browser-CLI uses a browser extension as a bridge instead of a browser driver, giving you direct access to browser APIs (cookies, storage, tabs, etc.) while keeping the automation workflow in your terminal. No Playwright or WebDriver required.

## AI Agent Integration

Browser-CLI is designed to be used by AI agents as a skill. It ships with a [skill definition](skills/browser-cli/SKILL.md) that agents (like Claude Code) can use to automate browser tasks autonomously.

```bash
# Agents can use browser-cli as a skill:
# /browser-cli <describe your browser automation task>
```

Features that make it agent-friendly:

- **Accessibility snapshots** with element refs (`@e1`, `@e2`) for structured page understanding
- **Semantic locators** (`role=button`, `text=Submit`, `label=Email`) for resilient element selection
- **Find command** to locate and act on elements in one step
- **Structured error messages** with hints for agent self-correction
- **JSON output mode** (`--json`) for machine-readable responses

## Architecture

```
┌─────────┐  Unix socket   ┌────────┐  WebSocket   ┌───────────┐
│   CLI   │ ──── NDJSON ──→│ Daemon │ ──── JSON ──→│ Extension │
│(client) │                │(server)│              │(browser)  │
└─────────┘                └────────┘              └───────────┘
```

- **CLI** — Commander.js client that sends commands over a Unix socket
- **Daemon** — Background process with a WebSocket server (port 9222) + Unix socket server
- **Extension** — MV3 browser extension (Chrome + Firefox) that routes commands to browser APIs or content scripts

## Features

**Navigation** — goto, back, forward, reload, get URL/title

**Interaction** — click, double-click, hover, fill, type, press key, clear, focus, keydown/keyup, drag & drop

**Forms** — check, uncheck, select dropdown options, upload files

**Scrolling** — scroll page/element, scroll element into view

**Data Queries** — get text/html/value/attribute, check visibility/enabled/checked state, count elements, bounding box

**Snapshots** — Accessibility tree snapshot with interactive element refs (`@e1`, `@e2`, ...)

**Semantic Locators** — Find elements by role, text, label, placeholder, alt, title, testid, or xpath

**Find Command** — Locate elements and perform actions in one step (`find role button click --name "Submit"`)

**Screenshots** — Full page or element screenshots (PNG/JPEG)

**Wait** — Wait for selector, URL pattern, duration, text, load state, or custom function

**JavaScript** — Evaluate expressions in page context (supports base64 and stdin input)

**Console & Errors** — Capture and retrieve console logs and page errors

**Tabs** — Open, list, switch, close tabs

**Windows** — Open, list, close browser windows

**Frames** — Switch between main page and iframes

**Cookies** — Get, set, clear cookies

**Storage** — Read/write localStorage and sessionStorage

**State** — Save/load browser state (cookies + storage) to/from JSON files

**Dialogs** — Handle alert, confirm, prompt dialogs

**Highlight** — Visually highlight elements on the page

**Mouse Control** — Low-level mouse move, button down/up, wheel scroll

**Network Interception** — Block or redirect requests, track network activity

**Markdown** — Extract page content as readable Markdown

**Bookmarks** — Search and manage browser bookmarks

**History** — Browse and search browser history

**Browser Configuration** — Set viewport size, geolocation, media preferences, custom HTTP headers

**Containers** — Manage Firefox containers (Firefox only)

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
