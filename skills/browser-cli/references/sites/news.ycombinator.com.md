# news.ycombinator.com

> Hacker News — tech community news aggregator by Y Combinator.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://news.ycombinator.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

## Login Detection

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify({
  loggedIn: !!document.querySelector('#logout'),
  loginLink: !!document.querySelector('a[href*="login"]'),
  username: document.querySelector('#me')?.innerText || null,
})
EOF
```

| State      | Indicator                            |
| ---------- | ------------------------------------ |
| Logged in  | `#logout` exists, `#me` has username |
| Logged out | `a[href*="login"]` visible           |

Most pages are public. Login is only needed for voting, commenting, and submitting.

## Front Page (Post List)

**URL pattern**: `/`, `/news`, `/newest`, `/front`, `/ask`, `/show`, `/jobs`

All category pages share the same DOM structure except `/jobs` (no score/comments).

**Navigation**:

```bash
browser-cli --tab <tabId> navigate 'https://news.ycombinator.com/'
browser-cli --tab <tabId> wait '.athing' --timeout 5000
```

Category URLs:

| Category         | URL                                        |
| ---------------- | ------------------------------------------ |
| Top (default)    | `https://news.ycombinator.com/`            |
| New              | `https://news.ycombinator.com/newest`      |
| Past (yesterday) | `https://news.ycombinator.com/front`       |
| Comments         | `https://news.ycombinator.com/newcomments` |
| Ask HN           | `https://news.ycombinator.com/ask`         |
| Show HN          | `https://news.ycombinator.com/show`        |
| Jobs             | `https://news.ycombinator.com/jobs`        |

**Extract posts**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.athing')].map((el, i) => {
  const titleLink = el.querySelector('.titleline > a');
  const siteStr = el.querySelector('.sitestr')?.innerText || '';
  const sub = el.nextElementSibling;
  const score = sub?.querySelector('.score')?.innerText || '';
  const user = sub?.querySelector('.hnuser')?.innerText || '';
  const age = sub?.querySelector('.age a')?.innerText || '';
  const links = [...(sub?.querySelectorAll('a') || [])];
  const last = links[links.length - 1];
  const comments = last?.innerText?.includes('comment') || last?.innerText === 'discuss'
    ? last.innerText : '';
  return {
    index: i + 1,
    id: el.id,
    title: titleLink?.innerText || '',
    url: titleLink?.href || '',
    site: siteStr,
    score, user, age, comments,
  };
}))
EOF
```

**Extract jobs** (no score/user/comments):

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.athing')].map((el, i) => {
  const titleLink = el.querySelector('.titleline > a');
  const sub = el.nextElementSibling;
  const age = sub?.querySelector('.age a')?.innerText || '';
  return {
    index: i + 1,
    title: titleLink?.innerText || '',
    url: titleLink?.href || '',
    age,
  };
}))
EOF
```

**Key selectors**:

| Element        | Selector               | Description                     |
| -------------- | ---------------------- | ------------------------------- |
| Post row       | `.athing`              | Each post is a `<tr>`           |
| Rank           | `.rank`                | e.g. "1."                       |
| Title + link   | `.titleline > a`       | First `<a>` in titleline span   |
| Site domain    | `.sitestr`             | e.g. "github.com"               |
| Subtext row    | `.athing` + next `tr`  | Sibling `<tr>` with `.subtext`  |
| Score          | `.score`               | e.g. "128 points"               |
| Author         | `.hnuser`              | Username link                   |
| Age            | `.age a`               | e.g. "3 hours ago"              |
| Comments link  | last `a` in `.subtext` | e.g. "44 comments" or "discuss" |
| More (next pg) | `.morelink`            | "More" link at page bottom      |

**Pagination**:

URL-based — append `?p=<n>`:

```bash
browser-cli --tab <tabId> navigate 'https://news.ycombinator.com/news?p=2'
browser-cli --tab <tabId> wait '.athing' --timeout 5000
```

Or click the "More" link:

```bash
browser-cli --tab <tabId> click '.morelink'
browser-cli --tab <tabId> wait '.athing' --timeout 5000
```

## Comment Page (Post Detail)

**URL pattern**: `/item?id=<post-id>`

**Navigation**:

```bash
browser-cli --tab <tabId> navigate 'https://news.ycombinator.com/item?id=<post-id>'
browser-cli --tab <tabId> wait '.comment-tree' --timeout 5000
```

**Extract post metadata**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const fat = document.querySelector('.fatitem');
  if (!fat) return null;
  return {
    title: fat.querySelector('.titleline > a')?.innerText || '',
    url: fat.querySelector('.titleline > a')?.href || '',
    score: fat.querySelector('.score')?.innerText || '',
    user: fat.querySelector('.hnuser')?.innerText || '',
    age: fat.querySelector('.age a')?.innerText || '',
  };
})())
EOF
```

**Extract all comments** (JSON, preserves nesting depth and paragraph structure):

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.comtr')].map(el => {
  const depth = parseInt(el.querySelector('.ind')?.getAttribute('indent') || '0');
  const ct = el.querySelector('.commtext');
  const parts = [];
  if (ct) {
    for (const node of ct.childNodes) {
      const t = node.nodeType === 3 ? node.textContent.trim()
        : (node.innerText?.trim() || node.textContent?.trim() || '');
      if (t) parts.push(t);
    }
  }
  return {
    id: el.id,
    depth,
    user: el.querySelector('.hnuser')?.innerText || '[deleted]',
    age: el.querySelector('.age a')?.innerText || '',
    text: parts.join('\n\n'),
  };
}))
EOF
```

