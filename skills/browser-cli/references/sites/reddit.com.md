# reddit.com

> Reddit — social news aggregation, content rating, and discussion platform with thousands of community-driven subreddits.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://www.reddit.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

## Login Required

**Reddit blocks unauthenticated browser access.** Both `reddit.com` and `old.reddit.com` return a "blocked by network security" page without login.

**Always check login state before any operation. If not logged in, stop and ask the user to log in manually.**

**Detect login state**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const expandUser = !!document.querySelector('#expand-user-drawer-button');
  const createPost = !!document.querySelector('a[href="/submit"]');
  const notifications = !!document.querySelector('a[href*="/notifications"]');
  return { loggedIn: expandUser || createPost || notifications };
})())
EOF
```

**Key selectors**:

| State     | Selector                          | Description                  |
| --------- | --------------------------------- | ---------------------------- |
| Logged in | `#expand-user-drawer-button`      | User menu button in header   |
| Logged in | `a[href="/submit"]`               | "Create post" link in header |
| Logged in | `a[href*="/notifications"]`       | Notifications inbox link     |
| Logged in | `#header-action-item-chat-button` | Chat button in header        |

**If `loggedIn: false`** — stop all subsequent operations and tell the user:

> Reddit is not logged in. Please log in manually in the browser, then tell me to continue.

After the user logs in, run `browser-cli --tab <tabId> reload` and re-check login state before proceeding.

## Homepage / Feed

**URL**: `https://www.reddit.com/`

**Navigation**: `browser-cli --tab <tabId> navigate 'https://www.reddit.com/'`

**Wait**: `browser-cli --tab <tabId> wait 'shreddit-post' --timeout 5000`

**Extract posts**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('shreddit-post')].map((el, i) => ({
  index: i + 1,
  title: el.getAttribute('post-title'),
  author: el.getAttribute('author'),
  subreddit: el.getAttribute('subreddit-prefixed-name'),
  score: el.getAttribute('score'),
  comments: el.getAttribute('comment-count'),
  postType: el.getAttribute('post-type'),
  permalink: el.getAttribute('permalink'),
  created: el.getAttribute('created-timestamp'),
  domain: el.getAttribute('domain'),
  url: 'https://www.reddit.com' + el.getAttribute('permalink'),
})))
EOF
```

**Key selectors**:

| Element          | Selector / Attribute            | Description                                       |
| ---------------- | ------------------------------- | ------------------------------------------------- |
| Post container   | `shreddit-post`                 | Custom element, one per post                      |
| Post title       | `attr: post-title`              | Title text in element attribute                   |
| Author           | `attr: author`                  | Username (no u/ prefix)                           |
| Subreddit        | `attr: subreddit-prefixed-name` | `r/subredditName`                                 |
| Score            | `attr: score`                   | Upvote count                                      |
| Comment count    | `attr: comment-count`           | Number of comments                                |
| Post type        | `attr: post-type`               | `text`, `image`, `gallery`, `multi_media`, `link` |
| Permalink        | `attr: permalink`               | Relative URL path                                 |
| Timestamp        | `attr: created-timestamp`       | ISO 8601 format                                   |
| Article wrapper  | `article`                       | Wraps each `shreddit-post`, has `aria-label`      |
| Post title by ID | `#post-title-<postId>`          | e.g. `#post-title-t3_1r96647`                     |
| Feed next page   | `#feed-next-page-partial`       | Lazy-loaded partial for infinite scroll           |

**Infinite scroll**:

The feed uses lazy loading via `faceplate-partial`. Scroll down to trigger loading:

```bash
browser-cli --tab <tabId> scroll down --amount 2000
browser-cli --tab <tabId> wait 2000
# Re-run extraction to get newly loaded posts
```

> **Note**: Reddit accumulates posts in the DOM as you scroll (no aggressive virtual scroll like X.com). A simple `querySelectorAll('shreddit-post')` after scrolling will return most loaded posts. Some posts may be removed at extremes of long scroll sessions, but the behavior is much less aggressive than virtual scrolling.

