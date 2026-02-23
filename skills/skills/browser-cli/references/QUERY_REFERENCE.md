# Data Query & Wait Reference

Comprehensive documentation for data queries, state queries, wait operations, snapshot, screenshot, JavaScript evaluation, and console access in Browser-CLI.

## Overview

Browser-CLI provides commands to extract data from the page (`get`, `is`), wait for conditions (`wait`), capture visual state (`snapshot`, `screenshot`), execute JavaScript (`eval`), and read console output.

## Data Queries (get)

### get url - Get Current URL

```bash
browser-cli get url
```

**Response:** `https://example.com/page`

---

### get title - Get Page Title

```bash
browser-cli get title
```

**Response:** `Example Domain`

---

### get text - Get Element Text Content

```bash
browser-cli get text <selector>
```

Returns the `textContent` of the matched element.

**Examples:**

```bash
browser-cli get text 'h1'
browser-cli get text '.price'
browser-cli get text @e3
```

---

### get html - Get Element HTML

```bash
browser-cli get html <selector> [--outer]
```

| Option    | Description                           |
| --------- | ------------------------------------- |
| `--outer` | Return outerHTML instead of innerHTML |

**Examples:**

```bash
browser-cli get html '.content'
browser-cli get html '#article' --outer
```

---

### get value - Get Input Value

```bash
browser-cli get value <selector>
```

Returns the `value` property of an input, textarea, or select element.

**Examples:**

```bash
browser-cli get value 'input[name="email"]'
browser-cli get value '#search-box'
browser-cli get value @e5
```

---

### get attr - Get Attribute Value

```bash
browser-cli get attr <selector> <attribute>
```

**Examples:**

```bash
browser-cli get attr 'a.logo' href
browser-cli get attr 'img' src
browser-cli get attr '#form' action
browser-cli get attr @e2 data-id
```

---

### get count - Count Matching Elements

```bash
browser-cli get count <selector>
```

**Response:** `42`

**Examples:**

```bash
browser-cli get count '.product-item'
browser-cli get count 'tr'
browser-cli get count 'input[type="checkbox"]:checked'
```

---

### get box - Get Bounding Box

```bash
browser-cli get box <selector>
```

Returns the element's bounding rectangle as `x=N y=N w=N h=N` (plain text format).

**Examples:**

```bash
browser-cli get box '#hero-image'
browser-cli get box '.modal'
```

---

## State Queries (is)

### is visible

```bash
browser-cli is visible <selector>
```

**Response:** `true` or `false`

### is enabled

```bash
browser-cli is enabled <selector>
```

### is checked

```bash
browser-cli is checked <selector>
```

**Examples:**

```bash
browser-cli is visible '.error-message'
browser-cli is enabled '#submit-btn'
browser-cli is checked 'input[name="agree"]'
```

---

## Wait Operations

### wait (selector) - Wait for Element

```bash
browser-cli wait <selector> [--timeout <ms>] [--hidden]
```

| Option      | Description                  | Default |
| ----------- | ---------------------------- | ------- |
| `--timeout` | Timeout in ms                | `10000` |
| `--hidden`  | Wait until element is hidden | `false` |

**Examples:**

```bash
browser-cli wait '.loading-spinner' --hidden
browser-cli wait '#content'
browser-cli wait 'role=button[name="Submit"]' --timeout 5000
```

### wait (duration) - Wait for Time

```bash
browser-cli wait <ms>
```

Auto-detects numeric values as durations.

**Examples:**

```bash
browser-cli wait 1000           # Wait 1 second
browser-cli wait 500            # Wait 500ms
```

### wait --url - Wait for URL

```bash
browser-cli wait --url <pattern> [--timeout <ms>]
```

Waits for the page URL to match the given pattern (glob or substring).

**Examples:**

```bash
browser-cli wait --url '**/dashboard*'
browser-cli wait --url 'success'
browser-cli waitforurl '/checkout/complete'    # Alias
```

### wait --text - Wait for Text Content

```bash
browser-cli wait --text <text> [--timeout <ms>]
```

Waits for text content to appear anywhere on the page.

**Examples:**

```bash
browser-cli wait --text 'Welcome back'
browser-cli wait --text 'Order confirmed' --timeout 15000
```

### wait --load - Wait for Load State

```bash
browser-cli wait --load [state] [--timeout <ms>]
```

Waits for a page load state event. Valid states: `load` (default), `domcontentloaded`, `networkidle`.

**Examples:**

```bash
browser-cli wait --load                        # Wait for 'load'
browser-cli wait --load domcontentloaded
browser-cli wait --load networkidle --timeout 30000
```

### wait --fn - Wait for JS Condition

```bash
browser-cli wait --fn <expression> [--timeout <ms>]
```

Waits until a JavaScript expression returns a truthy value.

**Examples:**

