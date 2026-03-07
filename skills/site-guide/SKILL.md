---
name: site-guide
description: >
  Create browser-cli site-specific guides by exploring live website DOM with browser-cli.
  Use when asked to create, add, or write a new site guide (site reference, site-specific
  skill) for browser-cli. Follows a structured workflow: navigate site pages, discover
  real CSS selectors from the live DOM, build and validate extraction scripts interactively,
  then write a tested guide file. Triggers on: "add a site guide for github.com",
  "create browser-cli reference for reddit", "write selectors for youtube.com",
  "make a new site guide".
allowed-tools: Bash(browser-cli:*), Bash(cat *), Bash(mktemp *), Bash(TMP=*)
argument-hint: '<domain to create guide for, e.g. github.com>'
---

# Site Guide Creator

Create tested site-specific guides for browser-cli. Each guide has two deliverables:

1. **Selector reference** (`references/sites/<domain>.md`) — CSS selectors, URL patterns, extraction commands
2. **Recipe script** (`scripts/<domain-short>.mjs`) — reusable functions for common operations

Both are verified against the live DOM before writing.

## Prerequisites

Read an existing guide + script pair to understand the conventions before starting:

- **Simple site**: `references/sites/news.ycombinator.com.md` + `scripts/hn.mjs`
- **Complex site**: `references/sites/google.com.md` + `scripts/google.mjs`
- **data-testid heavy**: `references/sites/x.com.md` + `scripts/x.mjs`

All paths are relative to `skills/browser-cli/` within the project root.

## Workflow Overview

1. **Prepare** — start daemon, open target site in a dedicated tab
2. **Explore** — identify page types; try `markdown` as a first pass for content pages
3. **Discover Selectors** — scan live DOM for testids, containers, field selectors; check network requests for API-heavy SPAs
4. **Build & Validate** — write extraction scripts incrementally, test on real data
5. **Write Recipe Script** — create the `.mjs` file with reusable functions
6. **Write Guide** — create the `.md` file with selector tables and boilerplate
7. **Register** — add to SKILL.md table

---

## Step 1: Prepare

```bash
browser-cli start
browser-cli status          # confirm "Extension: connected"
browser-cli tab new '<site-url>' --group browser-cli
# Output: Tab <tabId>: <url> (group: browser-cli)
```

**Save the tab ID** — use `--tab <tabId>` for ALL subsequent commands to avoid disrupting user browsing.

```bash
browser-cli --tab <tabId> wait 3000
browser-cli --tab <tabId> snapshot -ic    # initial overview of interactive elements
```

## Step 2: Explore Page Types

Identify the site's 2–5 key page types (home, search, detail, profile, etc.).

### Check login requirements

```bash
browser-cli --tab <tabId> navigate '<page-url>'
browser-cli --tab <tabId> get url    # did it redirect to login?
```

### Detect login state

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify({
  loginButton: !!document.querySelector('[data-testid*="login"], .login-btn, a[href*="login"]'),
  signupButton: !!document.querySelector('[data-testid*="signup"], .signup-btn'),
  avatar: !!document.querySelector('[data-testid*="avatar"], .user-avatar'),
})
EOF
```

Document which pages are public and which require login.

### Quick content check

For **content/article pages** (news, docs, blogs), try `markdown` as a first pass before DOM discovery:

```bash
browser-cli --tab <tabId> navigate '<page-url>'
browser-cli --tab <tabId> markdown    # extracts readable content; may be enough without DOM scraping
```

If `markdown` returns the data you need, skip DOM selector discovery and go straight to Step 5.

### Page type discovery

For each page type, start with `snapshot -ic` to get an overview, then drill into specific sections:

```bash
browser-cli --tab <tabId> navigate '<page-url>'
browser-cli --tab <tabId> wait 3000
browser-cli --tab <tabId> snapshot -ic              # interactive elements overview
browser-cli --tab <tabId> snapshot -c -d 3          # content structure (depth-limited)
browser-cli --tab <tabId> snapshot -ic -s @e5       # drill into a specific section
```

## Step 3: Discover Selectors

**Never guess selectors.** For each page type:

### 3a. Scan data-testid attributes first (most stable)

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...new Set(
  [...document.querySelectorAll("[data-testid]")]
    .map(el => el.getAttribute("data-testid"))
)].sort())
EOF
```

