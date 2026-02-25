# Contributing Site-Specific Guides

Site guides teach Claude how to operate specific websites efficiently, avoiding
trial-and-error with generic extraction (`snapshot -ic`, `markdown`, `eval`).

## When to Create a Guide

A site guide is worth creating when:

- Generic extraction repeatedly fails or requires multiple attempts
- The site uses heavy CSR/SPA with non-obvious DOM structure
- Key data requires specific selectors that aren't discoverable via `snapshot`
- The site has authentication gates, anti-bot measures, or special URL tokens

## File Conventions

- **Location**: `skills/browser-cli/references/sites/<domain>.md`
- **Naming**: Use the bare domain — `xiaohongshu.com.md`, `twitter.com.md`, `github.com.md`
- **Language**: Write in the site's primary user language (Chinese sites in Chinese, etc.)
- **Registration**: Add the new file to the table in `SKILL.md` under "Site-Specific Guides"

## Workflow: Explore First, Document as You Go

**Do NOT write selectors by guessing or from memory.** Site DOMs change frequently
and guessed selectors almost always fail. The correct workflow is:

1. Open the page in browser-cli
2. Inspect the live DOM to discover real selectors
3. Build and validate extraction scripts interactively
4. Only write to the guide what has been confirmed working

### Step 1 — Navigate and inspect the page

```bash
browser-cli start
browser-cli status                    # confirm extension is connected
browser-cli navigate '<url>'
browser-cli wait '<expected-element>' --timeout 5000
```

If you don't know what to wait for yet, use `snapshot` to explore:

```bash
browser-cli snapshot -ic              # interactive elements, compact
```

### Step 2 — Discover selectors from the live DOM

Probe the DOM interactively to find the right container and field selectors:

```bash
# Check if a guessed selector exists at all
browser-cli eval 'document.querySelectorAll("<selector>").length'

# Inspect the structure of result containers
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].slice(0, 2).map(el => ({
  classes: el.className,
  text: el.innerText?.substring(0, 100),
  children: [...el.children].map(c => c.className).join(", ")
})))
EOF
```

Iterate until you find stable selectors with populated data. Common discovery patterns:

- **Find the result container**: check `.length` for candidate selectors
- **Inspect children**: dump class names and text to understand nesting
- **Check text sources**: `h3.innerText` may be empty if it wraps an image —
  try `.alt`, nearby `<span>`, or `[role='heading']` instead
- **Verify across items**: a selector that works for item 1 may miss fields on item 3

### Step 3 — Build extraction scripts incrementally

Start with a minimal extraction, confirm it returns data, then add fields:

```bash
# Start minimal — just titles
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].slice(0, 3).map(el => ({
  title: el.querySelector("<title-sel>")?.innerText || ""
})))
EOF

# Add more fields once titles work
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll("<container>")].map((el, i) => ({
  index: i + 1,
  title: el.querySelector("<title-sel>")?.innerText || "",
  url: el.querySelector("a")?.href || "",
  snippet: el.querySelector("<snippet-sel>")?.innerText || "",
})).filter(r => r.title))
EOF
```

### Step 4 — Write confirmed scripts to the guide

Only after a script returns correct data for 2–3 different queries/items,
write it into the guide file. Each page type section follows this structure:

````markdown
## <Page Type> (e.g., Search Results)

**URL pattern**: `/<path>?<key params>`

**Navigation**: `browser-cli navigate '...'`

**Wait**: `browser-cli wait '<selector>' --timeout 5000`

**Extract data**:

\```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify(...)
EOF
\```

**Key selectors**:

| Element | Selector |
| ------- | -------- |
| ...     | `...`    |
````

### Step 5 — Test interactions and edge cases

After the basic extraction works, explore interactive elements:

```bash
# Filters — click and verify results change
browser-cli click '<filter-selector>'
browser-cli wait 1000
# re-run extraction

# Pagination
browser-cli click '<next-selector>'
browser-cli wait '<container>' --timeout 5000
# re-run extraction

# Back navigation
browser-cli back
browser-cli wait '<previous-page-selector>' --timeout 5000
```

Test edge cases:

- Different queries (short vs. long, with special chars)
- Zero-value counts (0 likes, 0 comments — sites often show placeholder text)
- Different content types (image vs. video posts, organic vs. ad results)
- Different locales if relevant

## Document Structure

Every guide follows the same skeleton:

```markdown
# <domain>

