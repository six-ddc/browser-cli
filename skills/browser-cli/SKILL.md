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

Run `browser-cli status` to check readiness. If the command fails or shows no connected sessions, follow the [Setup Guide](references/SETUP.md) to install the CLI and browser extension.

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
| `--session <sessionId>` | Target a specific browser connection by session ID (e.g., `brave-falcon`). Only needed with multiple browsers; get IDs from `browser-cli status`                                                   |
| `--tab <tabId>`         | Target a specific tab by ID (get IDs from `tab list`). Commands run against this tab instead of the active tab. For `screenshot`, the tab is auto-switched to active first (Chrome API limitation) |
| `--json`                | Output in JSON format (machine-readable)                                                                                                                                                           |

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
| `wait <selector>`        | Wait for element to appear (`--timeout <ms>`, `--hidden`)                |
| `wait <ms>`              | Wait for duration (auto-detects numeric)                                 |
| `wait --url <pattern>`   | Wait for URL to match                                                    |
| `wait --text <text>`     | Wait for text content to appear on page                                  |
| `wait --load [state]`    | Wait for load state: `load` (default), `domcontentloaded`, `networkidle` |
| `wait --fn <expression>` | Wait for JS expression to return truthy                                  |
| `waitforurl <pattern>`   | Alias for `wait --url`                                                   |

### Element Interaction

#### Basic Interaction

| Command                        | Description                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `click <selector>`             | Click element (`--button left/right/middle`, `--debugger`)                                  |
| `dblclick <selector>`          | Double-click element                                                                        |
| `hover <selector>`             | Hover over element                                                                          |
| `fill <selector> <value>`      | Fill input (replaces content) (`--debugger`)                                                |
| `type <selector> <text>`       | Type text character-by-character (`--delay <ms>`, `--debugger`)                             |
| `press <key>`                  | Press key at page level (alias: `key`, `--debugger`). Examples: `Enter`, `Tab`, `Control+a` |
| `clear <selector>`             | Clear an input field                                                                        |
| `focus <selector>`             | Focus an element                                                                            |
| `check <selector>`             | Check a checkbox/radio                                                                      |
| `uncheck <selector>`           | Uncheck a checkbox                                                                          |
| `select <selector> <value>`    | Select dropdown option (matches by value, text, or label)                                   |
| `upload <selector> <files...>` | Upload files (`--clear` to clear first)                                                     |
| `drag <source> <target>`       | Drag element to target                                                                      |
| `keydown <key>`                | Press key down without releasing                                                            |
| `keyup <key>`                  | Release a held key                                                                          |

#### Find Command (Semantic Locate + Act)

`find <engine> <value> [action] [action-value]` — locate element and perform action in one step.

**Engines**: `role`, `text`, `label`, `placeholder`, `alt`, `title`, `testid`, `xpath`
**Position selectors**: `first`, `last`, `nth`
**Actions**: `click` (default), `dblclick`, `fill`, `type`, `hover`, `check`, `uncheck`, `select`, `press`, `clear`, `focus`

| Example                                       | Description                                         |
| --------------------------------------------- | --------------------------------------------------- |
| `find role button click`                      | Click first button                                  |
| `find role button --name "Submit"`            | Click button named "Submit" (default action: click) |
| `find text "Sign In"`                         | Click element with text "Sign In"                   |
| `find label Email fill user@test.com`         | Fill input labeled "Email"                          |
| `find placeholder Search... fill query`       | Fill by placeholder                                 |
| `find testid login-btn click`                 | Click by test ID                                    |
| `find xpath "//button[@type='submit']" click` | Click by XPath                                      |
| `find first .item click`                      | Click first matching `.item`                        |
| `find nth 2 .item click`                      | Click 2nd matching `.item`                          |

Options: `--name <name>` (for role engine), `--exact` (exact text match)

#### Scroll

| Command                     | Description                                                                      |
| --------------------------- | -------------------------------------------------------------------------------- |
| `scroll <direction>`        | Scroll page: `up`, `down`, `left`, `right` (`--amount <px>`, `--selector <sel>`) |
| `scrollintoview <selector>` | Scroll element into view                                                         |

#### Mouse Control (Low-level)

| Command                         | Description               |
| ------------------------------- | ------------------------- |
| `mouse move <x> <y>`            | Move mouse to coordinates |
| `mouse down [button]`           | Press mouse button        |
| `mouse up [button]`             | Release mouse button      |
| `mouse wheel <deltaY> [deltaX]` | Scroll mouse wheel        |

#### Element Highlight

```bash
browser-cli highlight <selector> [--color <color>] [--duration <ms>]
```

### Page Content & Data

#### Snapshot (Accessibility Tree)

```bash
browser-cli snapshot [options]
```

| Flag                   | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `-i, --interactive`    | Only interactive elements                            |
| `-c, --compact`        | Compact output                                       |
| `-C, --cursor`         | Include cursor-interactive elements (cursor:pointer) |
| `-d, --depth <n>`      | Max tree depth                                       |
| `-s, --selector <sel>` | Scope to element                                     |

