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

**Interaction** — click, double-click, hover, fill, type, press key, clear, focus, keydown/keyup

**Forms** — check, uncheck, select dropdown options

**Drag & Drop** — Drag elements to targets with full DataTransfer API support

**Scrolling** — scroll page/element, scroll element into view

**Data Queries** — get text/html/value/attribute, check visibility/enabled/checked state, count elements, bounding box

**Snapshots** — Accessibility tree snapshot with interactive element refs (`@e1`, `@e2`, ...)

**Semantic Locators** — Find elements by role, text, label, placeholder, alt, title, testid, or xpath (AgentBrowser-compatible syntax)

**Find Command** — Locate elements and perform actions in one step (`find role button click --name "Submit"`)

**Screenshots** — Full page or element screenshots (PNG/JPEG)

**Wait** — Wait for selector, URL pattern, duration, text, load state, or custom function

**JavaScript** — Evaluate expressions in page context (supports base64 and stdin input)

**Console** — Capture and retrieve console logs and errors

**Tabs** — Open, list, switch, close tabs

**Windows** — Open, list, close browser windows

**Cookies** — Get, set, clear cookies

**Storage** — Read/write localStorage and sessionStorage

**State** — Save/load browser state (cookies + storage) to/from JSON files

**Dialogs** — Handle alert, confirm, prompt dialogs

**Highlight** — Visually highlight elements on the page

**Mouse Control** — Low-level mouse move, button down/up, wheel scroll

**Network Interception** — Block or redirect requests, track network activity

**Browser Configuration** — Set viewport size, geolocation, media preferences, custom HTTP headers

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Chrome / Chromium or Firefox

### Install

```bash
git clone https://github.com/six-ddc/browser-cli.git
cd browser-cli
pnpm install
pnpm build

# Link the CLI command globally for local development
cd apps/cli && pnpm link --global
```

After linking, the `browser-cli` command will be available system-wide. Changes to the code will be reflected after running `pnpm build` (no need to re-link).

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

# Navigate and inspect
browser-cli navigate https://example.com
browser-cli snapshot -ic

# Interact with elements
browser-cli click 'role=button[name="Submit"]'
browser-cli fill 'label=Email' user@example.com
browser-cli find role button --name "Submit"

# Stop the daemon
browser-cli stop
```

For the full command reference — including all operations, selector types, semantic locators, and workflow examples — see **[skills/skills/browser-cli/SKILL.md](skills/skills/browser-cli/SKILL.md)**.

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

### Running the CLI locally

After building, you can run the CLI in several ways:

```bash
# Option 1: Use the globally linked command (recommended)
browser-cli start

# Option 2: Run directly via node
node apps/cli/bin/cli.js start

# Option 3: Run via pnpm
pnpm --filter @browser-cli/cli exec browser-cli start
```

To unlink the global command:

```bash
cd apps/cli && pnpm unlink --global
```

## Packages

| Package | Path | Description |
|---|---|---|
| `@browser-cli/cli` | `apps/cli` | CLI client + daemon process |
| `@browser-cli/extension` | `apps/extension` | Browser extension — Chrome + Firefox (WXT + React) |
| `@browser-cli/shared` | `packages/shared` | Protocol types, Zod schemas, constants |

## License

[MIT](LICENSE)
