# news.ycombinator.com

> Hacker News — tech community news aggregator by Y Combinator.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://news.ycombinator.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/hn.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/hn.mjs --call extractPosts
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/hn.mjs --call navigateTo -- --category "ask"
> ```
>
> When the agent runs, replace `scripts/hn.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/hn.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from hn.mjs extractPosts, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll(".athing")].slice(0,3).map(el => ({ title: el.querySelector(".titleline > a")?.innerText || "" })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll(".athing").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login

| State      | Selector           | Notes                               |
| ---------- | ------------------ | ----------------------------------- |
| Logged in  | `#logout`          | Presence indicates logged in        |
| Username   | `#me`              | Link for the current logged-in user |
| Logged out | `a[href*="login"]` | Presence indicates logged out       |

### Post List

| Element        | Selector         | Notes                                 |
| -------------- | ---------------- | ------------------------------------- |
| Post row       | `.athing`        | Each post is a `<tr>`                 |
| Rank           | `.rank`          | e.g. "1."                             |
| Title link     | `.titleline > a` | First `<a>` inside the titleline span |
| Source domain  | `.sitestr`       | e.g. "github.com"                     |
| Score          | `.score`         | e.g. "128 points"                     |
| Author         | `.hnuser`        | Username link                         |
| Posted time    | `.age a`         | e.g. "3 hours ago"                    |
| Next page link | `.morelink`      | "More" link at the bottom of the page |

#### Category URLs

| Category         | URL                                        |
| ---------------- | ------------------------------------------ |
| Top (default)    | `https://news.ycombinator.com/`            |
| New              | `https://news.ycombinator.com/newest`      |
| Past (yesterday) | `https://news.ycombinator.com/front`       |
| Comments         | `https://news.ycombinator.com/newcomments` |
| Ask HN           | `https://news.ycombinator.com/ask`         |
| Show HN          | `https://news.ycombinator.com/show`        |
| Jobs             | `https://news.ycombinator.com/jobs`        |

### Post Detail

| Element        | Selector         | Notes                        |
| -------------- | ---------------- | ---------------------------- |
| Post container | `.fatitem`       | Contains title, score, etc.  |
| Title link     | `.titleline > a` | Post title and external link |
| Score          | `.score`         | e.g. "128 points"            |
| Author         | `.hnuser`        | Username link                |
| Posted time    | `.age a`         | e.g. "3 hours ago"           |

### Comments

| Element                | Selector           | Notes                                                   |
| ---------------------- | ------------------ | ------------------------------------------------------- |
| Comment tree container | `.comment-tree`    | Outer container for all comments                        |
| Comment row            | `.comtr`           | Each comment is a `<tr>`; `id` is the comment ID        |
| Indent indicator       | `.ind[indent]`     | `indent` attribute indicates nesting level (0, 1, 2, …) |
| Comment author         | `.hnuser`          | Username link                                           |
| Comment time           | `.age a`           | e.g. "2 hours ago"                                      |
| Comment text           | `.commtext`        | Comment body (may contain HTML links)                   |
| Collapse button        | `.togg`            | `[–]` button to collapse/expand comment thread          |
| Navigation links       | `.comhead .navs a` | "next", "prev", "parent" links                          |

### Category URLs

| Category         | URL                                        |
| ---------------- | ------------------------------------------ |
| Top (default)    | `https://news.ycombinator.com/`            |
| New              | `https://news.ycombinator.com/newest`      |
| Past (yesterday) | `https://news.ycombinator.com/front`       |
| Comments         | `https://news.ycombinator.com/newcomments` |
| Ask HN           | `https://news.ycombinator.com/ask`         |
| Show HN          | `https://news.ycombinator.com/show`        |
| Jobs             | `https://news.ycombinator.com/jobs`        |

## Notes

- **No data-testid attributes**: HN uses semantic class names (`.athing`, `.comtr`, `.hnuser`, etc.); selectors are stable.
- **Static HTML**: HN is server-side rendered with no SPA framework; pages load fast and selectors are immediately available.
- **30 items per page**: Each list page shows 30 posts; use `?p=2`, `?p=3` to paginate.
- **Comment indentation**: `.ind` elements have an `indent` attribute (0, 1, 2, …) indicating nesting depth; the inner `<img>` width equals `indent * 40` pixels.
- **Deleted comments**: Deleted comments display `[deleted]` and have no `.hnuser` element; use `|| '[deleted]'` as a fallback when extracting.
- **Ask HN / Show HN**: Same structure as the regular post list. Ask HN posts link to their own comment page (self-post); Show HN posts may link to an external URL.
- **Rate limiting**: HN may throttle rapid requests; add `browser-cli --tab <tabId> wait 1000` between navigations if needed.
- **No login required to read**: All posts and comments are publicly accessible; login is only needed for voting, commenting, and submitting.