## Subreddit Page

**URL pattern**: `/r/<subreddit>/` with optional sort: `/r/<subreddit>/hot/`, `/r/<subreddit>/new/`, `/r/<subreddit>/top/?t=<timeframe>`

**Navigation**:

```bash
browser-cli --tab <tabId> navigate 'https://www.reddit.com/r/<subreddit>/'
browser-cli --tab <tabId> wait 'shreddit-post' --timeout 5000
```

**Sort options** (via URL):

| Sort   | URL                      | Description            |
| ------ | ------------------------ | ---------------------- |
| Hot    | `/r/<sub>/hot/`          | Default hot posts      |
| New    | `/r/<sub>/new/`          | Newest posts           |
| Top    | `/r/<sub>/top/?t=<time>` | Top posts by timeframe |
| Rising | `/r/<sub>/rising/`       | Rising posts           |

**Top timeframe** (`t` parameter): `hour`, `day`, `week`, `month`, `year`, `all`

```bash
# Top posts of the week in r/programming
browser-cli --tab <tabId> navigate 'https://www.reddit.com/r/programming/top/?t=week'
browser-cli --tab <tabId> wait 'shreddit-post' --timeout 5000
```

**Extract subreddit info**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const h = document.querySelector('shreddit-subreddit-header');
  if (!h) return { error: 'no header' };
  return {
    name: h.getAttribute('name'),
    displayName: h.getAttribute('display-name'),
    prefixedName: h.getAttribute('prefixed-name'),
    description: h.getAttribute('description'),
    weeklyActiveUsers: h.getAttribute('weekly-active-users'),
    weeklyContributions: h.getAttribute('weekly-contributions'),
    isSubscribed: h.hasAttribute('is-subscribed'),
  };
})())
EOF
```

**Subreddit header selectors**:

| Element             | Selector / Attribute             | Description                  |
| ------------------- | -------------------------------- | ---------------------------- |
| Header container    | `shreddit-subreddit-header`      | Custom element with metadata |
| Name                | `attr: name`                     | Raw subreddit name           |
| Display name        | `attr: display-name`             | Display name                 |
| Description         | `attr: description`              | Short description            |
| Weekly active users | `attr: weekly-active-users`      | Active users count           |
| Subscribed          | `attr: is-subscribed` (presence) | Whether user is subscribed   |
| Right sidebar       | `#right-sidebar-container`       | Rules, description, stats    |

**Post extraction**: Same `shreddit-post` extraction script as Homepage section — posts use the same structure across all feed pages.

## Post Detail Page

**URL pattern**: `/r/<subreddit>/comments/<postId>/<slug>/`

**Navigation**: `browser-cli --tab <tabId> navigate 'https://www.reddit.com/r/<subreddit>/comments/<postId>/<slug>/'`

**Wait**: `browser-cli --tab <tabId> wait 'shreddit-comment' --timeout 5000`

**Extract post detail**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const p = document.querySelector('shreddit-post');
  if (!p) return { error: 'post not found' };
  const bodyEl = [...p.children].find(ch => ch.getAttribute('slot') === 'text-body');
  return {
    title: p.getAttribute('post-title'),
    author: p.getAttribute('author'),
    subreddit: p.getAttribute('subreddit-prefixed-name'),
    score: p.getAttribute('score'),
    comments: p.getAttribute('comment-count'),
    postType: p.getAttribute('post-type'),
    created: p.getAttribute('created-timestamp'),
    body: bodyEl?.innerText?.trim() || '',
    permalink: p.getAttribute('permalink'),
  };
})())
EOF
```

**Key selectors (post detail)**:

| Element        | Selector / Attribute                    | Description                              |
| -------------- | --------------------------------------- | ---------------------------------------- |
| Post element   | `shreddit-post`                         | Same as feed, all metadata in attributes |
| Post body      | `[slot="text-body"]` (child of post)    | Text body slotted into shadow DOM        |
| Comment tree   | `shreddit-comment-tree`                 | Container for all comments               |
| Tree post ID   | `#comment-tree` `attr: post-id`         | e.g. `t3_1r96647`                        |
| Total comments | `attr: totalcomments` (on comment-tree) | Total comment count                      |
| Comment sort   | `shreddit-comments-sort-dropdown`       | Sort dropdown (shadow DOM)               |

