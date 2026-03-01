# google.com

> Google — the world's most widely used search engine.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://www.google.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/google.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/google.mjs --call extractResults
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/google.mjs --call search -- --query "coffee" --type "news"
> ```
>
> When the agent runs, replace `scripts/google.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/google.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from google.mjs extractResults, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll(".MjjYud")].slice(0,3).map(el => ({ title: el.querySelector("h3")?.innerText })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelector(".MjjYud")?.innerText'`
>
> See the selector tables below for reference.

## Selector Reference

### Search Input

| Element           | Selector             |
| ----------------- | -------------------- |
| Search input      | `textarea[name="q"]` |
| Results container | `#search`            |

### Web Search Results

**URL parameters**: `/search?q=<query>` (additional: `&start=<offset>`, `&num=<count>`)

| Element              | Selector                                  | Notes                                   |
| -------------------- | ----------------------------------------- | --------------------------------------- |
| Results container    | `#search`                                 |                                         |
| Organic result block | `.MjjYud`                                 | Filter: keep only items containing `h3` |
| Result title         | `h3` (class `LC20lb`)                     |                                         |
| Result link          | Nearest `<a>` to `h3`, or first `a[href]` |                                         |
| Snippet text         | `.VwiC3b`                                 |                                         |
| Display URL          | `cite`                                    |                                         |
| Next page            | `#pnnext`                                 | Or paginate via `&start=10`             |

### News Search Results

**URL parameters**: `/search?q=<query>&tbm=nws`

| Element        | Selector                     |
| -------------- | ---------------------------- |
| News card      | `.SoaBEf`                    |
| Title          | `[role='heading']`           |
| Source name    | `.CEMjEf, .NUnG9d`           |
| Published date | `.OSrXXb span, .ZE0LJd span` |
| Snippet        | `.UqSP2b`                    |
| Link           | Nearest `<a>`                |

### Image Search Results

**URL parameters**: `/search?q=<query>&tbm=isch` (infinite scroll)

| Element     | Selector                          | Notes                     |
| ----------- | --------------------------------- | ------------------------- |
| Image card  | `#search [data-lpage]`            |                           |
| Image title | `.toI8Rb` or `img[alt]`           |                           |
| Source URL  | `data-lpage` attribute            |                           |
| Site name   | First leaf `<span>` (no children) |                           |
| Thumbnail   | `img`                             | Usually a base64 data URI |

### Knowledge Panel

Appears in the right sidebar for entity searches (people, companies, places, etc.).

| Element           | Selector                                     | Notes                        |
| ----------------- | -------------------------------------------- | ---------------------------- |
| Sidebar container | `#rhs`                                       | Absent if no Knowledge Panel |
| Entity title      | `[data-attrid='title']`                      |                              |
| Subtitle          | `[data-attrid='subtitle']`                   |                              |
| Description       | `[data-attrid='VisualDigestDescription']`    |                              |
| Attribute rows    | `[data-attrid]` with prefix `kc:/` or `hw:/` |                              |

### Search Tools

| Element                 | Selector             | Notes                                      |
| ----------------------- | -------------------- | ------------------------------------------ |
| Tools panel button      | `#hdtb-tls`          | Click to expand time/verbatim filter panel |
| "Any time" dropdown     | `.mTpL7c.XhWQv`      | Click to expand time range options         |
| Time range option links | `a[href*="tbs=qdr"]` |                                            |

**Search types** (`tbm` URL parameter):

| Search type   | URL parameter |
| ------------- | ------------- |
| Web (default) | —             |
| Images        | `tbm=isch`    |
| News          | `tbm=nws`     |
| Videos        | `tbm=vid`     |
| Shopping      | `tbm=shop`    |

**Time ranges** (`tbs` URL parameter):

| Time range    | `tbs` parameter |
| ------------- | --------------- |
| Past hour     | `qdr:h`         |
| Past 24 hours | `qdr:d`         |
| Past week     | `qdr:w`         |
| Past month    | `qdr:m`         |
| Past year     | `qdr:y`         |

## Notes

- **Dynamic rendering**: Google uses progressive rendering; always `wait '#search'` before extracting
- **Consent page**: In some regions (e.g., EU), a cookie consent page appears on first visit; click `#L2AGLb` (Accept All) to dismiss it
- **CAPTCHA**: Frequent automated queries may trigger a CAPTCHA; if extraction returns empty results, use `snapshot -ic` to check page state first
- **Selector stability**: `#search`, `#rhs`, `h3`, `cite`, `[data-attrid]` are relatively stable; `.MjjYud`, `.VwiC3b`, `.SoaBEf`, `.UqSP2b` may change across versions — use `snapshot -ic` to inspect the current structure when extraction fails
- **Safe search**: Append `&safe=active` to enable, `&safe=off` to disable
- **Language/region**: `&hl=en` sets language, `&gl=us` sets region
- **Results per page**: `&num=20` requests more results (default is 10)
- **Pagination**: Increment `&start=` by 10 in the URL, or click `#pnnext`
- **Image pagination**: Image search uses infinite scroll; scroll down to trigger loading of more results