### 3b. Find containers → inspect children → map fields

```bash
# Find container — try candidate selectors
browser-cli --tab <tabId> eval 'document.querySelectorAll("<selector>").length'

# Inspect structure of first 2 items
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].slice(0, 2).map(el => ({
  tag: el.tagName,
  classes: el.className?.substring?.(0, 200),
  testId: el.getAttribute("data-testid"),
  text: el.innerText?.substring(0, 200),
  childTestIds: [...el.querySelectorAll("[data-testid]")].map(c => c.getAttribute("data-testid")),
  childTags: [...el.children].map(c => `${c.tagName}.${c.className?.split(' ')[0] || ''}`).join(', ')
})))
EOF

# Test individual field selectors
browser-cli --tab <tabId> eval 'document.querySelector("<container> <field-sel>")?.innerText'
```

### 3c. Check network requests for API-heavy SPAs

For sites built on React/Vue/Angular that fetch data via XHR/fetch, network requests often expose cleaner extraction paths than DOM scraping:

```bash
# After navigating to the page, inspect captured API calls
browser-cli --tab <tabId> network requests --pattern '*api*' --limit 20
browser-cli --tab <tabId> network requests --pattern '*graphql*' --limit 10
```

If an endpoint returns clean JSON, extract via in-page `fetch()`:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(async () => {
  const resp = await fetch('/api/data', { credentials: 'include' });
  return await resp.json();
})()
EOF
```

For sites where API URLs include auth tokens (e.g., YouTube's POT), capture the full URL from network requests, mutate query params as needed, and re-fetch. Reference: `scripts/youtube.mjs` → `findTimedtextUrl`.

### Selector preference order

1. `[data-testid="..."]` — most stable, explicitly for testing
2. `#id` — unique IDs
3. `[role="..."]`, `[aria-label="..."]` — semantic attributes
4. `.semantic-class` — human-readable class names (e.g., `.hnuser`, `.score`)
5. Avoid: auto-generated classes (`.css-1a2b3c`), deep nesting

## Step 4: Build & Validate Extraction Scripts

Build incrementally — start minimal, add fields one at a time:

```bash
# Minimal — verify container works
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].slice(0, 3).map(el => ({
  text: el.querySelector("<title-sel>")?.innerText || ""
})))
EOF

# Add more fields after titles confirmed
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].map((el, i) => ({
  index: i + 1,
  title: el.querySelector("<title-sel>")?.innerText || "",
  author: el.querySelector("<author-sel>")?.innerText || "",
  url: el.querySelector("a")?.href || "",
})).filter(r => r.title))
EOF
```

### Validate thoroughly

- Test on **2–3 different queries/pages** to ensure selectors generalize
- Check for empty fields, zero-value edge cases
- Filter out noise elements (ads, recommendations mixed into containers)
- Verify across different content types (image vs. text posts, etc.)

### Test interactions

> **Anti-bot tip**: If clicks or fills are silently rejected by the site, add `--debugger` to dispatch trusted CDP events (`isTrusted=true`). Example: `browser-cli --tab <tabId> click '<sel>' --debugger`. Chrome only; falls back to synthetic events on Firefox.

```bash
# Pagination — infinite scroll
browser-cli --tab <tabId> scroll down --amount 2000
browser-cli --tab <tabId> wait 1500

# Pagination — next page button
browser-cli --tab <tabId> click '<next-page-selector>'
browser-cli --tab <tabId> wait '<container>' --timeout 5000

# Filters
browser-cli --tab <tabId> click '<filter-toggle>'
browser-cli --tab <tabId> wait '<filter-panel>' --timeout 3000

# Detail navigation + back
browser-cli --tab <tabId> click '<item-link>'
browser-cli --tab <tabId> wait '<detail-container>' --timeout 5000
browser-cli --tab <tabId> back
browser-cli --tab <tabId> wait '<list-container>' --timeout 5000
```