## Comments (Nested / Threaded)

Comments use `shreddit-comment` custom elements with shadow DOM. The `depth` attribute indicates nesting level (0 = top-level, 1 = reply, 2 = reply-to-reply, etc.).

**Extract comments**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('shreddit-comment')].map((c, i) => {
  const bodySlot = [...c.children].find(ch => ch.getAttribute('slot') === 'comment');
  return {
    index: i + 1,
    author: c.getAttribute('author'),
    score: c.getAttribute('score'),
    depth: parseInt(c.getAttribute('depth')),
    thingId: c.getAttribute('thingid'),
    created: c.getAttribute('created'),
    permalink: c.getAttribute('permalink'),
    contentType: c.getAttribute('content-type'),
    text: bodySlot?.innerText?.trim() || '',
  };
}))
EOF
```

**Key selectors (per comment)**:

| Element         | Selector / Attribute                  | Description                              |
| --------------- | ------------------------------------- | ---------------------------------------- |
| Comment element | `shreddit-comment`                    | Custom element with shadow DOM           |
| Author          | `attr: author`                        | Comment author username                  |
| Score           | `attr: score`                         | Upvote count                             |
| Depth           | `attr: depth`                         | Nesting level (0 = top-level)            |
| Thing ID        | `attr: thingid`                       | Comment ID (e.g. `t1_o6a35j5`)           |
| Timestamp       | `attr: created`                       | ISO 8601 format                          |
| Permalink       | `attr: permalink`                     | Relative URL to comment                  |
| Content type    | `attr: content-type`                  | `text`, `giphy` (GIF), etc.              |
| Comment body    | `[slot="comment"]` (child of comment) | Slotted div containing the comment text  |
| Body content    | `#<thingId>-post-rtjson-content`      | Inner div with actual rendered text/HTML |

**Comment nesting structure**:

`shreddit-comment` elements with `depth > 0` are direct children of their parent `shreddit-comment`:

```
shreddit-comment[depth="0"]        ← top-level comment
  shreddit-comment[depth="1"]      ← reply
    shreddit-comment[depth="2"]    ← reply to reply
```

**Formatted comment tree** (human-readable tree view):

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const comments = [...document.querySelectorAll('shreddit-comment')];
  const lines = comments.map(c => {
    const bodySlot = [...c.children].find(ch => ch.getAttribute('slot') === 'comment');
    const depth = parseInt(c.getAttribute('depth'));
    const author = c.getAttribute('author');
    const score = c.getAttribute('score');
    const text = (bodySlot?.innerText?.trim() || '[GIF/media]').replace(/\n/g, ' ');
    const prefix = depth === 0 ? '' : '│' + '  │'.repeat(depth - 1) + '  ├─ ';
    return `${prefix}[${score}↑] ${author}: ${text}`;
  });
  return lines.join('\n');
})()
EOF
```

### Load More Replies

Collapsed reply threads show "N more replies" buttons (e.g. "另外 8 条回复" / "8 more replies"):

```bash
# Find collapsed reply buttons
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('button')].filter(b =>
  /more repl|条回复/i.test(b.innerText)
).map(b => b.innerText.trim()))
EOF

