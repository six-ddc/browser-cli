---
name: browser-cli
description: Automate a real browser via CLI — navigate pages, interact with elements, query data, manage tabs/cookies/storage, intercept network requests, and capture snapshots/screenshots. Uses a Chrome/Firefox extension + daemon architecture (no Playwright required).
allowed-tools: Bash(browser-cli:*)
---

# Browser-CLI Skill

Automate a real browser from the command line. Browser-CLI uses a Chrome/Firefox extension + daemon architecture — no Playwright or headless browser needed. It controls the user's actual browser with full access to extensions, login state, and cookies.

## Setup

Start the daemon before issuing commands:
```bash
browser-cli start              # default port 9222
browser-cli start --port 9333  # custom WebSocket port
```

Check connection status (daemon + extension):
```bash
browser-cli status
```

Stop the daemon when done:
```bash
browser-cli stop
```

Close the session (aliases: `quit`, `exit`):
```bash
browser-cli close
```

> The browser extension must be installed and connected. Run `browser-cli status` to verify.

## Quick Start Examples

### Navigate and inspect
```bash
browser-cli navigate https://example.com
browser-cli get title
browser-cli snapshot -ic
```

### Fill a form and submit
```bash
browser-cli fill 'input[name="email"]' user@example.com
browser-cli fill 'input[name="password"]' secret123
browser-cli click 'button[type="submit"]'
```

### Use semantic locators (AI-friendly)
```bash
browser-cli click 'role=button[name="Submit"]'
browser-cli fill 'label=Email' user@example.com
browser-cli click 'text=Sign In'
```

### Find + act in one step
```bash
browser-cli find role button click --name "Submit"
browser-cli find label Email fill user@example.com
browser-cli find text "Sign In"
```

### Use element refs from snapshot
```bash
browser-cli snapshot -ic          # Shows @e1, @e2, @e3...
browser-cli click @e3             # Click element ref
browser-cli fill @e5 "hello"      # Fill element ref
```

## Global Options

| Option | Description |
|--------|-------------|
| `--browser <sessionId>` | Target a specific browser connection by session ID (e.g., `brave-falcon`). Only needed with multiple browsers; get IDs from `browser-cli status` |
| `--json` | Output in JSON format (machine-readable) |

## Operations Reference

### Navigation

| Command | Description |
|---------|-------------|
| `navigate <url>` | Navigate to URL (aliases: `goto`, `open`) |
| `back` | Go back in history |
| `forward` | Go forward in history |
| `reload` | Reload the page |

### Element Interaction

| Command | Description |
|---------|-------------|
| `click <selector>` | Click element (`--button left/right/middle`) |
| `dblclick <selector>` | Double-click element |
| `hover <selector>` | Hover over element |
| `fill <selector> <value>` | Fill input (replaces content) |
| `type <selector> <text>` | Type text character-by-character (`--delay <ms>`) |
| `press <key>` | Press key at page level (alias: `key`). Examples: `Enter`, `Tab`, `Control+a` |
| `clear <selector>` | Clear an input field |
| `focus <selector>` | Focus an element |
| `check <selector>` | Check a checkbox/radio |
| `uncheck <selector>` | Uncheck a checkbox |
| `select <selector> <value>` | Select dropdown option |
| `upload <selector> <files...>` | Upload files (`--clear` to clear first) |
| `drag <source> <target>` | Drag element to target |
| `keydown <key>` | Press key down without releasing |
| `keyup <key>` | Release a held key |

### Find Command (Semantic Locate + Act)

`find <engine> <value> [action] [action-value]` — locate element and perform action in one step.

**Engines**: `role`, `text`, `label`, `placeholder`, `alt`, `title`, `testid`, `xpath`
**Position selectors**: `first`, `last`, `nth`
**Actions**: `click` (default), `dblclick`, `fill`, `type`, `hover`, `check`, `uncheck`, `select`, `press`, `clear`, `focus`