```bash
browser-cli wait --fn 'document.readyState === "complete"'
browser-cli wait --fn 'window.myApp?.initialized'
browser-cli wait --fn 'document.querySelectorAll(".item").length > 5' --timeout 10000
```

---

## Snapshot (Accessibility Tree)

```bash
browser-cli snapshot [options]
```

Captures the accessibility tree of the page. Output includes element refs (`@e1`, `@e2`...) for use in subsequent commands.

| Flag               | Short | Description                                             |
| ------------------ | ----- | ------------------------------------------------------- |
| `--interactive`    | `-i`  | Only show interactive elements (buttons, inputs, links) |
| `--compact`        | `-c`  | Compact single-line output                              |
| `--cursor`         | `-C`  | Include cursor-interactive elements (cursor:pointer)    |
| `--depth <n>`      | `-d`  | Max tree depth                                          |
| `--selector <sel>` | `-s`  | Scope to a specific element                             |

**Examples:**

```bash
# Most useful: compact interactive elements
browser-cli snapshot -ic

# Full tree, limited depth
browser-cli snapshot -d 3

# Scoped to a section
browser-cli snapshot -ic -s '#sidebar'

# Include cursor-interactive
browser-cli snapshot -icC
```

**Sample output (compact interactive):**

```
@e1 link "Home" [/]
@e2 link "Products" [/products]
@e3 textbox "Search" []
@e4 button "Search"
@e5 link "Login" [/login]
@e6 link "Sign Up" [/signup]
```

---

## Screenshot

```bash
browser-cli screenshot [options]
```

| Option             | Description              | Default          |
| ------------------ | ------------------------ | ---------------- |
| `--selector <sel>` | Capture specific element | full page        |
| `--path <path>`    | Output file path         | `screenshot.png` |
| `--format <fmt>`   | `png` or `jpeg`          | `png`            |
| `--quality <n>`    | JPEG quality (0-100)     | -                |

**Examples:**

```bash
browser-cli screenshot
browser-cli screenshot --path /tmp/page.png
browser-cli screenshot --selector '#chart' --path chart.png
browser-cli screenshot --format jpeg --quality 80 --path photo.jpg
```

---

## JavaScript Evaluation

```bash
browser-cli eval '<expression>'
browser-cli eval -b '<base64-encoded-expression>'
echo '<expression>' | browser-cli eval --stdin
```

Evaluates JavaScript in the page context (MAIN world) and returns the result.

| Option         | Description                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `-b, --base64` | Decode expression from base64 before evaluating (useful for complex scripts with special characters) |
| `--stdin`      | Read expression from stdin (useful for piping scripts)                                               |

**Examples:**

```bash
browser-cli eval 'document.title'
browser-cli eval 'window.location.href'
browser-cli eval 'document.querySelectorAll("a").length'
browser-cli eval 'JSON.stringify(performance.timing)'
browser-cli eval -b 'ZG9jdW1lbnQudGl0bGU='
cat script.js | browser-cli eval --stdin
```

---

## Console & Errors

### console - Get Console Output

```bash
browser-cli console [--level <level>] [--clear]
```

| Option    | Description                                     |
| --------- | ----------------------------------------------- |
| `--level` | Filter: `log`, `warn`, `error`, `info`, `debug` |
| `--clear` | Clear buffer after reading                      |

### errors - Get Page Errors

```bash
browser-cli errors
```

**Examples:**

```bash
browser-cli console                    # All console output
browser-cli console --level error      # Only errors
browser-cli console --clear            # Read and clear
browser-cli errors                     # Page errors
```

---

## Common Patterns

### Wait for page load, then extract data

```bash
browser-cli navigate https://example.com/data
browser-cli wait '.data-table'
browser-cli get count '.data-table tr'
browser-cli get text '.data-table tr:first-child td'
```

### Check if operation succeeded

```bash
browser-cli click '#submit'
browser-cli wait '.success-message'
browser-cli is visible '.success-message'
browser-cli get text '.success-message'
```

### Debug page state

```bash
browser-cli get url
browser-cli get title
browser-cli snapshot -ic
browser-cli console --level error
browser-cli errors
```

### Extract structured data via eval

```bash
browser-cli eval 'JSON.stringify(Array.from(document.querySelectorAll(".item")).map(e => ({title: e.querySelector("h3").textContent, price: e.querySelector(".price").textContent})))'
```

---

## Best Practices

1. **Use `snapshot -ic` as your first step**: It gives you a quick overview of what's interactive on the page and assigns element refs.

2. **Prefer `get text` over `eval`**: `get text` is simpler and handles edge cases. Use `eval` only for complex extraction.

3. **Always wait before querying**: Dynamic pages need time to load. Use `wait <selector>` before `get text` or `get count`.

4. **Use `--json` for machine parsing**: `browser-cli get text '.price' --json` returns structured JSON output.

5. **Check errors after failed operations**: `browser-cli errors` and `browser-cli console --level error` help diagnose issues.
