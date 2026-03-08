---
name: browser-cli
description: >
  Automate a real browser via CLI — navigate pages, interact with elements, query data,
  manage tabs/cookies/storage, intercept network requests, and capture snapshots/screenshots.
  Uses a Chrome/Firefox extension + daemon architecture (no Playwright required).
  Use when the user wants to automate browser tasks, scrape web pages, fill forms,
  test web applications, take screenshots, or control a browser from the command line.
allowed-tools: Bash(browser-cli:*)
argument-hint: '<describe your browser automation task>'
---

# Browser-CLI Skill

Automate a real browser from the command line. Browser-CLI uses a Chrome/Firefox extension + daemon architecture — no Playwright or headless browser needed. It controls the user's actual browser with full access to extensions, login state, and cookies.

## Setup

Run `browser-cli status` to check readiness, or `browser-cli list` to see connected browser sessions. If the command fails or shows no connected sessions, follow the [Setup Guide](references/SETUP.md) to install the CLI and browser extension.

When ready, start the daemon with `browser-cli start` before issuing commands.

## Quick Start

To avoid disrupting the user's browsing, prefer opening a dedicated tab group with `tab new --group`, then use `--tab <id>` for subsequent commands:

```bash
# Step 1: Open a new tab in the "browser-cli" group (creates group if needed)
browser-cli tab new https://example.com --group browser-cli
# Output: Tab 12345: https://example.com (group: browser-cli)

# Step 2: ALL subsequent commands MUST use --tab <id>
browser-cli --tab 12345 get title
browser-cli --tab 12345 snapshot -ic

# Step 3: Interact — still using --tab
browser-cli --tab 12345 click 'role=button[name="Submit"]'
browser-cli --tab 12345 fill 'label=Email' user@example.com

# To navigate to a different URL in the same tab:
browser-cli --tab 12345 navigate 'https://other.com'

# To open another URL in a new tab (same group):
browser-cli tab new https://other.com --group browser-cli
```

## Global Options