# Click to expand (click the first collapsed thread)
browser-cli --tab <tabId> eval --stdin <<'EOF'
const btn = [...document.querySelectorAll('button')].find(b =>
  /more repl|条回复/i.test(b.innerText)
);
btn?.click();
'clicked: ' + (btn?.innerText || 'none');
EOF
browser-cli --tab <tabId> wait 2000
```

### Scroll to Load More Top-Level Comments

The comment page loads a limited set of top-level comments initially. Scroll down to trigger lazy loading of more comments:

```bash
browser-cli --tab <tabId> scroll down --amount 3000
browser-cli --tab <tabId> wait 2000
# Re-run comment extraction
```

### Comment Sort

Comment sort is controlled via URL parameter or the `shreddit-comments-sort-dropdown` element (which uses shadow DOM). The easiest approach is URL-based:

```bash
# Sort by: best (default), top, new, controversial, old, qa
browser-cli --tab <tabId> navigate 'https://www.reddit.com/r/<sub>/comments/<id>/<slug>/?sort=new'
browser-cli --tab <tabId> wait 'shreddit-comment' --timeout 5000
```

| Sort          | URL `?sort=` value |
| ------------- | ------------------ |
| Best          | `confidence`       |
| Top           | `top`              |
| New           | `new`              |
| Controversial | `controversial`    |
| Old           | `old`              |
| Q&A           | `qa`               |

## Search

**URL pattern**: `/search/?q=<query>&type=<type>&sort=<sort>`

**Navigate to search**:

```bash
browser-cli --tab <tabId> navigate 'https://www.reddit.com/search/?q=<query>&type=posts'
browser-cli --tab <tabId> wait 3000
```

**Search via input** (from any page):

```bash
browser-cli --tab <tabId> fill 'input[name="q"]' '<query>'
browser-cli --tab <tabId> eval 'document.querySelector("input[name=q]").form.submit()'
browser-cli --tab <tabId> wait 3000
```

> **Note**: `browser-cli --tab <tabId> press Enter` does not trigger Reddit's custom search form submission. Use `form.submit()` via eval instead.

**Search type tabs**:

| Type        | URL `type=`   | Description            |
| ----------- | ------------- | ---------------------- |
| Posts       | `posts`       | Post results (default) |
| Communities | `communities` | Subreddit results      |
| Comments    | `comments`    | Comment results        |
| Media       | `media`       | Media posts            |
| People      | `people`      | User profiles          |

**Sort options** (for post search):

| Sort          | URL `sort=` |
| ------------- | ----------- |
| Relevance     | `relevance` |
| Hot           | `hot`       |
| Top           | `top`       |
| New           | `new`       |
| Comment count | `comments`  |

```bash
# Search for "rust programming", sort by top
browser-cli --tab <tabId> navigate 'https://www.reddit.com/search/?q=rust+programming&type=posts&sort=top'
browser-cli --tab <tabId> wait 3000
```

**Extract search results** (posts):

Search results use a different structure from feed — they are `div` cards rather than `shreddit-post` elements:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const cards = document.querySelectorAll('div.flex.justify-between.items-center.p-md');
  return [...cards].map((card, i) => {
    const title = card.querySelector('h2')?.innerText?.trim() || '';
    const href = [...card.querySelectorAll('a')].find(a => a.href?.includes('/comments/'))?.href || '';
    const statsMatch = card.innerText.match(/(\d[\d,.万k]*)\s*(?:票|votes?).*?(\d[\d,.万k]*)\s*(?:条评论|comments?)/i);
    return {
      index: i + 1,
      title,
      href,
      votes: statsMatch?.[1] || '',
      comments: statsMatch?.[2] || '',
      snippet: card.innerText.substring(title.length).trim().substring(0, 200),
    };
  }).filter(r => r.title);
})())
EOF
```

**Extract community search results**:

```bash
browser-cli --tab <tabId> navigate 'https://www.reddit.com/search/?q=<query>&type=communities'
browser-cli --tab <tabId> wait 3000
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const main = document.querySelector('main');
  const items = [...main.querySelectorAll('div.flex.justify-start.gap-x-md')];
  return items.map((el, i) => {
    const lines = el.innerText.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines[0] || '';
    const statsIdx = lines.findIndex(l => /周访客|members/i.test(l));
    const description = statsIdx > 1 ? lines.slice(1, statsIdx).join(' ') : '';
    const stats = statsIdx >= 0 ? lines.slice(statsIdx).join(' ') : '';
    return { index: i + 1, name, description, stats };
  }).filter(r => r.name.startsWith('r/'));
})())
EOF
```

