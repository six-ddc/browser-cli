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
---

# Site Guide Creator

Create tested site-specific guides for browser-cli. Each guide documents CSS selectors,
extraction scripts, and interaction patterns for a website — verified against the live DOM.

## Workflow

1. **Prepare** — start browser-cli, navigate to target site
2. **Explore** — identify page types, discover selectors from live DOM
3. **Build** — write and validate extraction scripts incrementally
4. **Document** — write the guide file
5. **Register** — add to SKILL.md table

For the complete guide on structure, writing conventions, and quality checklist,
read [CONTRIBUTING.md](../browser-cli/references/sites/CONTRIBUTING.md).

## Step 1: Prepare

```bash
browser-cli start
browser-cli status          # confirm "Extension: connected"
browser-cli navigate '<site-url>'
browser-cli wait 3000
```

If extension is not connected (headless environment), use Playwright as fallback for
DOM exploration. Final guide must use `browser-cli eval` syntax.

## Step 2: Explore Page Types

Identify the site's 2–5 key page types (home, search, detail, profile, etc.).

**Check login requirements first** — navigate to each page type and check for redirects:

```bash
browser-cli navigate '<page-url>'
browser-cli get url    # did it redirect to login?
```

**Detect login state** — find selectors distinguishing logged-in vs logged-out:

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify({
  loginButton: !!document.querySelector('[data-testid*="login"], .login-btn, a[href*="login"]'),
  signupButton: !!document.querySelector('[data-testid*="signup"], .signup-btn'),
  avatar: !!document.querySelector('[data-testid*="avatar"], .user-avatar'),
})
EOF
```

Document which pages are public and which require login.

## Step 3: Discover Selectors

**Never guess selectors.** For each page type:

### 3a. Scan data-testid attributes first (most stable)

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify([...new Set(
  [...document.querySelectorAll("[data-testid]")]
    .map(el => el.getAttribute("data-testid"))
)].sort())
EOF
```

### 3b. Find containers → inspect children → map fields

```bash
# Find container
browser-cli eval 'document.querySelectorAll("<selector>").length'

# Inspect structure
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].slice(0, 2).map(el => ({
  classes: el.className?.substring?.(0, 200),
  testId: el.getAttribute("data-testid"),
  text: el.innerText?.substring(0, 200),
  childTestIds: [...el.querySelectorAll("[data-testid]")].map(c => c.getAttribute("data-testid")),
})))
EOF

# Test field selector
browser-cli eval 'document.querySelector("<container> <field-sel>")?.innerText'
```

### Selector preference

1. `[data-testid="..."]` — most stable
2. `#id` — unique IDs
3. `[role="..."]`, `[aria-label="..."]` — semantic attributes
4. `.semantic-class` — human-readable class names
5. Avoid: auto-generated classes, deep nesting

## Step 4: Build Extraction Scripts

Build incrementally — start minimal, add fields one at a time:

```bash
# Minimal (verify container)
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].slice(0, 3).map(el => ({
  text: el.querySelector("<title-sel>")?.innerText || ""
})))
EOF

# Full (after all fields confirmed)
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].map((el, i) => ({
  index: i + 1,
  title: el.querySelector("<title-sel>")?.innerText || "",
  author: el.querySelector("<author-sel>")?.innerText || "",
  url: el.querySelector("a")?.href || "",
})))
EOF
```

**Validate** on 2–3 different queries/pages. Check for empty fields, zero-value edge
cases, and noise elements (ads, recommendations mixed into containers).

## Step 5: Test Interactions

```bash
# Pagination (infinite scroll)
browser-cli scroll down --amount 2000
browser-cli wait 1500

# Filters
browser-cli click '<filter-toggle>'
browser-cli wait '<filter-panel>' --timeout 3000

# Detail navigation + back
browser-cli click '<item-link>'
browser-cli wait '<detail-container>' --timeout 5000
browser-cli back
browser-cli wait '<list-container>' --timeout 5000
```

## Step 6: Write the Guide

**Location**: `skills/browser-cli/references/sites/<domain>.md`

**Language**: Site's primary user language (Chinese sites → Chinese).

Template:

````markdown
# <domain>

> One-line site description.

## Login Detection

(detection script + selectors table)

## <Page Type>

**URL pattern**: `/<path>?<key params>`

**Navigation**: `browser-cli navigate '...'`

**Wait**: `browser-cli wait '<selector>' --timeout 5000`

**Extract data**:

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify(...)
EOF
```

**Key selectors**:

| Element | Selector | Description |
| ------- | -------- | ----------- |
| ...     | `...`    | ...         |

## Notes

- Gotcha 1
- Gotcha 2
````

## Step 7: Register

Add to the "Site-Specific Guides" table in `skills/browser-cli/SKILL.md`:

```markdown
| <domain> | [sites/<domain>.md](references/sites/<domain>.md) |
```

## Existing Guides (read one before writing)

| Guide                                                                    | Best for learning                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [x.com.md](../browser-cli/references/sites/x.com.md)                     | `data-testid` selectors, login detection, engagement parsing |
| [xiaohongshu.com.md](../browser-cli/references/sites/xiaohongshu.com.md) | Virtual scroll, contentEditable input, SVG state detection   |
| [google.com.md](../browser-cli/references/sites/google.com.md)           | Search flow, result extraction, filter UI                    |
| [mail.google.com.md](../browser-cli/references/sites/mail.google.com.md) | CSP handling, inbox extraction                               |