| Example | Description |
|---------|-------------|
| `find role button click` | Click first button |
| `find role button --name "Submit"` | Click button named "Submit" (default action: click) |
| `find text "Sign In"` | Click element with text "Sign In" |
| `find label Email fill user@test.com` | Fill input labeled "Email" |
| `find placeholder Search... fill query` | Fill by placeholder |
| `find testid login-btn click` | Click by test ID |
| `find xpath "//button[@type='submit']" click` | Click by XPath |
| `find first .item click` | Click first matching `.item` |
| `find nth 2 .item click` | Click 2nd matching `.item` |

Options: `--name <name>` (for role engine), `--exact` (exact text match)

### Snapshot (Accessibility Tree)

```bash
browser-cli snapshot [options]
```

| Flag | Description |
|------|-------------|
| `-i, --interactive` | Only interactive elements |
| `-c, --compact` | Compact output |
| `-C, --cursor` | Include cursor-interactive elements (cursor:pointer) |
| `-d, --depth <n>` | Max tree depth |
| `-s, --selector <sel>` | Scope to element |

**Best practice**: Use `snapshot -ic` for a concise view of interactive elements. Use element refs (`@e1`, `@e2`) from snapshot output in subsequent commands.

### Markdown (Page Content Extraction)

```bash
browser-cli markdown
```

Extracts the current page's readable content using Defuddle and converts it to Markdown. Long query strings in URLs are automatically trimmed. Useful for AI agents consuming page content.

### Screenshot

```bash
browser-cli screenshot [options]
```

| Option | Description |
|--------|-------------|
| `--selector <sel>` | Element screenshot |
| `--path <path>` | Save path (default: screenshot.png) |
| `--format <fmt>` | `png` or `jpeg` |
| `--quality <n>` | JPEG quality 0-100 |

### Data Queries (get)

| Command | Description |
|---------|-------------|
| `get url` | Current page URL |
| `get title` | Current page title |
| `get text <selector>` | Text content of element |
| `get html <selector>` | innerHTML (`--outer` for outerHTML) |
| `get value <selector>` | Input value |
| `get attr <selector> <attribute>` | Attribute value |
| `get count <selector>` | Count matching elements |
| `get box <selector>` | Bounding box (x, y, width, height) |

### State Queries (is)

| Command | Description |
|---------|-------------|
| `is visible <selector>` | Check visibility |
| `is enabled <selector>` | Check enabled state |
| `is checked <selector>` | Check checked state |

### Wait Operations

| Command | Description |
|---------|-------------|
| `wait <selector>` | Wait for element to appear (`--timeout <ms>`, `--hidden`) |
| `wait <ms>` | Wait for duration (auto-detects numeric) |
| `wait --url <pattern>` | Wait for URL to match |
| `wait --text <text>` | Wait for text to appear on page |
| `wait --load [state]` | Wait for load state: `load`, `domcontentloaded`, `networkidle` |
| `wait --fn <expression>` | Wait for JS expression to return truthy |
| `waitforurl <pattern>` | Alias for `wait --url` |

### Tab Management

| Command | Description |
|---------|-------------|
| `tab` | List all tabs |
| `tab <n>` | Switch to tab by ID |
| `tab new [url]` | Open new tab |
| `tab list` | List all tabs |
| `tab close [tabId]` | Close tab (default: active) |

### Frame Management (iframe)

| Command | Description |
|---------|-------------|
| `frame <selector>` | Switch to iframe |
| `frame main` | Switch back to main frame |
| `frame list` | List all frames |
| `frame current` | Show current frame info |

### Cookies

| Command | Description |
|---------|-------------|
| `cookies` | List all cookies |
| `cookies get [name]` | Get cookies (`--url`, `--domain`) |
| `cookies set <name> <value>` | Set cookie (`--url` required, `--domain`, `--path`, `--secure`, `--httponly`, `--samesite`) |
| `cookies clear` | Clear cookies (`--url`, `--domain`) |

### Storage (localStorage / sessionStorage)

| Command | Description |
|---------|-------------|
| `storage local [key]` | Get localStorage value(s) |
| `storage local set <key> <value>` | Set localStorage |
| `storage local clear` | Clear localStorage |
| `storage session [key]` | Get sessionStorage value(s) |
| `storage session set <key> <value>` | Set sessionStorage |
| `storage session clear` | Clear sessionStorage |

### Network Interception