## Subreddit Navigation

**Direct navigation** (recommended):

```bash
browser-cli --tab <tabId> navigate 'https://www.reddit.com/r/<subreddit>/'
browser-cli --tab <tabId> wait 'shreddit-post' --timeout 5000
```

**Common subreddit URL patterns**:

| Page          | URL                            |
| ------------- | ------------------------------ |
| Hot           | `/r/<sub>/` or `/r/<sub>/hot/` |
| New           | `/r/<sub>/new/`                |
| Top (week)    | `/r/<sub>/top/?t=week`         |
| Top (all)     | `/r/<sub>/top/?t=all`          |
| Rising        | `/r/<sub>/rising/`             |
| Wiki          | `/r/<sub>/wiki/`               |
| About / Rules | `/r/<sub>/about/rules/`        |

**Header navigation selectors**:

| Element       | Selector                          | Description                  |
| ------------- | --------------------------------- | ---------------------------- |
| Home          | `a[href="/"]` (reddit logo)       | Reddit home / feed           |
| Search input  | `input[name="q"]`                 | Global search bar            |
| Create post   | `a[href="/submit"]`               | New post link                |
| Notifications | `a[href*="/notifications"]`       | Notification inbox           |
| Chat          | `#header-action-item-chat-button` | Chat button                  |
| User menu     | `#expand-user-drawer-button`      | User profile dropdown        |
| Left sidebar  | `#left-sidebar-container`         | Subscribed communities, etc. |
| Right sidebar | `#right-sidebar-container`        | Subreddit info, rules        |

## Notes

- **Login required**: Reddit blocks all unauthenticated access. Always verify login state first
- **Custom elements with Shadow DOM**: Reddit uses Web Components (`shreddit-post`, `shreddit-comment`, `shreddit-subreddit-header`, etc.) with shadow DOM. Post/comment metadata is in **element attributes** (not inner DOM), which is accessible via `getAttribute()` without shadow DOM piercing
- **Comment body access**: Comment text content is in a `[slot="comment"]` child element slotted into the shadow DOM. Access via `[...comment.children].find(ch => ch.getAttribute('slot') === 'comment')`, not via `querySelector` from inside the shadow root
- **Post body access**: Post text body is in a `[slot="text-body"]` child element. Same slot-based access pattern as comments
- **No `data-testid`**: Unlike X.com, Reddit does not use `data-testid` attributes. Use element tag names (`shreddit-post`, `shreddit-comment`) and their attributes instead
- **Feed vs Search results**: Feed pages (homepage, subreddit) use `shreddit-post` elements. Search results use plain `div` cards with a different structure — use separate extraction scripts
- **Comment depth**: The `depth` attribute on `shreddit-comment` indicates nesting level. Nested comments are direct children of their parent comment element
- **Collapsed replies**: Some reply threads are collapsed behind "N more replies" buttons. Click these buttons to expand
- **Infinite scroll**: Feed uses lazy-loaded `faceplate-partial` elements. Scroll down to trigger. Posts mostly accumulate in DOM, but some may be removed in very long scroll sessions
- **SPA navigation**: Reddit is an SPA. Use `browser-cli --tab <tabId> navigate` for initial navigation, then `browser-cli --tab <tabId> wait` for dynamic content
- **Localization**: Reddit UI text adapts to browser language (e.g., "条评论" for Chinese). Stats regex in extraction scripts should handle both English and localized text
- **Sort via URL**: Both subreddit sort and comment sort are most reliably controlled via URL parameters rather than clicking dropdown UIs (which use shadow DOM)
- **GIF/media comments**: Comments with `content-type="giphy"` are GIF reactions — their `[slot="comment"]` text will be empty. Check `contentType` to distinguish from missing text
- **Score 0 display**: Comments with 0 or negative score still show a numeric value in the `score` attribute
