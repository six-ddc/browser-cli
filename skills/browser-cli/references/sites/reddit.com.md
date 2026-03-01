# reddit.com

> Reddit — social news aggregation, content rating, and discussion platform with thousands of community-driven subreddits.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://www.reddit.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/reddit.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/reddit.mjs --call detectLogin
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/reddit.mjs --call navigateSubreddit -- --subreddit "programming" --sort "top" --timeframe "week"
> ```
>
> When the agent runs, replace `scripts/reddit.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/reddit.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from reddit.mjs extractFeed, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll("shreddit-post")].slice(0,3).map(el => ({ title: el.getAttribute("post-title") || "" })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("shreddit-post").length'`

## Selector Reference

### Login Detection

| State     | Selector                     | Notes                     |
| --------- | ---------------------------- | ------------------------- |
| Logged in | `#expand-user-drawer-button` | Header user menu button   |
| Logged in | `a[href="/submit"]`          | Header "Create post" link |
| Logged in | `a[href*="/notifications"]`  | Notifications inbox link  |

### Post List (Feed / Subreddit)

| Element        | Selector / Attribute            | Notes                                             |
| -------------- | ------------------------------- | ------------------------------------------------- |
| Post container | `shreddit-post`                 | Custom element, one per post                      |
| Title          | `attr: post-title`              | Post title text                                   |
| Author         | `attr: author`                  | Username (no u/ prefix)                           |
| Subreddit      | `attr: subreddit-prefixed-name` | `r/subredditName`                                 |
| Score          | `attr: score`                   | Upvote count                                      |
| Comment count  | `attr: comment-count`           | Number of comments                                |
| Post type      | `attr: post-type`               | `text`, `image`, `gallery`, `multi_media`, `link` |
| Permalink      | `attr: permalink`               | Relative URL path                                 |
| Timestamp      | `attr: created-timestamp`       | ISO 8601 format                                   |
| Domain         | `attr: domain`                  | External link domain                              |

### Subreddit Info

| Element             | Selector / Attribute             | Notes                        |
| ------------------- | -------------------------------- | ---------------------------- |
| Header container    | `shreddit-subreddit-header`      | Custom element with metadata |
| Name                | `attr: name`                     | Raw subreddit name           |
| Display name        | `attr: display-name`             | Display name                 |
| Description         | `attr: description`              | Short description            |
| Weekly active users | `attr: weekly-active-users`      | Active user count            |
| Subscribed          | `attr: is-subscribed` (presence) | Whether user is subscribed   |
| Right sidebar       | `#right-sidebar-container`       | Rules, description, stats    |

### Post Detail

| Element        | Selector / Attribute                 | Notes                                       |
| -------------- | ------------------------------------ | ------------------------------------------- |
| Post element   | `shreddit-post`                      | Same as Feed; metadata in attributes        |
| Post body      | `[slot="text-body"]` (child of post) | Text body, mounted into shadow DOM via slot |
| Comment tree   | `shreddit-comment-tree`              | Container for all comments                  |
| Total comments | `attr: totalcomments` (comment-tree) | Total comment count                         |

### Comments

| Element         | Selector / Attribute                  | Notes                            |
| --------------- | ------------------------------------- | -------------------------------- |
| Comment element | `shreddit-comment`                    | Custom element with shadow DOM   |
| Author          | `attr: author`                        | Commenter username               |
| Score           | `attr: score`                         | Upvote count                     |
| Depth           | `attr: depth`                         | Nesting level (0 = top-level)    |
| Thing ID        | `attr: thingid`                       | Comment ID (e.g. `t1_o6a35j5`)   |
| Timestamp       | `attr: created`                       | ISO 8601 format                  |
| Permalink       | `attr: permalink`                     | Relative URL of the comment      |
| Content type    | `attr: content-type`                  | `text`, `giphy` (GIF), etc.      |
| Comment body    | `[slot="comment"]` (child of comment) | Slot div containing comment text |

### Header Navigation

| Element       | Selector                     | Notes                        |
| ------------- | ---------------------------- | ---------------------------- |
| Home          | `a[href="/"]` (Reddit logo)  | Reddit home / Feed           |
| Search box    | `input[name="q"]`            | Global search bar            |
| Create post   | `a[href="/submit"]`          | New post link                |
| Notifications | `a[href*="/notifications"]`  | Notifications inbox          |
| User menu     | `#expand-user-drawer-button` | User profile dropdown        |
| Left sidebar  | `#left-sidebar-container`    | Subscribed communities, etc. |
| Right sidebar | `#right-sidebar-container`   | Subreddit info, rules        |

### Sort URL Parameters

**Subreddit sorting**:

| Sort   | URL                      | Notes                   |
| ------ | ------------------------ | ----------------------- |
| Hot    | `/r/<sub>/hot/`          | Default hot posts       |
| New    | `/r/<sub>/new/`          | Newest posts            |
| Top    | `/r/<sub>/top/?t=<time>` | Top posts by time range |
| Rising | `/r/<sub>/rising/`       | Rising posts            |

Top time range (`t` parameter): `hour`, `day`, `week`, `month`, `year`, `all`

**Comment sorting** (URL `?sort=` parameter):

| Sort          | `?sort=` value  |
| ------------- | --------------- |
| Best          | `confidence`    |
| Top           | `top`           |
| New           | `new`           |
| Controversial | `controversial` |
| Old           | `old`           |
| Q&A           | `qa`            |

## Notes

- **Login required**: Reddit blocks all unauthenticated access. Always verify login state before any operation; if not logged in, stop and prompt the user to log in manually.
- **Web Components + Shadow DOM**: Reddit uses Web Components (`shreddit-post`, `shreddit-comment`, `shreddit-subreddit-header`, etc.) with shadow DOM. Post/comment metadata is stored in **element attributes** (not inner DOM), accessible directly via `getAttribute()` without piercing the shadow DOM.
- **Comment body access**: Comment text content lives in the `[slot="comment"]` child element, accessed via `[...comment.children].find(ch => ch.getAttribute('slot') === 'comment')`; cannot use `querySelector` from inside the shadow root.
- **Post body access**: Post text body lives in the `[slot="text-body"]` child element, accessed the same way as comment body.
- **No `data-testid`**: Reddit does not use `data-testid` attributes. Use element tag names (`shreddit-post`, `shreddit-comment`) and their attributes.
- **Feed vs. search result structure differ**: Feed pages (home, subreddit) use `shreddit-post` elements; search results use plain `div` cards that require separate extraction logic.
- **Comment depth**: The `depth` attribute on `shreddit-comment` indicates nesting level; nested comments are direct child nodes of their parent comment element.
- **Collapsed replies**: Some reply threads are collapsed behind "N more replies" buttons and must be clicked to expand.
- **Infinite scroll**: Feed uses lazily loaded `faceplate-partial` elements triggered by scrolling down; most posts accumulate in the DOM, but a small number may be removed after very long scrolls.
- **SPA navigation**: Reddit is a SPA; use `browser-cli navigate` for initial navigation and `browser-cli wait` to wait for dynamic content.
- **Localization**: Reddit UI text changes with browser language (e.g. Chinese shows "条评论"); stat-extraction regexes in scripts must handle both English and localized text.
- **Sort via URL**: Subreddit and comment sorting is most reliably done via URL parameters rather than clicking shadow-DOM-based dropdown UIs.
- **GIF/media comments**: Comments with `content-type="giphy"` are GIF reactions; their `[slot="comment"]` text is empty — use `contentType` to distinguish them.
- **Score display**: Comments with a score of 0 or negative still show a numeric value in the `score` attribute.
