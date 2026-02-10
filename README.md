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

**Semantic Locators** — Find elements by role, text, label, placeholder, alt, title, testid, or xpath (AgentBrowser-compatible syntax)

**Find Command** — Locate elements and perform actions in one step (`find role button click --name "Submit"`)

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

# Navigate to a page
browser-cli navigate https://example.com

# Get an accessibility snapshot with element refs
browser-cli snapshot -i              # short for --interactive
browser-cli snapshot -i -c           # interactive + compact
browser-cli snapshot -d 3            # max depth 3
browser-cli snapshot -s "role=nav"   # scoped to element

# Click an element using a ref, semantic locator, or CSS selector
browser-cli click @e1
browser-cli click 'role=button[name="Submit"]'
browser-cli click "#submit-button"

# Find and interact in one step (AgentBrowser-compatible)
browser-cli find role button click --name "Submit"
browser-cli find text "Sign In" click
browser-cli find label "Email" fill "user@example.com"
browser-cli find first ".item" click
browser-cli find nth 2 ".item" click

# Fill a form field using label, placeholder, or CSS selector
browser-cli fill "label=Email" "user@example.com"
browser-cli fill "placeholder=Search..." "query"
browser-cli fill "input[name=email]" "user@example.com"

# Upload files (supports data URLs, blob URLs, or HTTP URLs)
browser-cli upload "input[type=file]" "data:text/plain;base64,SGVsbG8="
# See UPLOAD_TESTING.md for detailed usage and limitations

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

### Semantic Locators

Browser-CLI supports AgentBrowser-compatible semantic locators for finding elements:

```bash
# By role and accessible name
browser-cli click "role=button[name=\"Submit\"][exact]"
browser-cli click "role=textbox[name=\"Email\"]"

# By text content (substring match by default)
browser-cli click "text=Sign In"
browser-cli click 'text="Sign In"'   # exact match (quoted)

# By label text (for form inputs)
browser-cli fill "label=Password" "secret123"

# By placeholder
browser-cli fill "placeholder=Search..." "query"

# By alt text (images)
browser-cli click "alt=Company Logo"

# By title attribute
browser-cli hover "title=Help Center"

# By data-testid
browser-cli click "testid=login-button"

# By XPath
browser-cli click 'xpath=//button[@type="submit"]'
```

See [SEMANTIC_LOCATORS.md](SEMANTIC_LOCATORS.md) for detailed documentation.

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