## Step 5: Write Recipe Script

Create `skills/browser-cli/scripts/<short-name>.mjs` with reusable functions.

### Script conventions

- **File header comment**: purpose + note about `browser.evaluate()` auto-unwrap
- **Each function**: JSDoc with description and `@requires` precondition
- **console.log**: Log each step for debugging (navigating, waiting, extracting, result count)
- **Default export**: Full workflow function combining the individual steps
- **Named exports**: Individual functions for flexibility (`--call <name>`)

### Template

```js
// scripts/<name>.mjs — <Domain> recipe functions
// Each function: (browser, args?) => Promise<result>
// browser.evaluate() auto-unwraps { value } and JSON.parse, so expression
// that returns JSON.stringify(...) will yield a parsed JS object directly.

/** Detect login state → { loggedIn, ... }
 * @requires Current tab is on <domain> */
export async function detectLogin(browser) {
  console.log('Detecting login state...');
  const result = await browser.evaluate({
    expression: `JSON.stringify((() => {
      const loggedIn = !!document.querySelector('<logged-in-selector>');
      return { loggedIn };
    })())`,
  });
  console.log('Login state:', result.loggedIn ? 'logged in' : 'not logged in');
  return result;
}

/** Navigate to <page type>
 * @requires None */
export async function navigateTo(browser, { query } = {}) {
  const url = `https://<domain>/<path>?q=${encodeURIComponent(query)}`;
  console.log(`Navigating to: ${url}`);
  await browser.navigate({ url });
  await browser.wait({ selector: '<ready-selector>', timeout: 5000 });
  console.log('Page loaded');
}

/** Extract <items> → [{ index, title, url, ... }]
 * @requires Current page is a <page type> */
export async function extractItems(browser) {
  console.log('Extracting items...');
  const results = await browser.evaluate({
    expression: `JSON.stringify([...document.querySelectorAll("<container>")].map((el, i) => ({
      index: i + 1,
      title: el.querySelector("<title-sel>")?.innerText || "",
      url: el.querySelector("a")?.href || "",
    })).filter(r => r.title))`,
  });
  console.log(`Extracted ${results.length} items`);
  return results;
}

/** Full workflow: navigate and extract */
export default async function (browser, args) {
  await navigateTo(browser, { query: args?.query });
  return await extractItems(browser);
}
```

### Advanced patterns

For complex sites, these patterns from existing scripts are worth adapting:

- **Virtual scroll accumulator** — when items are removed from the DOM as you scroll (virtualized lists), inject `window` globals to track seen items across scroll batches. Reference: `scripts/xhs.mjs` → `initScrollCollector` / `scrollAndCollect` / `getCollected`.
- **Network capture for API extraction** — for sites with auth-bearing XHR URLs, capture the full URL from network requests and re-fetch via in-page `fetch()`. More stable than DOM selectors for data-heavy SPAs. Reference: `scripts/youtube.mjs` → `findTimedtextUrl` / `fetchTimedtext`.
- **contentEditable input** — rich text editors don't respond to `fill`. Use `document.execCommand('insertText')` after focusing the element. Reference: `scripts/xhs.mjs` → `postComment`.

### Testing the script

Write to a temp file and test before committing:

```bash
TMP=$(mktemp /tmp/bcli-XXXX.mjs)
cat > "$TMP" <<'SCRIPTEOF'
// paste your script here
SCRIPTEOF
browser-cli --tab <tabId> script "$TMP" --list                       # verify exports
browser-cli --tab <tabId> script "$TMP" --call detectLogin           # test individual function
browser-cli --tab <tabId> script "$TMP" --call extractItems          # test extraction
browser-cli --tab <tabId> script "$TMP" -- --query "test"            # test full workflow
```

## Step 6: Write the Guide

Create `skills/browser-cli/references/sites/<domain>.md`.

**Language**: Write in the site's primary user language (Chinese sites → Chinese).

### Guide template

Every guide starts with the same header boilerplate, then has selector reference tables:

````markdown
# <domain>

> One-line site description.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://<domain>' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/<name>.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/<name>.mjs --call extractItems
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/<name>.mjs --call navigateTo -- --query "test"
> ```
>
> When the agent runs, replace `scripts/<name>.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/<name>.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from <name>.mjs extractItems, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll("<container>")].slice(0,3).map(el => ({ title: el.querySelector("<title>")?.innerText || "" })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("<container>").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login Detection

| State     | Selector | Notes |
| --------- | -------- | ----- |
| Logged in | `...`    | ...   |

### <Page Type 1> (e.g., Search Results)

**URL pattern**: `/<path>?<key params>`

| Element           | Selector | Notes |
| ----------------- | -------- | ----- |
| Results container | `...`    |       |
| Item title        | `...`    |       |
| Item link         | `...`    |       |

### <Page Type 2> (e.g., Detail Page)

**URL pattern**: `/<path>/<id>`

| Element | Selector | Notes |
| ------- | -------- | ----- |
| ...     | `...`    |       |

## Common Interactions (optional)

Include for complex sites with multi-step flows that agents will frequently need:

### <Action> (e.g., Search)

```bash
# Direct URL (most reliable)
browser-cli --tab <tabId> navigate 'https://<domain>/search?q=<query>'
browser-cli --tab <tabId> wait '<results-container>'