| Option                  | Description                                                                                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--session <sessionId>` | Target a specific browser connection by session ID (e.g., `brave-falcon`). Only needed with multiple browsers; get IDs from `browser-cli list`                                                     |
| `--tab <tabId>`         | Target a specific tab by ID (get IDs from `tab list`). Commands run against this tab instead of the active tab. For `screenshot`, the tab is auto-switched to active first (Chrome API limitation) |
| `--json`                | Output in JSON format (machine-readable)                                                                                                                                                           |
| `--help-json`           | Output full command reference as JSON (for AI agents)                                                                                                                                              |
| `--help-all`            | Show all commands organized by category                                                                                                                                                            |

## Selector Types

Browser-CLI supports multiple selector types:

### CSS Selectors (default)

```bash
browser-cli click '#submit-btn'
browser-cli fill 'input[name="email"]' value
browser-cli click '.nav > a:first-child'
```

### Semantic Locators (AgentBrowser-compatible, `=` syntax)

```bash
browser-cli click 'role=button[name="Submit"]'     # ARIA role + name
browser-cli click 'text=Sign In'                    # Text content (partial)
browser-cli click 'text="Sign In"'                  # Text content (exact)
browser-cli fill 'label=Email' value                # Form label
browser-cli fill 'placeholder=Search...' query      # Placeholder text
browser-cli click 'alt=Company Logo'                # Image alt text
browser-cli click 'title=Help'                      # Title attribute
browser-cli click 'testid=login-btn'                # Test ID (exact, case-sensitive)
browser-cli click 'xpath=//button[@type="submit"]'  # XPath
```

### Element References (from snapshot)

```bash
browser-cli snapshot -ic     # Output: @e1 button "Submit", @e2 input "Email", ...
browser-cli click @e1        # Use ref directly
browser-cli fill @e2 hello   # Fill by ref
```

## Commands Reference

### Lifecycle & Sessions

| Command  | Description                                                                              |
| -------- | ---------------------------------------------------------------------------------------- |
| `start`  | Start the daemon (`--port`, `--host`, `--auth`, `--token`)                               |
| `stop`   | Stop the daemon                                                                          |
| `status` | Show daemon status, connections, uptime                                                  |
| `list`   | List connected browser sessions (table format with session ID, browser, connection time) |

### Navigation & Waiting

#### Navigation

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `navigate <url>` | Navigate to URL (aliases: `goto`, `open`) |
| `back`           | Go back in history                        |
| `forward`        | Go forward in history                     |
| `reload`         | Reload the page                           |

#### Wait Operations

| Command                  | Description                                                              |
| ------------------------ | ------------------------------------------------------------------------ |
| `wait <selector>`        | Wait for element to appear (`--timeout <ms>`, `--hidden` for disappear)  |
| `wait <ms>`              | Wait for duration in ms (auto-detects numeric argument)                  |
| `wait --url <pattern>`   | Wait for URL to match pattern                                            |
| `wait --text <text>`     | Wait for text content to appear on page                                  |
| `wait --load [state]`    | Wait for load state: `load` (default), `domcontentloaded`, `networkidle` |
| `wait --fn <expression>` | Wait for JS expression to return truthy                                  |
| `waitforurl <pattern>`   | Alias for `wait --url`                                                   |

### Element Interaction

#### Basic Interaction

| Command                        | Description                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `click <selector>`             | Click an element (`--button right/middle`; `--debugger` for CDP isTrusted events)                    |
| `dblclick <selector>`          | Double-click an element (`--debugger` for CDP isTrusted events)                                      |
| `hover <selector>`             | Hover over an element (`--debugger` for CDP dispatch, activates CSS `:hover`)                        |
| `fill <selector> <value>`      | Fill an input, replacing content (works with React/Vue; `--debugger` for CDP)                        |
| `type <selector> <text>`       | Type text character by character (`--delay` ms between keys; `--debugger` for CDP)                   |
| `press <key>`                  | Press a key or combo like Enter, Tab, Control+a (alias: `key`; `-s` to target element; `--debugger`) |
| `clear <selector>`             | Clear an input field                                                                                 |
| `focus <selector>`             | Focus an element                                                                                     |
| `check <selector>`             | Check a checkbox or radio button                                                                     |
| `uncheck <selector>`           | Uncheck a checkbox                                                                                   |
| `select <selector> <value>`    | Select an option in a `<select>` dropdown by value or visible text                                   |
| `upload <selector> <files...>` | Upload file(s) to a file input element (`--clear` to reset)                                          |
| `drag <source> <target>`       | Drag an element to a target                                                                          |
| `keydown <key>`                | Press a key down (without releasing)                                                                 |
| `keyup <key>`                  | Release a key                                                                                        |

#### Find Command (Locate + Act)

`find <selector> [action] [value]` — find by CSS/semantic locator/XPath and act (default: click; `--first`/`--last`/`--nth` to pick match).

**Selector**: any CSS selector, semantic locator, or `@ref`
**Actions**: `click` (default), `dblclick`, `fill`, `type`, `hover`, `check`, `uncheck`, `select`, `press`, `clear`, `focus`
**Options**: `--first`, `--last`, `--nth <n>` (position among matches, 1-based)

| Example                                 | Description                       |
| --------------------------------------- | --------------------------------- |
| `find 'role=button[name="Submit"]'`     | Click button named "Submit"       |
| `find 'text=Sign In'`                   | Click element with text "Sign In" |
| `find 'label=Email' fill user@test.com` | Fill input labeled "Email"        |
| `find 'placeholder=Search' fill query`  | Fill by placeholder               |
| `find 'testid=login-btn'`               | Click by test ID                  |
| `find 'xpath=//button[@type="submit"]'` | Click by XPath                    |
| `find '#submit'`                        | Click by CSS selector             |
| `find '.item' click --nth 2`            | Click 2nd matching `.item`        |
| `find '.item' click --last`             | Click last matching `.item`       |
| `find @e1 fill "hello"`                 | Fill element by ref               |

#### Scroll

| Command                     | Description                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `scroll <direction>`        | Scroll the page or element (up/down/left/right; `--amount` px; `--selector` to scope) |
| `scrollintoview <selector>` | Scroll an element into view (CSS, semantic locator, or `@ref`)                        |

#### Mouse Control (Low-level)

| Command                         | Description               |
| ------------------------------- | ------------------------- |
| `mouse move <x> <y>`            | Move mouse to coordinates |
| `mouse down [button]`           | Press mouse button        |
| `mouse up [button]`             | Release mouse button      |
| `mouse wheel <deltaY> [deltaX]` | Scroll mouse wheel        |

#### Element Highlight

Highlight an element with a visual overlay (`--color`, `--duration` ms):

```bash
browser-cli highlight <selector> [--color <color>] [--duration <ms>]
```

### Page Content & Data

#### Snapshot (Accessibility Tree)

Get accessibility tree snapshot (`-i` interactive, `-c` compact, `-C` cursor, `-d` depth, `-s` selector, `-f` role filter):

```bash
browser-cli snapshot [options]
```

| Flag                   | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `-i, --interactive`    | Only interactive elements                               |
| `-c, --compact`        | Compact output                                          |
| `-C, --cursor`         | Include cursor-interactive elements (cursor:pointer)    |
| `-d, --depth <n>`      | Max tree depth                                          |
| `-s, --selector <sel>` | Scope to element                                        |
| `-f, --filter <role>`  | Only show nodes with this ARIA role and their ancestors |

**Best practice**: Use `snapshot -ic` for a concise view of interactive elements. Use element refs (`@e1`, `@e2`) from snapshot output in subsequent commands.

**Scoping to a region**: use `-s @eN` to drill into a specific area from a previous snapshot. Refs from prior snapshots remain valid across `-s` calls — no need to re-run the overview between drills:

```bash
browser-cli --tab 12345 snapshot -ic        # full page, get refs
browser-cli --tab 12345 snapshot -ic -s @e3 # only elements inside @e3
browser-cli --tab 12345 snapshot -ic -s @e5 # @e3's ref still valid, explore another area
```

**Filtering by ARIA role**: use `--filter <role>` to show only nodes with a specific role and their ancestor path. Useful for finding all buttons, navigation landmarks, headings, etc. without losing structural context:

```bash
browser-cli --tab 12345 snapshot --filter navigation   # all nav landmarks + ancestors
browser-cli --tab 12345 snapshot -ic --filter button   # all buttons with tree context
browser-cli --tab 12345 snapshot --filter heading      # page heading structure
```

#### Markdown (Page Content Extraction)

```bash
browser-cli markdown
```

Extracts page content as clean Markdown using Defuddle for article extraction. Long query strings in URLs are automatically trimmed. Useful for AI agents consuming page content.

#### Screenshot

Capture a screenshot (`--selector` for element, `--path` to save, `--format` png/jpeg, `--quality` 0-100):

```bash
browser-cli screenshot [options]
```

| Option             | Description                         |
| ------------------ | ----------------------------------- |
| `--selector <sel>` | Element screenshot                  |
| `--path <path>`    | Save path (default: screenshot.png) |
| `--format <fmt>`   | `png` or `jpeg`                     |
| `--quality <n>`    | JPEG quality 0-100                  |

#### Data Queries (get)

| Command                           | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `get url`                         | Current page URL                                  |
| `get title`                       | Current page title                                |
| `get text <selector>`             | Text content of element                           |
| `get html <selector>`             | innerHTML of an element (`--outer` for outerHTML) |
| `get value <selector>`            | Input value                                       |
| `get attr <selector> <attribute>` | Attribute value                                   |
| `get count <selector>`            | Count matching elements                           |
| `get box <selector>`              | Bounding box (x, y, width, height)                |

#### State Queries (is)

Check element state — returns true/false:

| Command                 | Description                          |
| ----------------------- | ------------------------------------ |
| `is visible <selector>` | Check if an element is visible       |
| `is enabled <selector>` | Check if an element is enabled       |
| `is checked <selector>` | Check if a checkbox/radio is checked |

#### JavaScript Execution

```bash
browser-cli eval '<expression>'
browser-cli eval -b/--base64 '<base64-encoded-expression>'  # decode from base64
echo '<expression>' | browser-cli eval --stdin       # read from stdin
```

Evaluates JavaScript in the page context (runs in MAIN world; `--stdin` or `-b` base64 input) and returns the result. **Async-aware**: Promises are auto-awaited, so `fetch()` and async IIFEs work directly. CSP-strict pages (Gmail, GitHub, etc.) are handled automatically with platform-specific fallbacks.

#### Console & Errors

| Command   | Description                                                                              |
| --------- | ---------------------------------------------------------------------------------------- |
| `console` | Get page console output (`--level` log/warn/error/info/debug; `--clear` to reset buffer) |
| `errors`  | Get page errors (shorthand for console `--level` error)                                  |

### Tabs, Windows & Frames

#### Tab Management

| Command                                                                  | Description                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `tab`                                                                    | List all tabs (or switch by ID; subcommands: new, list, close, group) |
| `tab <n>`                                                                | Switch to tab by ID                                                   |
| `tab new [url] [--group <name>] [--container <name>]`                    | Open new tab (optionally in a named group or container)               |
| `tab list`                                                               | List all tabs                                                         |
| `tab close [tabId]`                                                      | Close tab (default: active)                                           |
| `tab group <tabIds...>`                                                  | Group tabs together (Chrome only)                                     |
| `tab group update <groupId> [--title] [--color] [--collapse] [--expand]` | Update a tab group (Chrome only)                                      |
| `tab groups`                                                             | List all tab groups (Chrome only)                                     |
| `tab ungroup <tabIds...>`                                                | Remove tabs from their group (Chrome only)                            |

**Tab group colors**: `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`

#### Window Management

| Command                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `window`                  | List windows (subcommands: new, list, close, focus) |
| `window new [url]`        | Open new window                                     |
| `window list`             | List windows                                        |
| `window close [windowId]` | Close window (defaults to current)                  |
| `window focus [windowId]` | Focus a window (defaults to current)                |

#### Frame Management (iframe)

| Command            | Description                           |
| ------------------ | ------------------------------------- |
| `frame <selector>` | Switch to iframe by selector          |
| `frame main`       | Switch back to top-level (main frame) |
| `frame list`       | List all frames in the page           |
| `frame current`    | Show current frame info               |

#### Container Management (Firefox only)

| Command                                      | Description                 |
| -------------------------------------------- | --------------------------- |
| `container list`                             | List all containers         |
| `container create <name> [--color] [--icon]` | Create a new container      |
| `container remove <name>`                    | Remove a container          |
| `tab new [url] --container <name>`           | Open new tab in a container |

**Container colors**: `blue`, `turquoise`, `green`, `yellow`, `orange`, `red`, `pink`, `purple`
**Container icons**: `fingerprint`, `briefcase`, `dollar`, `cart`, `circle`, `gift`, `vacation`, `food`, `fruit`, `pet`, `tree`, `chill`, `fence`

> On Chrome, container commands output a warning and exit 0 — containers are a Firefox-only feature.

### Browser State & Configuration

#### Cookies

| Command                      | Description                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `cookies`                    | List all cookies (subcommands: get, set, clear)                                             |
| `cookies get [name]`         | Get cookies (`--url`, `--domain`)                                                           |
| `cookies set <name> <value>` | Set cookie (`--url` required, `--domain`, `--path`, `--secure`, `--httponly`, `--samesite`) |
| `cookies clear`              | Clear cookies (`--url`, `--domain`)                                                         |

#### Storage (localStorage / sessionStorage)

| Command                             | Description                 |
| ----------------------------------- | --------------------------- |
| `storage local [key]`               | Get localStorage value(s)   |
| `storage local set <key> <value>`   | Set localStorage            |
| `storage local clear`               | Clear localStorage          |
| `storage session [key]`             | Get sessionStorage value(s) |
| `storage session set <key> <value>` | Set sessionStorage          |
| `storage session clear`             | Clear sessionStorage        |

#### Network Interception

| Command                                    | Description                     |
| ------------------------------------------ | ------------------------------- |
| `network route <pattern> --abort`          | Block requests matching pattern |
| `network route <pattern> --redirect <url>` | Redirect matching requests      |
| `network unroute <routeId>`                | Remove a route                  |
| `network routes`                           | List active routes              |

#### Network Watch (CDP)

Monitor API requests/responses with full request/response bodies via Chrome DevTools Protocol.
The command returns immediately; captured traffic is written to a file in `~/.browser-cli/watches/`.

| Command                   | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `network watch [pattern]` | Start monitoring network (non-blocking, writes to file) |
| `network unwatch`         | Stop an active network watch (use `--tab` to target)    |

**Options for `network watch`:**

- `--timeout <ms>` — auto-stop after ms (default: `30000`)
- `--body` — capture response bodies (skips binary; default off)
- `--method <method>` — filter by HTTP method (e.g. `GET`, `POST`)

**Usage:**

```bash
# Start watching API calls
browser-cli network watch '/api/*' --timeout 30000 --body