**Best practice**: Use `snapshot -ic` for a concise view of interactive elements. Use element refs (`@e1`, `@e2`) from snapshot output in subsequent commands.

#### Markdown (Page Content Extraction)

```bash
browser-cli markdown
```

Extracts the current page's readable content using Defuddle and converts it to Markdown. Long query strings in URLs are automatically trimmed. Useful for AI agents consuming page content.

#### Screenshot

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

| Command                           | Description                         |
| --------------------------------- | ----------------------------------- |
| `get url`                         | Current page URL                    |
| `get title`                       | Current page title                  |
| `get text <selector>`             | Text content of element             |
| `get html <selector>`             | innerHTML (`--outer` for outerHTML) |
| `get value <selector>`            | Input value                         |
| `get attr <selector> <attribute>` | Attribute value                     |
| `get count <selector>`            | Count matching elements             |
| `get box <selector>`              | Bounding box (x, y, width, height)  |

#### State Queries (is)

| Command                 | Description         |
| ----------------------- | ------------------- |
| `is visible <selector>` | Check visibility    |
| `is enabled <selector>` | Check enabled state |
| `is checked <selector>` | Check checked state |

#### JavaScript Execution

```bash
browser-cli eval '<expression>'
browser-cli eval -b/--base64 '<base64-encoded-expression>'  # decode from base64
echo '<expression>' | browser-cli eval --stdin       # read from stdin
```

Evaluates JavaScript in the page context and returns the result. CSP-strict pages (Gmail, GitHub, etc.) are handled automatically with platform-specific fallbacks.

#### Console & Errors

| Command   | Description                                                         |
| --------- | ------------------------------------------------------------------- |
| `console` | Get console output (`--level log/warn/error/info/debug`, `--clear`) |
| `errors`  | Get page errors                                                     |

### Tabs, Windows & Frames

#### Tab Management

| Command                                                                  | Description                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| `tab`                                                                    | List all tabs                                           |
| `tab <n>`                                                                | Switch to tab by ID                                     |
| `tab new [url] [--group <name>] [--container <name>]`                    | Open new tab (optionally in a named group or container) |
| `tab list`                                                               | List all tabs                                           |
| `tab close [tabId]`                                                      | Close tab (default: active)                             |
| `tab group <tabIds...>`                                                  | Group tabs together (Chrome only)                       |
| `tab group update <groupId> [--title] [--color] [--collapse] [--expand]` | Update a tab group (Chrome only)                        |
| `tab groups`                                                             | List all tab groups (Chrome only)                       |
| `tab ungroup <tabIds...>`                                                | Remove tabs from their group (Chrome only)              |

**Tab group colors**: `grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`

#### Window Management

| Command                   | Description                          |
| ------------------------- | ------------------------------------ |
| `window`                  | List windows                         |
| `window new [url]`        | Open new window                      |
| `window list`             | List windows                         |
| `window close [windowId]` | Close window                         |
| `window focus [windowId]` | Focus a window (defaults to current) |

#### Frame Management (iframe)

| Command            | Description               |
| ------------------ | ------------------------- |
| `frame <selector>` | Switch to iframe          |
| `frame main`       | Switch back to main frame |
| `frame list`       | List all frames           |
| `frame current`    | Show current frame info   |

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
| `cookies`                    | List all cookies                                                                            |
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

| Command                                    | Description                                                          |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `network route <pattern> --abort`          | Block requests matching pattern                                      |
| `network route <pattern> --redirect <url>` | Redirect matching requests                                           |
| `network unroute <routeId>`                | Remove a route                                                       |
| `network routes`                           | List active routes                                                   |
| `network requests`                         | List tracked requests (`--pattern`, `--tab`, `--blocked`, `--limit`) |
| `network clear`                            | Clear tracked requests                                               |

#### Dialog Handling

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `dialog accept [text]` | Auto-accept next dialog (optional prompt text) |
| `dialog dismiss`       | Auto-dismiss next dialog                       |

#### Browser Configuration

| Command                         | Description                             |
| ------------------------------- | --------------------------------------- |
| `set viewport <width> <height>` | Set viewport size                       |
| `set geo <lat> <lng>`           | Override geolocation (`--accuracy <m>`) |
| `set media <colorScheme>`       | Override media preference (dark/light)  |
| `set headers <json>`            | Set extra HTTP headers                  |

#### Bookmarks

| Command                      | Description                         |
| ---------------------------- | ----------------------------------- |
| `bookmark [search]`          | List bookmarks or search by keyword |
| `bookmark add <url> [title]` | Add a bookmark                      |
| `bookmark remove <id>`       | Remove a bookmark by ID             |

#### History

| Command                 | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `history [--limit N]`   | List recent browser history (default: 20 entries) |
| `history search <text>` | Search browser history by text (`--limit N`)      |

#### State Management (Save/Load)

| Command             | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `state save <path>` | Export cookies + localStorage + sessionStorage to JSON file |
| `state load <path>` | Import cookies + storage from JSON file                     |

## Script Execution