# Or via recipe
browser-cli --tab <tabId> script scripts/<name>.mjs --call <function> -- --query "test"
```

## Notes

- Gotcha 1
- Gotcha 2
````

### Key points

- **Selector tables, not inline scripts**: The guide focuses on selector reference tables. Extraction logic lives in the `.mjs` recipe script.
- **No duplicate extraction scripts**: Don't copy extraction code from the `.mjs` into the `.md`. The guide points to the script; the script is the source of truth.
- **Notes section**: Document gotchas — CSP issues, auth requirements, rate limiting, selector stability, pagination behavior, locale differences.

## Step 7: Register

Add to the "Site-Specific Guides" table in `skills/browser-cli/SKILL.md`:

```markdown
| <domain> | [sites/<domain>.md](references/sites/<domain>.md) |
```

## Quality Checklist

Before finishing, confirm:

- [ ] Every selector was discovered from the live DOM (not guessed)
- [ ] Recipe script tested with `--call` for each exported function
- [ ] Default export (full workflow) tested end-to-end
- [ ] Extraction returns populated data on 2–3 different pages/queries
- [ ] Zero-value edge cases handled (0 likes, 0 comments)
- [ ] Filter/sort interactions tested if documented
- [ ] Pagination tested (next page, scroll load)
- [ ] Login detection works (both logged-in and logged-out states)
- [ ] Auth or permission requirements noted in Notes section
- [ ] Guide registered in SKILL.md table
- [ ] Guide uses the standard header boilerplate (Tip + Recipe scripts + Recipe debugging)

## Existing Guides (read one before writing)

| Guide                                                                              | Script                                            | Best for learning                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| [news.ycombinator.com.md](../browser-cli/references/sites/news.ycombinator.com.md) | [hn.mjs](../browser-cli/scripts/hn.mjs)           | Simple selectors, static HTML, comment tree     |
| [google.com.md](../browser-cli/references/sites/google.com.md)                     | [google.mjs](../browser-cli/scripts/google.mjs)   | Search flow, multiple result types, time filter |
| [x.com.md](../browser-cli/references/sites/x.com.md)                               | [x.mjs](../browser-cli/scripts/x.mjs)             | `data-testid` selectors, login detection, SPA   |
| [xiaohongshu.com.md](../browser-cli/references/sites/xiaohongshu.com.md)           | [xhs.mjs](../browser-cli/scripts/xhs.mjs)         | Virtual scroll, contentEditable, SVG state      |
| [mail.google.com.md](../browser-cli/references/sites/mail.google.com.md)           | [gmail.mjs](../browser-cli/scripts/gmail.mjs)     | CSP handling, inbox extraction                  |
| [youtube.com.md](../browser-cli/references/sites/youtube.com.md)                   | [youtube.mjs](../browser-cli/scripts/youtube.mjs) | Player API, transcript/captions, SPA            |
