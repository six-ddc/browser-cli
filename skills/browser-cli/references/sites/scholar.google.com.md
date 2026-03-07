# scholar.google.com

> Google Scholar — academic search engine for scholarly literature: papers, theses, books, abstracts, and court opinions.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://scholar.google.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/scholar.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/scholar.mjs --call extractResults
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/scholar.mjs --call search -- --query "attention mechanism" --yearFrom 2023
> ```
>
> When the agent runs, replace `scripts/scholar.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/scholar.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll(".gs_r.gs_or.gs_scl")].slice(0,3).map(el => ({ title: el.querySelector(".gs_rt a")?.innerText })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll(".gs_r.gs_or.gs_scl").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login Detection

| State      | Selector                      | Notes                       |
| ---------- | ----------------------------- | --------------------------- |
| Logged in  | `a[href*="/citations?user="]` | "My profile" link in header |
| Logged in  | `a[href*="scilib=1"]`         | "My library" link in header |
| Logged out | `a[href*="ServiceLogin"]`     | Sign-in link                |

### Search Input

| Element      | Selector      |
| ------------ | ------------- |
| Search input | `#gs_hdr_tsi` |
| Search form  | `#gs_hdr_frm` |

### Search Results

**URL pattern**: `/scholar?q=<query>` (additional: `&start=<offset>`, `&as_ylo=<year>`, `&scisbd=1` for date sort, `&as_rr=1` for review articles)

| Element          | Selector              | Notes                                                   |
| ---------------- | --------------------- | ------------------------------------------------------- |
| Results wrapper  | `#gs_res_ccl`         | Wait for this before extracting                         |
| Result container | `.gs_r.gs_or.gs_scl`  | Each result item; has `data-cid` attribute for paper ID |
| Right-side info  | `.gs_ri`              | Contains title, authors, snippet, action bar            |
| Title (h3)       | `.gs_rt`              | Class on `<h3>` element                                 |
| Title link       | `.gs_rt a`            | Paper URL; missing for [CITATION] results               |
| Author line      | `.gs_a`               | Format: `Authors\xa0- Venue, Year - publisher`          |
| Author links     | `.gs_a a`             | Link to author's Scholar profile (if available)         |
| Snippet          | `.gs_rs`              | Abstract excerpt with keyword highlighting              |
| Action bar       | `.gs_fl.gs_flb`       | Contains Save, Cite, Cited by, Related, Versions links  |
| "Cited by N"     | `.gs_fl.gs_flb a`     | Match with `/^Cited by/`; href leads to citing papers   |
| "Related"        | `.gs_fl.gs_flb a`     | Text: `Related articles`                                |
| "All N versions" | `.gs_fl.gs_flb a`     | Match with `/^All \d/`                                  |
| Save button      | `.gs_or_sav`          | Star icon; requires login                               |
| Cite button      | `.gs_or_cit`          | Opens citation dialog                                   |
| PDF/HTML link    | `.gs_ggs a`           | Direct link to full text (PDF, HTML)                    |
| PDF source label | `.gs_ggs .gs_ctg2`    | `[PDF]` or `[HTML]`                                     |
| Result count     | `#gs_ab_md`           | e.g. "About 6,380,000 results (0.06 sec)"               |
| Related searches | `.gs_qsuggest_wrap a` | Suggested related queries                               |

### Author Line Parsing

The `.gs_a` element uses a **non-breaking space** (U+00A0) before the first hyphen separator. Split with `/\s-\s/` regex (not `" - "` literal):

```
"Y Chang, X Wang, J Wang… - ACM transactions on …, 2024 - dl.acm.org"
 \_____________________/    \________________________/   \________/
       authors                   venue, year              publisher
```

- `parts[0]` — authors (comma-separated, may end with `…` if truncated)
- `parts[1..n-1]` — venue and year
- `parts[n-1]` — publisher domain

### Filters (Sidebar)

| Filter       | Selector / URL Parameter     | Notes                        |
| ------------ | ---------------------------- | ---------------------------- |
| Any time     | `&as_ylo=` (remove param)    | Default                      |
| Since year   | `&as_ylo=<year>`             | e.g. `&as_ylo=2024`          |
| Custom range | `&as_ylo=<from>&as_yhi=<to>` | Both bounds                  |
| Sort by date | `&scisbd=1`                  | Default is sort by relevance |
| Review only  | `&as_rr=1`                   | Only review articles         |
| Excl patents | `&as_sdt=2007`               | Exclude patents from results |
| Excl cites   | `&as_vis=1`                  | Exclude citations            |

### Pagination

| Element        | Selector  | Notes                                              |
| -------------- | --------- | -------------------------------------------------- |
| Page nav       | `#gs_n`   | Contains page number links                         |
| Next page link | `#gs_n a` | Find link with text `Next`; or use `&start=10` URL |

Paginate via `&start=<offset>` in the URL (increments of 10).

### Cited-By Page

Same URL structure and selectors as search results: `/scholar?cites=<paper-id>&...`

Use `citedByUrl` from `extractResults` to navigate, then call `extractResults` again.

## Notes

- **`markdown` does not work**: Google Scholar's DOM structure prevents Defuddle from extracting content. Always use recipe scripts or `eval` for extraction.
- **No `data-testid`**: Scholar does not use `data-testid` attributes. Selectors rely on class-based `.gs_*` prefixed names.
- **Author line separator**: Uses non-breaking space (U+00A0) + hyphen, not regular space + hyphen. The recipe script handles this with `/\s-\s/` regex split.
- **[CITATION] results**: Some results are citation-only (no link to full text). These have no `<a>` inside `.gs_rt` — the title is plain text with a `[CITATION]` prefix.
- **Login not required**: Search and extraction work without login. Login enables "My library" save functionality and alerts.
- **CAPTCHA**: Frequent automated queries may trigger a CAPTCHA. If extraction returns empty results, use `snapshot -ic` to check page state. Space out queries to avoid triggering.
- **Language/region**: `&hl=en` sets interface language. Results are not region-locked like Google web search.
- **Selector stability**: `.gs_r`, `.gs_ri`, `.gs_rt`, `.gs_a`, `.gs_rs`, `.gs_fl` are long-standing Scholar selectors (stable for years). `#gs_res_ccl`, `#gs_n`, `#gs_ab_md` are stable IDs.
