# Network, Cookies, Storage & Browser Config Reference

Comprehensive documentation for network interception, cookie management, storage access, tab/frame/window management, dialog handling, and browser configuration in Browser-CLI.

## Network Interception

Browser-CLI uses MV3 `declarativeNetRequest` for network interception. This supports blocking and redirecting requests (but not modifying request/response bodies due to MV3 limitations).

### route - Add Network Route

```bash
browser-cli network route <pattern> --abort
browser-cli network route <pattern> --redirect <url>
```

| Option             | Description                       |
| ------------------ | --------------------------------- |
| `--abort`          | Block/abort matching requests     |
| `--redirect <url>` | Redirect matching requests to URL |

**Pattern**: URL match pattern (glob-style).

**Examples:**

```bash
# Block analytics
browser-cli network route '*google-analytics*' --abort
browser-cli network route '*doubleclick.net*' --abort

# Redirect API calls
browser-cli network route '*api.example.com/v1*' --redirect 'http://localhost:3000/mock'
```

### unroute - Remove Route

```bash
browser-cli network unroute <routeId>
```

### routes - List Active Routes

```bash
browser-cli network routes
```

### requests - List Tracked Requests

```bash
browser-cli network requests [options]
```

| Option                | Description                  | Default |
| --------------------- | ---------------------------- | ------- |
| `--pattern <pattern>` | Filter by URL pattern        | -       |
| `--tab <tabId>`       | Filter by tab ID             | -       |
| `--blocked`           | Only show blocked/redirected | `false` |
| `--limit <n>`         | Max results                  | `50`    |

### clear - Clear Tracked Requests

```bash
browser-cli network clear
```

### Common Patterns

```bash
# Block ads and tracking
browser-cli network route '*ads*' --abort
browser-cli network route '*tracker*' --abort
browser-cli network route '*analytics*' --abort

# Navigate and verify
browser-cli navigate https://example.com
browser-cli network requests --blocked

# Clean up
browser-cli network routes                    # List active routes
browser-cli network unroute 1                 # Remove by ID
browser-cli network clear                     # Clear request log
```

---

## Cookie Management

### cookies (bare) - List All Cookies

```bash
browser-cli cookies
```

### cookies get - Get Cookies

```bash
browser-cli cookies get [name] [--url <url>] [--domain <domain>]
```

**Examples:**

```bash
browser-cli cookies                           # All cookies
browser-cli cookies get session_id            # By name
browser-cli cookies get --domain example.com  # By domain
browser-cli cookies get --url https://example.com/page
```

### cookies set - Set a Cookie

```bash
browser-cli cookies set <name> <value> [options]
```

| Option              | Description                       |
| ------------------- | --------------------------------- |
| `--url <url>`       | URL for the cookie (required)     |
| `--domain <domain>` | Cookie domain                     |
| `--path <path>`     | Cookie path                       |
| `--secure`          | Secure flag                       |
| `--httponly`        | HttpOnly flag                     |
| `--samesite <v>`    | `no_restriction`, `lax`, `strict` |

**Examples:**

```bash
browser-cli cookies set token abc123 --url https://example.com
browser-cli cookies set pref dark --url https://example.com --path / --samesite lax
browser-cli cookies set session xyz --url https://api.example.com --secure --httponly
```

### cookies clear - Clear Cookies

```bash
browser-cli cookies clear [--url <url>] [--domain <domain>]
```

**Examples:**

```bash
browser-cli cookies clear                     # Clear all
browser-cli cookies clear --domain example.com
browser-cli cookies clear --url https://example.com
```

---

## Storage (localStorage / sessionStorage)

### Read Storage

```bash
browser-cli storage local [key]              # Get localStorage
browser-cli storage session [key]            # Get sessionStorage
```

Without `key`, returns all entries. With `key`, returns specific value.

### Write Storage

```bash
browser-cli storage local set <key> <value>
browser-cli storage session set <key> <value>
```

### Clear Storage

```bash
browser-cli storage local clear
browser-cli storage session clear
```

**Examples:**

```bash
# Read
browser-cli storage local                    # All localStorage
browser-cli storage local theme              # Specific key
browser-cli storage session token            # sessionStorage key

# Write
browser-cli storage local set theme dark
browser-cli storage session set cart '{"items":[]}'

# Clear
browser-cli storage local clear
browser-cli storage session clear
```

---

## Tab Management

```bash
browser-cli tab                              # List all tabs
browser-cli tab <n>                          # Switch to tab by ID
browser-cli tab new [url]                    # Open new tab
browser-cli tab list                         # List all tabs
browser-cli tab close [tabId]               # Close tab (default: active)
```

**Examples:**

```bash
browser-cli tab                              # See all open tabs
browser-cli tab new https://example.com      # Open in new tab
browser-cli tab 42                           # Switch to tab 42
browser-cli tab close                        # Close current tab
browser-cli tab close 42                     # Close specific tab
```

