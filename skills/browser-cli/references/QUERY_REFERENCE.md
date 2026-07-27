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

Returns the element's rendered text using **`innerText` semantics**, not `textContent`: text hidden
by `display:none`/`visibility:hidden` is excluded, and runs of consecutive blank lines are collapsed
to at most one blank line. This matches what a user would actually see and copy from the page.

**Examples:**

```bash
browser-cli get text 'h1'
browser-cli get text '.price'
browser-cli get text @e3
```

---

### get html - Get Element HTML

```bash
browser-cli get html <selector> [--outer] [--out-file <path>]
```

| Option              | Description                                     |
| ------------------- | ----------------------------------------------- |
| `--outer`           | Return outerHTML instead of innerHTML           |
| `--out-file <path>` | Write the full HTML to a file instead of stdout |

**Without `--out-file`**, output over 100000 characters is truncated on stdout, with a warning
printed to stderr suggesting `--out-file` or a narrower selector.

**With `--out-file <path>`**, the complete HTML (untruncated) is written to that file; stdout only
prints a short confirmation, and `--json` output is `{"success":true,"data":{"path","chars"}}`. Use
this whenever the element's HTML is large — it avoids flooding an agent's context window.

**Examples:**

```bash
browser-cli get html '.content'
browser-cli get html '#article' --outer
browser-cli get html '#app' --out-file /tmp/app.html
browser-cli get html '#app' --out-file /tmp/app.html --json
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

## Assertions (verify)

Where `get`/`is` **report** a value, `verify` **judges** it: PASS exits `0`, FAIL exits `1`. No new
browser capability is involved — each subcommand runs the corresponding query and compares locally.

```bash
browser-cli verify text "<text>"                  # body text contains <text> (substring)
browser-cli verify visible <selector>             # element exists and is visible
browser-cli verify value <selector> <expected>    # input value equals <expected> exactly
browser-cli verify count <selector> <n>           # exactly n elements match
browser-cli verify url <pattern>                  # URL matches a glob
browser-cli verify title <pattern>                # title matches a glob
```

`url` / `title` use the **same pattern engine as `wait --url`**: a pattern containing `*` is a glob
(`*` matches within a path segment, `**` across segments); a pattern with **no** `*` is compiled as
a regular expression. Both are matched unanchored, so a substring is enough.

**Output and exit codes:**

| Outcome                              | Exit    | Where                                                     |
| ------------------------------------ | ------- | --------------------------------------------------------- |
| Assertion holds                      | `0`     | `PASS: <description>` on stdout                           |
| Assertion fails (`ASSERTION_FAILED`) | `1`     | `FAIL: <description>` + `expected:` / `actual:` on stderr |
| The query itself failed              | 2/3/4/5 | Standard error envelope                                   |

The distinction between "the app is wrong" and "the automation is wrong" is deliberate:

- `verify visible` on a **missing** element is a FAIL (exit `1`) — nothing matched, so it is not visible.
- `verify value` on a **missing** element is a real `ELEMENT_NOT_FOUND` (exit `3`) — there is no
  value to compare against.
- `verify count <sel> 0` **passes** when nothing matches.

**`--json`:**

```json
{ "success": true,  "data":  { "pass": true, "expected": 3, "actual": 3 } }
{ "success": false, "error": { "code": "ASSERTION_FAILED", "message": "…", "hint": "…" } }
```

**Examples:**

```bash
browser-cli verify text "Order confirmed"
browser-cli verify visible '#receipt'
browser-cli verify value '#email' user@test.com
browser-cli verify count '.cart-item' 2
browser-cli verify url '**/checkout/success*'
browser-cli verify title 'Order *'
```

Inside `batch`/`repl` a FAIL is reported as an `ASSERTION_FAILED` error for that line and the run
continues (unless `--fail-fast`), with the process exiting `1` at the end — which makes `batch` a
lightweight smoke-test runner.

**Note:** `verify url` / `verify title` are tab-level and always report the top document, even when
a frame is focused. The other subcommands run inside the focused frame.

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

| Flag               | Short | Description                                                      |
| ------------------ | ----- | ---------------------------------------------------------------- |
| `--interactive`    | `-i`  | Only show interactive elements (buttons, inputs, links), no text |
| `--compact`        | `-c`  | Drop pure-structure nodes and use 2-space indent                 |
| `--cursor`         | `-C`  | Include cursor-interactive elements (cursor:pointer)             |
| `--depth <n>`      | `-d`  | Max tree depth (`-d 0` reports the page node alone)              |
| `--selector <sel>` | `-s`  | Scope to a specific element                                      |
| `--filter <role>`  | `-f`  | Only show nodes with this ARIA role and their ancestors          |
| `--max-chars <n>`  |       | Cap total output size (default 40000)                            |
| `--save <path>`    |       | Write the tree to a file as a baseline (refs stripped)           |
| `--base <path>`    |       | Diff against a saved baseline; combine with `--save` to refresh  |

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

**Sample output** — one node per line, indented by tree depth, in the form
`role "name" (attributes) [@ref]`. `browser-cli snapshot -ic` on a login page:

```
page "The Internet - Login Page" (url="http://localhost:4173/login")
  textbox "Username" [@e1]
  generic "Password" [@e2]
  button "Login" [@e3]
  link "browser-cli" (url="https://github.com/six-ddc/browser-cli") [@e4]