# Perform actions...
browser-cli click '#submit'

# Stop watching (or wait for timeout)
browser-cli network unwatch

# View captured traffic
cat ~/.browser-cli/watches/watch-*.txt
```

**Output format:** HTTP-readable text (httpie-style), one request/response pair per block:

```
>>> POST https://api.example.com/users  [XHR, 142ms]
Content-Type: application/json

{"name": "Alice"}

<<< 200 OK  (256B)
Content-Type: application/json

{"id": 1, "name": "Alice"}
```

**Note:** Chrome only (uses `chrome.debugger` API). Not available on Firefox.

#### Dialog Handling

| Command                | Description                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `dialog accept [text]` | Auto-accept the next dialog (must be set before dialog appears; optional prompt text) |
| `dialog dismiss`       | Auto-dismiss the next dialog (must be set before dialog appears)                      |

#### Browser Configuration

| Command                         | Description                             |
| ------------------------------- | --------------------------------------- |
| `set viewport <width> <height>` | Set viewport size                       |
| `set geo <lat> <lng>`           | Override geolocation (`--accuracy <m>`) |
| `set media <colorScheme>`       | Override media preference (dark/light)  |
| `set headers <json>`            | Set extra HTTP headers                  |

#### Bookmarks

| Command                      | Description                                                           |
| ---------------------------- | --------------------------------------------------------------------- |
| `bookmark [search]`          | List all bookmarks; pass keyword to search (subcommands: add, remove) |
| `bookmark add <url> [title]` | Add a bookmark                                                        |
| `bookmark remove <id>`       | Remove a bookmark by ID                                               |

#### History

| Command                 | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `history [--limit N]`   | Browse recent history (`--limit` count; subcommand: search) |
| `history search <text>` | Search browser history by text (`--limit N`)                |

#### State Management (Save/Load)

| Command             | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `state save <path>` | Export cookies + localStorage + sessionStorage to JSON file |
| `state load <path>` | Import cookies + storage from JSON file                     |

## Script Execution

Run multi-step browser automation as a single operation. Unlike `eval` (which runs a single JS expression in the page context), `script` runs an ES module in the **CLI process (Node.js)** and dispatches each `browser.xxx()` call through the CLI → Daemon → Extension pipeline. This means scripts can use Node.js APIs, `process.env`, and npm packages.

| Command                                    | Description                                            |
| ------------------------------------------ | ------------------------------------------------------ |
| `script <file.js>`                         | Run a multi-step automation ES module (default export) |
| `script -`                                 | Read script from stdin                                 |
| `script <file> --call <name>`              | Call a named export instead of default                 |
| `script <file> --call <name> -- [args...]` | Call named export with arguments                       |
| `script <file> --list`                     | List all exported functions in the script              |
| `script <file> --timeout <ms>`             | Run script with per-command timeout                    |
| `script <file> -- [args...]`               | Pass arguments to the script                           |

| Option               | Description                               |
| -------------------- | ----------------------------------------- |
| `-c, --call <name>`  | Call a named export instead of default    |
| `-l, --list`         | List all exported functions in the script |
| `-t, --timeout <ms>` | Per-command timeout in milliseconds       |
| `-- [args...]`       | Pass arguments to the script (after `--`) |

**Script format** (ES module with default export):

```js
export default async function (browser, args) {
  await browser.navigate({ url: 'https://example.com' });
  await browser.fill({ selector: '#search', value: args.query || 'hello' });
  await browser.click({ selector: '#submit' });
  const snap = await browser.snapshot({ compact: true });
  return snap;
}
```

The `browser` SDK methods map 1:1 to the CLI commands documented above. Method names are the camelCase action names (e.g., `tab new` → `browser.tabNew()`, `cookies get` → `browser.cookiesGet()`), and parameters are passed as an object (e.g., `browser.fill({ selector: '#email', value: 'test' })`). Every command listed above is available in scripts.

**Typical usage — write script to a temp file, then run it:**

```bash
# Write to temp file and execute
TMP=$(mktemp /tmp/bcli-XXXX.mjs)
cat > "$TMP" <<'EOF'
export default async function(browser) {
  await browser.navigate({ url: 'https://example.com' });
  return await browser.getTitle();
}
EOF
browser-cli script "$TMP"
```

**Short scripts — use stdin (`-`) with heredoc:**

```bash
browser-cli script - <<'EOF'
export default async function(browser) {
  await browser.navigate({ url: 'https://example.com' });
  return await browser.getTitle();
}
EOF
```

**Passing arguments:**

```bash
browser-cli script my-flow.mjs -- --name hello --count 3 --verbose
```

Arguments after `--` are parsed as `--key value` pairs (string values) and boolean flags (no value → `true`), then passed as the second parameter to the script function.

**Named exports (recipe files)**: Scripts can export multiple named functions. Use `--call` to invoke a specific function, or `--list` to discover available functions:

```js
// scripts/xhs.mjs — multiple named exports
export async function detectLogin(browser) {
  // ... returns { loggedIn, loginModal }
}
export async function search(browser, { keyword }) {
  // ... navigates to search results
}
export async function extractSearchResults(browser) {
  // ... returns [{ title, author, likes, link }]
}
// optional default export as full-flow entry point
export default async function (browser, args) {
  await detectLogin(browser);
  if (args.keyword) {
    await search(browser, { keyword: args.keyword });
    return await extractSearchResults(browser);
  }
}
```

```bash
# List available functions
browser-cli script scripts/xhs.mjs --list
# → default, detectLogin, search, extractSearchResults