The `depth` field indicates nesting level: `0` = top-level, `1` = reply, `2` = reply-to-reply, etc. Multi-paragraph comments are joined with `\n\n`.

**Formatted comment tree** (human-readable tree view, recommended for display):

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const comments = [...document.querySelectorAll('.comtr')];
  const lines = comments.map(el => {
    const depth = parseInt(el.querySelector('.ind')?.getAttribute('indent') || '0');
    const user = el.querySelector('.hnuser')?.innerText || '[deleted]';
    const ct = el.querySelector('.commtext');
    const parts = [];
    if (ct) {
      for (const node of ct.childNodes) {
        const t = node.nodeType === 3 ? node.textContent.trim()
          : (node.innerText?.trim() || node.textContent?.trim() || '');
        if (t) parts.push(t);
      }
    }
    const text = parts.join(' ') || '[deleted]';
    const prefix = depth === 0 ? '' : '│' + '  │'.repeat(depth - 1) + '  ├─ ';
    return `${prefix}[${user}]: ${text}`;
  });
  return lines.join('\n');
})()
EOF
```

**Key selectors**:

| Element          | Selector           | Description                            |
| ---------------- | ------------------ | -------------------------------------- |
| Post container   | `.fatitem`         | The post itself (title, score, etc.)   |
| Comment tree     | `.comment-tree`    | Container for all comments             |
| Comment row      | `.comtr`           | Each comment `<tr>`, `id` = comment ID |
| Indent indicator | `.ind[indent]`     | `indent` attr = nesting level (0,1,2…) |
| Comment author   | `.hnuser`          | Username link                          |
| Comment age      | `.age a`           | e.g. "2 hours ago"                     |
| Comment text     | `.commtext`        | Comment body (may contain HTML links)  |
| Toggle collapse  | `.togg`            | `[–]` button to collapse a thread      |
| Nav links        | `.comhead .navs a` | "next", "prev", "parent" links         |

**More comments pagination**:

If a post has many comments, a "More" link appears at the bottom:

```bash
browser-cli --tab <tabId> click '.morelink'
browser-cli --tab <tabId> wait '.comtr' --timeout 5000
```

## Interactions

**Collapse/expand a comment thread**:

```bash
browser-cli --tab <tabId> click '#<comment-id>.togg'
```

**Navigate to a specific comment**:

```bash
browser-cli --tab <tabId> navigate 'https://news.ycombinator.com/item?id=<comment-id>'
browser-cli --tab <tabId> wait '.comtr' --timeout 5000
```

**User profile**:

```bash
browser-cli --tab <tabId> navigate 'https://news.ycombinator.com/user?id=<username>'
browser-cli --tab <tabId> wait '#hnmain' --timeout 5000
```

## Search

Hacker News uses Algolia for search:

```bash
browser-cli --tab <tabId> navigate 'https://hn.algolia.com/?q=<query>'
browser-cli --tab <tabId> wait '.Story' --timeout 5000
```

**Extract Algolia search results**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.Story')].map((el, i) => ({
  index: i + 1,
  title: el.querySelector('.Story_title a')?.innerText || '',
  url: el.querySelector('.Story_title a')?.href || '',
  points: el.querySelector('.Story_meta span')?.innerText || '',
  author: el.querySelector('.Story_meta a')?.innerText || '',
  age: el.querySelectorAll('.Story_meta span')?.[1]?.innerText || '',
})))
EOF
```

## Notes

- **No data-testid attributes**: HN uses semantic class names (`.athing`, `.comtr`, `.hnuser`, etc.) which are stable.
- **Static HTML**: HN is server-rendered, no SPA framework. Pages load fast and selectors are immediately available.
- **30 items per page**: Each list page shows 30 posts. Use `?p=2`, `?p=3` for more.
- **Comment indent**: The `.ind` element has an `indent` attribute (0, 1, 2, …) representing depth. The inner `<img>` has `width` = `indent * 40` pixels.
- **Deleted comments**: Deleted comments show `[deleted]` with no `.hnuser` element. The extraction scripts handle this with `|| '[deleted]'`.
- **Ask HN / Show HN**: These use the same post list structure. Ask HN posts link to their own comment page (self-posts). Show HN posts may link to external URLs.
- **Rate limiting**: HN may rate-limit rapid requests. Add `browser-cli --tab <tabId> wait 1000` between navigations if needed.
- **No login required for reading**: All posts and comments are publicly accessible.
