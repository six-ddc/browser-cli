# Contributing Site-Specific Guides

> **Use the `site-guide` skill** to create new guides. It provides the full
> interactive workflow: navigate the live site, discover selectors from the real
> DOM, build and test recipe scripts, then write the guide. Invoke it with:
>
> ```
> /site-guide <domain>
> ```

## What a guide consists of

Each site guide is two files:

1. **Selector reference** (`references/sites/<domain>.md`) — CSS selectors, URL
   patterns, login detection, and interaction notes. Pure reference tables; no
   inline extraction code.
2. **Recipe script** (`scripts/<short-name>.mjs`) — reusable ES module functions
   for common operations (`detectLogin`, `search`, `extractItems`, etc.).
   Extraction logic lives here, not in the `.md`.

## File conventions

- **Location**: `references/sites/<domain>.md` + `scripts/<name>.mjs`
- **Naming**: bare domain — `github.com.md` / `github.mjs`
- **Language**: write in the site's primary user language (Chinese sites → Chinese)
- **Registration**: add the new file to the table in `SKILL.md` under "Site-Specific Guides"

## Selector discovery rules

**Never guess selectors.** Always discover them from the live DOM:

```bash
# Scan data-testid attributes first (most stable)
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...new Set(
  [...document.querySelectorAll("[data-testid]")]
    .map(el => el.getAttribute("data-testid"))
)].sort())
EOF

# Check container count
browser-cli --tab <tabId> eval 'document.querySelectorAll("<selector>").length'

# For API-heavy SPAs, use network watch to capture API traffic
browser-cli --tab <tabId> network watch '*api*' --timeout 10000
```

## Recipe script conventions

- **File header**: purpose + note about `browser.evaluate()` auto-unwrap
- **Each function**: JSDoc with description and `@requires` precondition
- **`console.log`**: log each step for debugging
- **Default export**: full workflow combining individual steps
- **Named exports**: individual functions for `--call <name>` use

See existing scripts for reference patterns:

| Script                | Best for learning                           |
| --------------------- | ------------------------------------------- |
| `scripts/hn.mjs`      | Simple selectors, static HTML               |
| `scripts/google.mjs`  | Search flow, multiple result types          |
| `scripts/x.mjs`       | `data-testid`, login detection, SPA         |
| `scripts/xhs.mjs`     | Virtual scroll accumulator, contentEditable |
| `scripts/youtube.mjs` | Network capture for API-based extraction    |

## Guide `.md` structure

````markdown
# <domain>

> One-line description.

> **Tip**: (tab group boilerplate)

> **Recipe scripts**: (recipe usage boilerplate)

> **Recipe debugging**: (debugging boilerplate)

## Selector Reference

### Login Detection

| State | Selector | Notes |
| ----- | -------- | ----- |

### <Page Type>

**URL pattern**: ...
| Element | Selector | Notes |
| ------- | -------- | ----- |

## Common Interactions (optional)

### <Action>

```bash
# example commands
```

## Notes

- Gotcha 1
````

## Final checklist

- [ ] Every selector discovered from the live DOM (not guessed)
- [ ] Recipe script tested with `--call` for each exported function
- [ ] Default export (full workflow) tested end-to-end
- [ ] Extraction returns populated data on 2–3 different pages/queries
- [ ] Zero-value edge cases handled
- [ ] Login detection works for both states
- [ ] Auth requirements noted in Notes
- [ ] Guide registered in `SKILL.md` table