# Call a specific function
browser-cli --tab 123 script scripts/xhs.mjs --call detectLogin

# Call with arguments
browser-cli --tab 123 script scripts/xhs.mjs --call search -- --keyword "coffee"
```

Each named function receives `(browser, args?)` — same signature as default export. Functions can call each other within the module.

**Debugging with console.log**: `console.log/warn/info/debug` in scripts output to stderr in real-time with timestamps and level-aware coloring. This works in both the script body (CLI-side) and inside `browser.evaluate()` expressions (browser-side — captured and returned with the response). Use `console.log` for debugging without polluting stdout results.

```js
export default async function (browser) {
  console.log('navigating...'); // CLI-side, real-time stderr
  await browser.navigate({ url: 'https://example.com' });
  const title = await browser.evaluate({
    expression: `console.log('url:', location.href); document.title;`, // browser-side, returned to CLI stderr
  });
  console.log('got title:', title); // CLI-side, real-time stderr
  return title; // → stdout
}
```

**Error reporting**: On failure, errors include step number and action name (e.g., "Step 3 (click) failed: ELEMENT_NOT_FOUND"). With `--json`, error output includes `step`, `action`, and `params` fields.

**When to prefer script over standalone commands**: For sequences involving transient UI state (open dropdowns, hover panels), use script mode. Standalone commands run as separate processes with a small gap between them — enough for the browser to dismiss a dropdown before the next command arrives. Script mode has no such gap.

**Example — login flow:**

```js
export default async function (browser) {
  await browser.navigate({ url: 'https://app.example.com/login' });
  await browser.fill({ selector: '#username', value: 'admin' });
  await browser.fill({ selector: '#password', value: 'secret' });
  await browser.click({ selector: 'button[type="submit"]' });
  const { url } = await browser.getUrl();
  return { url };
}
```

## Common Workflows

### Login to a website

```bash
browser-cli tab new https://app.example.com/login --group browser-cli
# Output: Tab 12345: ...
browser-cli --tab 12345 snapshot -ic
browser-cli --tab 12345 find 'label=Username' fill admin
browser-cli --tab 12345 find 'label=Password' fill secret123
browser-cli --tab 12345 find 'role=button[name="Log In"]'
browser-cli --tab 12345 wait --url '**/dashboard*'
browser-cli --tab 12345 get title
```

### Scrape data from a page

```bash
browser-cli tab new https://example.com/products --group browser-cli
# Output: Tab 12345: ...
browser-cli --tab 12345 wait '.product-list'
browser-cli --tab 12345 get count '.product-item'
browser-cli --tab 12345 snapshot -c
browser-cli --tab 12345 get text '.product-item:first-child .title'
browser-cli --tab 12345 get attr '.product-item:first-child a' href
```

### Fill a multi-step form

```bash
# Step 1
browser-cli find 'label="First Name"' fill John
browser-cli find 'label="Last Name"' fill Doe
browser-cli find 'role=button[name="Next"]'

