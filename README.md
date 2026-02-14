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
# Start the daemon (default port 9222)
browser-cli start
browser-cli start --port 9333           # custom WebSocket port

# Check connection status
browser-cli status

# Navigate to a page (aliases: goto, open)
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
browser-cli find role button --name "Submit"        # defaults to click
browser-cli find text "Sign In"                     # defaults to click
browser-cli find label "Email" fill "user@example.com"
browser-cli find first ".item" click
browser-cli find nth 2 ".item" click

# Fill a form field using label, placeholder, or CSS selector
browser-cli fill "label=Email" "user@example.com"
browser-cli fill "placeholder=Search..." "query"
browser-cli fill "input[name=email]" "user@example.com"

# Upload files (supports data URLs, blob URLs, or local paths)
browser-cli upload "input[type=file]" "data:text/plain;base64,SGVsbG8="

# Take a screenshot
browser-cli screenshot --path page.png

# Evaluate JavaScript in the page
browser-cli eval "document.title"
browser-cli eval -b "ZG9jdW1lbnQudGl0bGU="  # base64 input
echo 'document.title' | browser-cli eval --stdin  # stdin input

# Press keys (page-level)
browser-cli press Enter
browser-cli press Tab

# Hold/release keys
browser-cli keydown Control
browser-cli press a
browser-cli keyup Control

# Wait for selector, duration, URL, text, load state, or function
browser-cli wait ".loaded"                              # wait for element
browser-cli wait ".loaded" --timeout 5000 --hidden      # with timeout, wait to disappear
browser-cli wait 1000                                   # wait for duration
browser-cli wait --url "*/dashboard"                    # wait for URL match
browser-cli waitforurl "*/dashboard"                    # alias for wait --url
browser-cli wait --text "Success"                       # wait for text on page
browser-cli wait --load networkidle                     # wait for load state
browser-cli wait --fn "document.readyState === 'complete'"  # wait for JS condition

# Manage tabs
browser-cli tab                          # list all tabs (alias: tab list)
browser-cli tab 2                        # switch to tab 2
browser-cli tab new https://github.com
browser-cli tab close                    # close active tab
browser-cli tab close 123               # close specific tab

# Manage windows
browser-cli window                       # list all windows (alias: window list)
browser-cli window new https://github.com
browser-cli window close                 # close current window
browser-cli window close 123             # close specific window

# Manage cookies
browser-cli cookies                      # list all cookies
browser-cli cookies get session_id       # get specific cookie
browser-cli cookies set session abc --url https://example.com
browser-cli cookies clear --domain example.com

# Manage storage
browser-cli storage local                # list all localStorage
browser-cli storage local set key value
browser-cli storage session clear

# Frame management
browser-cli frame "iframe#content"       # switch to iframe
browser-cli frame main                   # back to main frame
browser-cli frame list                   # list all frames
browser-cli frame current                # show current frame info

# Query data
browser-cli get url
browser-cli get title
browser-cli get text ".heading"
browser-cli get html ".content"          # innerHTML (--outer for outerHTML)
browser-cli get value "input[name=email]"
browser-cli get attr "a.link" href
browser-cli get count ".item"
browser-cli get box "#element"

# Check element state
browser-cli is visible ".modal"
browser-cli is enabled "#submit-btn"
browser-cli is checked "input[type=checkbox]"

# Drag and drop
browser-cli drag "#source" "#target"

# Mouse control (low-level)
browser-cli mouse move 100 200
browser-cli mouse down
browser-cli mouse up
browser-cli mouse wheel 300

# Scroll
browser-cli scroll down --amount 500
browser-cli scrollintoview "#element"

# Network interception
browser-cli network route "*analytics*" --abort
browser-cli network route "*api/old*" --redirect "https://api.new/endpoint"
browser-cli network unroute 1            # remove route by ID
browser-cli network requests --blocked   # list blocked requests (also: --pattern, --tab, --limit)
browser-cli network routes               # list active routes
browser-cli network clear                # clear tracked requests

# Browser configuration
browser-cli set viewport 1920 1080
browser-cli set geo 37.7749 -122.4194
browser-cli set media dark
browser-cli set headers '{"X-Custom": "value"}'

# Save/load browser state (cookies + storage)
browser-cli state save ./state.json
browser-cli state load ./state.json

# Console output
browser-cli console                      # all console output
browser-cli console --level error        # filter by level (log/warn/error/info/debug)
browser-cli console --clear              # get and clear console buffer
browser-cli errors                       # get page errors

# Dialog handling
browser-cli dialog accept               # accept next alert/confirm/prompt
browser-cli dialog accept "response"    # accept with prompt text
browser-cli dialog dismiss              # dismiss next dialog

# Element highlight
browser-cli highlight ".target" --color red --duration 3000

# Close session (aliases: quit, exit)
browser-cli close

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