> One-line site description.

## <Page Type 1> (e.g., Search Results)

(URL pattern, navigation, wait, extract, key selectors, interactions)

## <Page Type 2> (e.g., Detail Page)

(same pattern)

## Notes

- Gotcha 1
- Gotcha 2
```

### Required Sections per Page Type

Each page type section should include, in order:

1. **URL pattern** — the path pattern and key query parameters
2. **Navigation** — `browser-cli navigate` command (if this is an entry point)
3. **Wait** — `browser-cli wait` command for the key element that signals the page is ready
4. **Extract data** — a complete, copy-paste-ready `browser-cli eval --stdin` script
5. **Key selectors** — a table mapping logical elements to CSS selectors
6. **Interactions** (if applicable) — filter panels, pagination, clicking into sub-pages

### Optional Sections

- **Search** — if the site requires a multi-step flow to reach search results (fill input → press Enter → wait)
- **Filters** — if the site has filter/sort UI that isn't URL-driven
- **Comments** — if comment extraction needs its own script
- **Notes** — gotchas, edge cases, permissions

## Writing Extraction Scripts

### Use `--stdin` with heredoc

Always use `browser-cli eval --stdin <<'EOF'` for multi-line scripts. This is
more readable than single-line eval and avoids shell quoting issues:

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  // extraction logic
})())
EOF
```

### Always wrap output in `JSON.stringify`

Claude needs structured data. Always return JSON, not raw strings:

```js
// Good
JSON.stringify({ title, content, author });

// Bad
document.querySelector('.title').innerText;
```

### Handle zero-value display text

Many sites show placeholder text instead of "0" for empty counts.
Test what the text is when a count is zero and normalize it:

```js
// xiaohongshu shows "赞" for 0 likes, "评论" for 0 comments
const num = (s) => {
  const t = document.querySelector(s)?.innerText || '';
  return /^\d/.test(t) ? t : '0';
};
```

### Use defensive selectors

Sites update their DOM frequently. Prefer stable selectors:

```js
// Good — semantic IDs and stable class names
document.querySelector('#detail-title');
document.querySelector('.author-container .username');

// Fragile — auto-generated classes or deep nesting
document.querySelector('.css-1a2b3c > div:nth-child(3) > span');
```

### Filter out noise elements

Search results often include ad cards or recommendation blocks mixed
into the same container. Identify and filter them:

```js
// Filter out "trending searches" cards on xiaohongshu
.filter(el => !el.querySelector(".query-note-wrapper"))
```

## Writing Interaction Steps

### DOM-driven filters (not URL-based)

When a site's filter/sort is controlled by DOM clicks rather than URL params,
document the full flow:

1. How to open the filter panel (`browser-cli click '<selector>'`)
2. How to wait for the panel (`browser-cli wait '<panel-selector>'`)
3. An eval script to click specific options
4. A table of all option groups and their values

Note any options that require browser permissions (e.g., geolocation for
"nearby" filters).

### Pagination

Document the pagination mechanism:

- **Infinite scroll**: `browser-cli scroll down --amount <n>` + `browser-cli wait <ms>`
- **Next page button**: `browser-cli click '<selector>'`
- **URL-based**: describe the page param pattern

## Final Checklist

Before submitting, confirm the guide meets all these criteria:

- [ ] Every selector was discovered from the live DOM (not guessed)
- [ ] Every extraction script returns populated data on real pages
- [ ] Tested on at least 2–3 different queries/items
- [ ] Zero-value edge cases handled (0 likes, 0 comments)
- [ ] Filter/sort interactions tested if documented
- [ ] Pagination tested (next page, scroll load)
- [ ] `browser-cli back` works for page-to-page navigation
- [ ] Auth or permission requirements noted
- [ ] Different locale/language tested if relevant
- [ ] Guide registered in SKILL.md

## Registering in SKILL.md

After creating the guide, add it to `skills/browser-cli/SKILL.md` in the
"Site-Specific Guides" table:

```markdown
| <domain> | [sites/<domain>.md](references/sites/<domain>.md) |
```