# Step 2
browser-cli wait 'text=Address'
browser-cli find 'label=Address' fill "123 Main St"
browser-cli find 'label=City' fill "San Francisco"
browser-cli select 'select[name="state"]' CA
browser-cli find 'role=button[name="Submit"]'
```

### Work with iframes

```bash
browser-cli frame list                      # See all frames
browser-cli frame '#payment-iframe'         # Switch to iframe
browser-cli fill 'input[name="card"]' 4111111111111111
browser-cli frame main                      # Back to main page
```

### Block analytics and ads

```bash
browser-cli network route '*google-analytics*' --abort
browser-cli network route '*doubleclick.net*' --abort
browser-cli tab new https://example.com --group browser-cli
# Output: Tab 12345: ...
browser-cli --tab 12345 network routes                     # Verify active routes
```

### Tab management

```bash
browser-cli tab new https://example.com       # Open in new tab
browser-cli tab new https://example.com --group "Research"  # Open in named group (Chrome)
browser-cli tab                               # List all tabs
browser-cli tab 123                           # Switch to tab
browser-cli tab close                         # Close active tab
```

## Site-Specific Guides

For known websites, site-specific guides provide tested selectors and extraction
commands. Check for a matching guide before using generic extraction.

| Domain                                               | Guide                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| google.com                                           | [sites/google.com.md](references/sites/google.com.md)                       |
| mail.google.com                                      | [sites/mail.google.com.md](references/sites/mail.google.com.md)             |
| x.com                                                | [sites/x.com.md](references/sites/x.com.md)                                 |
| weixin.sogou.com                                     | [sites/weixin.sogou.com.md](references/sites/weixin.sogou.com.md)           |
| xiaohongshu.com                                      | [sites/xiaohongshu.com.md](references/sites/xiaohongshu.com.md)             |
| news.ycombinator.com                                 | [sites/news.ycombinator.com.md](references/sites/news.ycombinator.com.md)   |
| reddit.com                                           | [sites/reddit.com.md](references/sites/reddit.com.md)                       |
| linkedin.com                                         | [sites/linkedin.com.md](references/sites/linkedin.com.md)                   |
| jira (any Jira Server/DC instance)                   | [sites/jira-datacenter.md](references/sites/jira-datacenter.md)             |
| opensearch-dashboards (any self-hosted OSD instance) | [sites/opensearch-dashboards.md](references/sites/opensearch-dashboards.md) |
| scholar.google.com                                   | [sites/scholar.google.com.md](references/sites/scholar.google.com.md)       |
| youtube.com                                          | [sites/youtube.com.md](references/sites/youtube.com.md)                     |
| discord.com                                          | [sites/discord.com.md](references/sites/discord.com.md)                     |
| quora.com                                            | [sites/quora.com.md](references/sites/quora.com.md)                         |
| weibo.com                                            | [sites/weibo.com.md](references/sites/weibo.com.md)                         |

When no guide exists, fall back to: `snapshot -ic` → `markdown` → `eval`.

To add a new site guide, use the `site-guide` skill (invoke with `/site-guide <domain>`). See [sites/CONTRIBUTING.md](references/sites/CONTRIBUTING.md) for format conventions.

## Detailed References

For comprehensive documentation on each domain:

- [SETUP.md](references/SETUP.md) — CLI installation, extension installation (Chrome/Firefox), daemon startup, connection troubleshooting
- [SELECTOR_REFERENCE.md](references/SELECTOR_REFERENCE.md) — CSS selectors, semantic locators (role/text/label/placeholder/alt/title/testid/xpath), element refs, find command engines, position selectors, best practices
- [INTERACTION_REFERENCE.md](references/INTERACTION_REFERENCE.md) — click, fill, type, press, drag, check/uncheck, select, upload, mouse control, scroll, form filling patterns
- [QUERY_REFERENCE.md](references/QUERY_REFERENCE.md) — get/is queries, wait operations, snapshot flags, screenshot options, eval, console/errors, data extraction patterns
- [NETWORK_REFERENCE.md](references/NETWORK_REFERENCE.md) — network interception (route/unroute/watch), cookies, storage, tabs, frames, windows, dialogs, browser config, state save/load

## Known Limitations & Error Handling

### Avoid loops inside `eval` / `browser.evaluate()`

Never use `while` loops inside `eval` or `browser.evaluate()`. DOM changes triggered by `.click()` (class updates, animations) are asynchronous — a synchronous loop will spin forever and hang the tab. Put any loop logic in the script (CLI) layer where each step can be properly `await`ed.

For complex or rapid sequences of actions, add `browser.wait({ duration: <ms> })` between steps to let the page settle.

### Trusted Events (`--debugger`)

By default, interaction commands (`click`, `fill`, `type`, `press`) dispatch DOM events via JavaScript (`isTrusted=false`). Some websites and anti-bot services check `event.isTrusted` and reject synthetic events.

Add `--debugger` to use the Chrome DevTools Protocol for trusted input (`isTrusted=true`):

```bash
browser-cli click '#button' --debugger
browser-cli dblclick '.cell' --debugger
browser-cli hover '.menu' --debugger          # triggers CSS :hover
browser-cli fill '#input' 'hello' --debugger
browser-cli type '#input' 'world' --debugger
browser-cli press Enter --debugger
```

**How it works**: Attaches `chrome.debugger` to the tab, sends CDP `Input.dispatchMouseEvent`/`Input.dispatchKeyEvent` commands, then detaches. This produces real browser-level input events.

**Limitations**:

- Chrome only. On Firefox, `--debugger` prints a warning and falls back to the default JS dispatch.
- Cannot be used while Chrome DevTools is open on the target tab (only one debugger can attach at a time).
- Not supported for `check`, `uncheck`, `select`, `upload`.

### Hover limitation

By default, `hover` and `mouse move` use JS `dispatchEvent` to synthesize mouse events. These fire JS event listeners (`mouseenter`, `mouseover`, etc.) but **do not activate the CSS `:hover` pseudo-class** — only real OS-level mouse input does.

**Solution**: Use `--debugger` to send a real CDP `mouseMoved` event that triggers CSS `:hover`:

```bash
browser-cli hover '.dropdown-trigger' --debugger
browser-cli wait '.dropdown-menu'
browser-cli click '.dropdown-menu a:first-child'
```

**Fallback** (without `--debugger`): use `eval` to directly manipulate the hidden element's style:

```bash
browser-cli eval --stdin <<'EOF'
(() => {
  const dropdown = document.querySelector("<dropdown-selector>");
  dropdown.style.display = "block";  // force-show the CSS-hidden menu
  dropdown.querySelector("<menu-item>")?.click();
})()
EOF
```

### Remote access (public tunnel)

If you need to control a browser on a remote machine (or expose the daemon to the internet), use the included Cloudflare Tunnel script. **Always enable auth token** when exposing publicly:

```bash
# 1. Start daemon with auth (required for public exposure)
browser-cli start --auth            # auto-generate random token
# or: browser-cli start --token <your-secret>   # use a specific token