| Command | Description |
|---------|-------------|
| `network route <pattern> --abort` | Block requests matching pattern |
| `network route <pattern> --redirect <url>` | Redirect matching requests |
| `network unroute <routeId>` | Remove a route |
| `network routes` | List active routes |
| `network requests` | List tracked requests (`--pattern`, `--tab`, `--blocked`, `--limit`) |
| `network clear` | Clear tracked requests |

### Scroll Operations

| Command | Description |
|---------|-------------|
| `scroll <direction>` | Scroll page: `up`, `down`, `left`, `right` (`--amount <px>`, `--selector <sel>`) |
| `scrollintoview <selector>` | Scroll element into view |

### JavaScript Execution

```bash
browser-cli eval '<expression>'
browser-cli eval -b/--base64 '<base64-encoded-expression>'  # decode from base64
echo '<expression>' | browser-cli eval --stdin       # read from stdin
```

Evaluates JavaScript in the page context and returns the result.

### Console & Errors

| Command | Description |
|---------|-------------|
| `console` | Get console output (`--level log/warn/error/info/debug`, `--clear`) |
| `errors` | Get page errors |

### Dialog Handling

| Command | Description |
|---------|-------------|
| `dialog accept [text]` | Auto-accept next dialog (optional prompt text) |
| `dialog dismiss` | Auto-dismiss next dialog |

### Element Highlight

```bash
browser-cli highlight <selector> [--color <color>] [--duration <ms>]
```

### Mouse Control (Low-level)

| Command | Description |
|---------|-------------|
| `mouse move <x> <y>` | Move mouse to coordinates |
| `mouse down [button]` | Press mouse button |
| `mouse up [button]` | Release mouse button |
| `mouse wheel <deltaY> [deltaX]` | Scroll mouse wheel |

### Window Management

| Command | Description |
|---------|-------------|
| `window` | List windows |
| `window new [url]` | Open new window |
| `window list` | List windows |
| `window close [windowId]` | Close window |

### Browser Configuration

| Command | Description |
|---------|-------------|
| `set viewport <width> <height>` | Set viewport size |
| `set geo <lat> <lng>` | Override geolocation (`--accuracy <m>`) |
| `set media <colorScheme>` | Override media preference (dark/light) |
| `set headers <json>` | Set extra HTTP headers |

### State Management (Save/Load)

| Command | Description |
|---------|-------------|
| `state save <path>` | Export cookies + localStorage + sessionStorage to JSON file |
| `state load <path>` | Import cookies + storage from JSON file |

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

## Detailed References

For comprehensive documentation on each domain:

- **Interaction**: See `references/INTERACTION_REFERENCE.md`
- **Selectors & Find**: See `references/SELECTOR_REFERENCE.md`
- **Data Queries**: See `references/QUERY_REFERENCE.md`
- **Network**: See `references/NETWORK_REFERENCE.md`

## Common Workflows

### Login to a website
```bash
browser-cli navigate https://app.example.com/login
browser-cli snapshot -ic
browser-cli find label Username fill admin
browser-cli find label Password fill secret123
browser-cli find role button --name "Log In"
browser-cli wait --url '**/dashboard*'
browser-cli get title
```

### Scrape data from a page
```bash
browser-cli navigate https://example.com/products
browser-cli wait '.product-list'
browser-cli get count '.product-item'
browser-cli snapshot -c
browser-cli get text '.product-item:first-child .title'
browser-cli get attr '.product-item:first-child a' href
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
browser-cli navigate https://example.com
browser-cli network requests --blocked        # Verify blocked requests
```

### Tab management
```bash
browser-cli tab new https://example.com       # Open in new tab
browser-cli tab                               # List all tabs
browser-cli tab 123                           # Switch to tab
browser-cli tab close                         # Close active tab
```

## Error Handling

All commands return structured output. On error, you'll see:
```
Error: ELEMENT_NOT_FOUND — No element matches selector "button.submit"
hint: Check the selector with `snapshot -ic` to see available interactive elements
```

**Error recovery strategy:**
1. Run `snapshot -ic` to see current interactive elements
2. Use element refs (`@e1`) or semantic locators instead of brittle CSS selectors
3. Add `wait <selector>` before interacting with dynamically loaded elements
4. Check `browser-cli status` if commands timeout (extension may be disconnected)