---

## Frame Management (iframe)

```bash
browser-cli frame <selector>                 # Switch to iframe
browser-cli frame main                       # Back to main frame
browser-cli frame list                       # List all frames
browser-cli frame current                    # Show current frame
```

**Examples:**

```bash
# Work inside an iframe
browser-cli frame list                       # Find frames
browser-cli frame '#payment-frame'           # Enter iframe
browser-cli fill 'input[name="card"]' 4111111111111111
browser-cli fill 'input[name="expiry"]' 12/26
browser-cli frame main                       # Back to main

# Nested iframes
browser-cli frame '#outer-frame'
browser-cli frame '#inner-frame'
browser-cli click '#submit'
browser-cli frame main                       # Back to top
```

---

## Window Management

```bash
browser-cli window                           # List windows
browser-cli window new [url]                 # Open new window
browser-cli window list                      # List windows
browser-cli window close [windowId]          # Close window
```

---

## Dialog Handling

Pre-configure how to handle the next browser dialog (alert/confirm/prompt):

```bash
browser-cli dialog accept [text]             # Accept (optionally with prompt text)
browser-cli dialog dismiss                   # Dismiss/cancel
```

**Important**: Set the handler _before_ triggering the dialog.

**Examples:**

```bash
# Handle an alert
browser-cli dialog accept
browser-cli click '#show-alert'

# Handle a confirm
browser-cli dialog dismiss
browser-cli click '#delete-button'

# Handle a prompt
browser-cli dialog accept "John Doe"
browser-cli click '#ask-name'
```

---

## Browser Configuration

### set viewport - Set Viewport Size

```bash
browser-cli set viewport <width> <height>
```

**Examples:**

```bash
browser-cli set viewport 1920 1080           # Desktop
browser-cli set viewport 375 812             # iPhone X
browser-cli set viewport 768 1024            # iPad
```

### set geo - Override Geolocation

```bash
browser-cli set geo <latitude> <longitude> [--accuracy <meters>]   # default: 100m
```

**Examples:**

```bash
browser-cli set geo 37.7749 -122.4194                   # San Francisco
browser-cli set geo 51.5074 -0.1278 --accuracy 10       # London, 10m accuracy
```

### set media - Override Media Preference

```bash
browser-cli set media <colorScheme>
```

**Examples:**

```bash
browser-cli set media dark                   # Dark mode
browser-cli set media light                  # Light mode
```

### set headers - Set Extra HTTP Headers

```bash
browser-cli set headers '<json>'
```

**Examples:**

```bash
browser-cli set headers '{"X-Custom-Header": "value"}'
browser-cli set headers '{"Authorization": "Bearer token123"}'
```

---

## Element Highlight

```bash
browser-cli highlight <selector> [--color <color>] [--duration <ms>]
```

| Option       | Default   | Description     |
| ------------ | --------- | --------------- |
| `--color`    | `#2196F3` | Highlight color |
| `--duration` | `2000`    | Duration in ms  |

**Examples:**

```bash
browser-cli highlight '#submit-btn'
browser-cli highlight '.error' --color red --duration 5000
```

---

## State Management (Save/Load)

Save and restore browser state (cookies + localStorage + sessionStorage) to a JSON file. Useful for preserving login sessions across runs.

### state save - Export State

```bash
browser-cli state save <path>
```

Exports cookies, localStorage, and sessionStorage to a JSON file.

**Examples:**

```bash
browser-cli state save ./session.json
browser-cli state save /tmp/auth-state.json
```

### state load - Import State

```bash
browser-cli state load <path>
```

Imports cookies and storage from a previously saved JSON file.

**Examples:**

```bash
browser-cli state load ./session.json
browser-cli state load /tmp/auth-state.json
```

### Common Pattern

```bash
# Save state after login
browser-cli navigate https://app.example.com/login
browser-cli find label Email fill admin@example.com
browser-cli find label Password fill secret
browser-cli find role button --name "Log In"
browser-cli wait --url '**/dashboard*'
browser-cli state save ./auth.json

# Restore state in a later session
browser-cli state load ./auth.json
browser-cli navigate https://app.example.com/dashboard
```

---

## Best Practices

1. **Set up network blocks early**: Block analytics/ads before navigating to speed up page loads.

2. **Use cookies for auth**: Set auth cookies with `cookies set` to bypass login forms in testing.

3. **Dialog handlers are one-shot**: Each `dialog accept/dismiss` handles only the next dialog. Set it again for subsequent dialogs.

4. **Frame switching is stateful**: Remember to `frame main` after working in an iframe, or subsequent commands will target the iframe.

5. **Viewport affects layout**: Set viewport before navigating for consistent responsive behavior.