# 2. Start the tunnel (auto-detects port from running daemon)
./skills/browser-cli/scripts/tunnel.sh
# Prints a public WSS URL like: wss://abc-123.trycloudflare.com

# 3. Set the WSS URL in the remote browser extension settings to connect
```

Prerequisites: install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and `jq`. No Cloudflare account needed (uses TryCloudflare free tunnels).

### Error recovery

All commands return structured output. On error:

```
Error: ELEMENT_NOT_FOUND — No element matches selector "button.submit"
hint: Check the selector with `snapshot -ic` to see available interactive elements
```

**Error recovery loop** — when a command fails, follow this cycle:

1. **Read the `hint`** — every error includes a recovery suggestion, follow it first
2. **Element not found** → run `snapshot -ic` to see available elements, then retry with element refs (`@e1`) or semantic locators
3. **Timeout** → add `wait <selector>` or `wait --url <pattern>` before the command, or increase `--timeout`
4. **Frame error** → run `frame list` to see all frames, switch with `frame <selector>`, then retry
5. **Stale element** → re-run `snapshot -ic` to get fresh refs, then use updated `@eN` refs
6. **Extension disconnected** → run `browser-cli status` to check connection, restart with `browser-cli start` if needed

**General strategy**: snapshot → identify → wait → act → verify. Always run `snapshot -ic` before interacting with a new page or after navigation.