```

The same page without `-i` also carries body copy as `text` nodes:

```
page "The Internet - Login Page" (url="http://localhost:4173/login")
    generic
        heading "Login Page" (level=2)
        heading "This is where you can log into the secure area." (level=4)
        generic
            generic
                text "Username"
                textbox "Username" [@e1]
            generic
                text "Password"
                generic "Password" [@e2]
            button "Login" [@e3]
    generic
        text "Powered by"
        link "browser-cli" (url="https://github.com/six-ddc/browser-cli") [@e4]
```

A trailing `(N interactive elements)` line reports the ref count. Indentation is 2 spaces with
`-c`/`--compact` and 4 spaces without it.

**Text nodes**: body copy appears as `text "..."` lines, truncated at 200 characters. Text that a
parent's accessible name already reports (a button label, a heading) is not repeated. `-i` drops
text nodes entirely.

**State attributes**, rendered inside `(...)`: `level=<n>`, `disabled`, `readonly`, `required`,
`checked=true|false|mixed`, `selected`, `expanded=true|false`, `focused`, `value="..."`, `url="..."`.
Native attributes and their ARIA equivalents (`aria-disabled`, `aria-checked`, `aria-expanded`,
`aria-selected`, `aria-required`, `aria-readonly`) both report.

**Password safety**: fields with `type=password` or a `password` autocomplete hint report
`value=<redacted>`. Baselines written by `--save` are redacted the same way.

**Output cap**: output is cut on a line boundary at `--max-chars` (default 40000, roughly 10k
tokens) and a hint line is appended:

```
[truncated: showing 5 of 55 lines. Use -i / -s <selector> / -d <depth> / --max-chars <n> to narrow]
```

**iframes and shadow DOM**: an iframe is a leaf node carrying the selector to enter it, e.g.
`iframe "Checkout" [use: frame #pay-frame]` — run `frame #pay-frame` then snapshot again to see
inside. Nodes at the root of an open shadow root are marked with a trailing `#shadow`.

---

## Screenshot

```bash
browser-cli screenshot [options]
```

| Option             | Description                                                | Default          |
| ------------------ | ---------------------------------------------------------- | ---------------- |
| `--selector <sel>` | Capture specific element                                   | visible viewport |
| `--path <path>`    | Output file path                                           | `screenshot.png` |
| `--format <fmt>`   | `png` or `jpeg`                                            | `png`            |
| `--quality <n>`    | JPEG quality (0-100)                                       | -                |
| `--full`           | Capture the entire scrollable page (Chrome only)           | off (viewport)   |
| `--base64`         | Include base64 image data in `--json` output (`data.data`) | off              |

**The default capture is the visible viewport**, not the whole page — add `--full` for the entire
scrollable document.

The file at `--path` is always written, including when `--json` is passed (previously `--path`
combined with `--json` did not write the file — this is now fixed). `--json` output is
`{"success":true,"data":{"path","width","height","mimeType","bytes","fullPage"}}` — the base64 image
bytes are **not** included unless `--base64` is also given, since the payload can be large.
`width`/`height` are the produced image's **real pixel** dimensions, which on a HiDPI display are
larger than the CSS-pixel size.

**`--full` details:**

- Uses CDP `Page.captureScreenshot` with `captureBeyondViewport`. **Chrome only** — Firefox (or any
  session without the debugger API) fails with `UNSUPPORTED` and a hint to drop `--full`.
- Unlike a viewport capture, it does **not** need to make the target tab active first, so
  `--tab <id> screenshot --full` does not disturb the user's current tab. A viewport capture still
  auto-switches the tab (a `captureVisibleTab` API limitation).
- With `--selector`, the element is cropped by page coordinates using the CDP `clip` parameter, so
  it can capture **elements taller than the viewport** — which the viewport-based element screenshot
  cannot.
- If another debugger client (DevTools) is attached to the tab, it fails with `DEBUGGER_ERROR`.

**Examples:**

```bash
browser-cli screenshot
browser-cli screenshot --path /tmp/page.png
browser-cli screenshot --full --path /tmp/whole-page.png
browser-cli screenshot --selector '#chart' --path chart.png
browser-cli screenshot --full --selector '#long-table' --path table.png  # taller than the viewport
browser-cli screenshot --format jpeg --quality 80 --path photo.jpg
browser-cli screenshot --path /tmp/page.png --json          # writes file + prints metadata
browser-cli screenshot --path /tmp/page.png --json --base64 # + data.data (base64 PNG)
```

---

## JavaScript Evaluation

```bash
browser-cli eval '<expression>'
browser-cli eval -b '<base64-encoded-expression>'
echo '<expression>' | browser-cli eval --stdin
browser-cli eval '<function-expression>' --arg <json> [--arg <json> ...]
```

Evaluates JavaScript in the page context (MAIN world) and returns the result. **Async-aware**: if the expression returns a Promise, it is automatically awaited — `fetch()`, async IIFEs, and other async patterns work seamlessly.

| Option         | Description                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `-b, --base64` | Decode expression from base64 before evaluating (useful for complex scripts with special characters) |
| `--stdin`      | Read expression from stdin (useful for piping scripts)                                               |
| `--arg <json>` | JSON argument passed to the expression, which must evaluate to a function; repeatable                |

**Examples:**

```bash
browser-cli eval 'document.title'
browser-cli eval 'window.location.href'
browser-cli eval 'document.querySelectorAll("a").length'
browser-cli eval 'JSON.stringify(performance.timing)'
browser-cli eval -b 'ZG9jdW1lbnQudGl0bGU='
cat script.js | browser-cli eval --stdin

# Async expressions (Promises are auto-awaited)
browser-cli eval 'fetch("/api/data").then(r => r.json())'
browser-cli eval '(async () => { const r = await fetch("/api"); return r.status; })()'
```

**Calling a function with `--arg`**: pass one or more `--arg <json>` flags and the expression must
evaluate to a function; it is invoked as `(expr)(...args)`. Each `--arg` is parsed as a JSON value,
so a string argument needs its own quotes:

```bash
browser-cli eval '(a, b) => a + b' --arg 1 --arg 2
browser-cli eval '(sel) => document.querySelector(sel).textContent' --arg '"#title"'
```

**Errors and return values**:

- When page code throws, the error's page-side `stack` trace is printed to stderr in text mode, and
  available as `error.stack` under `--json`.
- Return values pass through structured clone: DOM nodes, functions, and class instances do not
  survive — they come back as `null` or a plain object stripped of methods. Convert DOM info to a
  string or plain object inside the expression (`el.outerHTML`, `{ id: el.id, text: el.textContent }`)
  rather than returning the node itself.

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

## Markdown Extraction

```bash
browser-cli markdown
```

Extracts the page's main content as readable Markdown (using Defuddle). Strips navigation, ads, and boilerplate. Useful for reading articles, documentation, or any content-heavy page.

**Examples:**

```bash
browser-cli markdown                         # Print markdown to stdout
browser-cli markdown --json                  # Structured JSON: { title, markdown, byline, excerpt }
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
