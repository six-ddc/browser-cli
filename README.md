# Browser-CLI

Extension-based browser automation from the command line — control Chrome or Firefox without Playwright or WebDriver.

Browser-CLI uses a browser extension as a bridge instead of a browser driver, giving you direct access to browser APIs (cookies, storage, tabs, etc.) while keeping the automation workflow in your terminal.

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

**Interaction** — click, double-click, hover, fill, type, press key, clear, focus

**Forms** — check, uncheck, select dropdown options

**Scrolling** — scroll page/element, scroll element into view

**Data Queries** — get text/attribute/value, check visibility/enabled state, count elements, bounding box

**Snapshots** — Accessibility tree snapshot with interactive element refs (`@e1`, `@e2`, ...)

**Screenshots** — Full page or element screenshots (PNG/JPEG)

**Wait** — Wait for selector, URL pattern, or custom condition

**JavaScript** — Evaluate expressions in page context

**Console** — Capture and retrieve console logs and errors

**Tabs** — Open, list, switch, close tabs

**Cookies** — Get, set, clear cookies

**Storage** — Read/write localStorage and sessionStorage

**Dialogs** — Handle alert, confirm, prompt dialogs

**Highlight** — Visually highlight elements on the page

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Chrome / Chromium or Firefox

### Install

```bash
git clone https://github.com/six-ddc/browser-cli.git
cd browser-cli
pnpm install
pnpm build
```

### Load the Extension

**Chrome:**

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode**
3. Click **Load unpacked** and select `apps/extension/.output/chrome-mv3`

Or install from the zip file at `apps/extension/.output/<name>-chrome.zip`.

**Firefox:**

1. Open `about:debugging#/runtime/this-firefox` in Firefox
2. Click **Load Temporary Add-on**
3. Select the zip file at `apps/extension/.output/<name>-firefox.zip`

### Usage

```bash
# Start the daemon
browser-cli start

# Check connection status
browser-cli status

# Navigate to a page
browser-cli navigate https://example.com

# Get an accessibility snapshot with element refs
browser-cli snapshot --interactive

# Click an element using a ref or CSS selector
browser-cli click @e1
browser-cli click "#submit-button"

# Fill a form field
browser-cli fill "input[name=email]" "user@example.com"

# Take a screenshot
browser-cli screenshot --path page.png

# Evaluate JavaScript in the page
browser-cli eval "document.title"

# Manage tabs
browser-cli tab list
browser-cli tab new https://github.com

# Manage cookies
browser-cli cookies get --domain example.com
browser-cli cookies clear --domain example.com

# Stop the daemon
browser-cli stop
```

### Global Options

```
--session <name>   Use a named daemon session (default: "default")
--json             Output results in JSON format
```

## Development

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

## Packages

| Package | Path | Description |
|---|---|---|
| `@browser-cli/cli` | `apps/cli` | CLI client + daemon process |
| `@browser-cli/extension` | `apps/extension` | Browser extension — Chrome + Firefox (WXT + React) |
| `@browser-cli/shared` | `packages/shared` | Protocol types, Zod schemas, constants |

## License

[MIT](LICENSE)