Run multi-step browser automation as a single operation. Unlike `eval` (which runs a single JS expression in the page context), `script` runs an ES module in the **CLI process (Node.js)** and dispatches each `browser.xxx()` call through the CLI → Daemon → Extension pipeline. This means scripts can use Node.js APIs, `process.env`, and npm packages.

| Command                                    | Description                               |
| ------------------------------------------ | ----------------------------------------- |
| `script <file.js>`                         | Run script from file (default export)     |
| `script -`                                 | Read script from stdin                    |
| `script <file> --call <name>`              | Call a named export instead of default    |
| `script <file> --call <name> -- [args...]` | Call named export with arguments          |
| `script <file> --list`                     | List all exported functions in the script |
| `script <file> --timeout <ms>`             | Run script with per-command timeout       |
| `script <file> -- [args...]`               | Pass arguments to the script              |

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
browser-cli --tab 12345 find label Username fill admin
browser-cli --tab 12345 find label Password fill secret123
browser-cli --tab 12345 find role button --name "Log In"
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
browser-cli find label "First Name" fill John
browser-cli find label "Last Name" fill Doe
browser-cli find role button --name "Next"

# Step 2
browser-cli wait 'text=Address'
browser-cli find label Address fill "123 Main St"
browser-cli find label City fill "San Francisco"
browser-cli select 'select[name="state"]' CA
browser-cli find role button --name "Submit"
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
browser-cli --tab 12345 network requests --blocked        # Verify blocked requests
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

| Domain               | Guide                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| google.com           | [sites/google.com.md](references/sites/google.com.md)                     |
| mail.google.com      | [sites/mail.google.com.md](references/sites/mail.google.com.md)           |
| x.com                | [sites/x.com.md](references/sites/x.com.md)                               |
| weixin.sogou.com     | [sites/weixin.sogou.com.md](references/sites/weixin.sogou.com.md)         |
| xiaohongshu.com      | [sites/xiaohongshu.com.md](references/sites/xiaohongshu.com.md)           |
| news.ycombinator.com | [sites/news.ycombinator.com.md](references/sites/news.ycombinator.com.md) |
| reddit.com           | [sites/reddit.com.md](references/sites/reddit.com.md)                     |

When no guide exists, fall back to: `snapshot -ic` → `markdown` → `eval`.

To add a new site guide, see [sites/CONTRIBUTING.md](references/sites/CONTRIBUTING.md).

## Detailed References

For comprehensive documentation on each domain:

- [SETUP.md](references/SETUP.md) — CLI installation, extension installation (Chrome/Firefox), daemon startup, connection troubleshooting
- [SELECTOR_REFERENCE.md](references/SELECTOR_REFERENCE.md) — CSS selectors, semantic locators (role/text/label/placeholder/alt/title/testid/xpath), element refs, find command engines, position selectors, best practices
- [INTERACTION_REFERENCE.md](references/INTERACTION_REFERENCE.md) — click, fill, type, press, drag, check/uncheck, select, upload, mouse control, scroll, form filling patterns
- [QUERY_REFERENCE.md](references/QUERY_REFERENCE.md) — get/is queries, wait operations, snapshot flags, screenshot options, eval, console/errors, data extraction patterns
- [NETWORK_REFERENCE.md](references/NETWORK_REFERENCE.md) — network interception (route/unroute/requests), cookies, storage, tabs, frames, windows, dialogs, browser config, state save/load

## Known Limitations & Error Handling

### Trusted Events (`--debugger`)

By default, interaction commands (`click`, `fill`, `type`, `press`) dispatch DOM events via JavaScript (`isTrusted=false`). Some websites and anti-bot services check `event.isTrusted` and reject synthetic events.

Add `--debugger` to use the Chrome DevTools Protocol for trusted input (`isTrusted=true`):

```bash
browser-cli click '#button' --debugger
browser-cli fill '#input' 'hello' --debugger
browser-cli type '#input' 'world' --debugger
browser-cli press Enter --debugger
```

**How it works**: Attaches `chrome.debugger` to the tab, sends CDP `Input.dispatchMouseEvent`/`Input.dispatchKeyEvent` commands, then detaches. This produces real browser-level input events.

**Limitations**:

- Chrome only. On Firefox, `--debugger` prints a warning and falls back to the default JS dispatch.
- Cannot be used while Chrome DevTools is open on the target tab (only one debugger can attach at a time).
- Not supported for `dblclick`, `hover`, `check`, `uncheck`, `select`, `upload`.

### Hover limitation

`hover` and `mouse move` use JS `dispatchEvent` to synthesize mouse events. These fire JS event listeners (`mouseenter`, `mouseover`, etc.) but **do not activate the CSS `:hover` pseudo-class** — only real OS-level mouse input does. Hover menus/dropdowns that rely on CSS `:hover` will not appear.

**Workaround**: use `eval` to directly manipulate the hidden element's style:

```bash
browser-cli eval --stdin <<'EOF'
(() => {
  const dropdown = document.querySelector("<dropdown-selector>");
  dropdown.style.display = "block";  // force-show the CSS-hidden menu
  dropdown.querySelector("<menu-item>")?.click();
})()
EOF
```

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
