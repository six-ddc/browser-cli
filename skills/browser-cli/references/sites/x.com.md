# x.com

> X (formerly Twitter) — social media platform for short-form posts, news, and discussions.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://x.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

## Login Required

**Most X.com features require login.** Search, Explore, timeline interactions, followers list, and compose are all unavailable when logged out. A bottom bar also blocks the UI.

**Always check login state before any operation. If not logged in, stop and ask the user to log in manually.**

**Detect login state**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const tweetButton = !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
  const accountSwitcher = !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  return { loggedIn: tweetButton || accountSwitcher };
})())
EOF
```

**Key selectors**:

| State     | Selector                                         | Description                                |
| --------- | ------------------------------------------------ | ------------------------------------------ |
| Logged in | `[data-testid="SideNav_NewTweet_Button"]`        | Compose tweet button in left sidebar       |
| Logged in | `[data-testid="SideNav_AccountSwitcher_Button"]` | Account switcher at bottom of left sidebar |

> Note: `[data-testid="BottomBar"]` exists as an empty div even when logged in. Do NOT use it for login detection.

**If `loggedIn: false`** — stop all subsequent operations and tell the user:

> X.com is not logged in. Please log in manually in the browser, then tell me to continue.

After the user logs in, run `browser-cli --tab <tabId> reload` and re-check login state before proceeding.

## Profile Page

**URL pattern**: `/<handle>` (e.g., `/elonmusk`, `/OpenAI`)

**Navigation**: `browser-cli --tab <tabId> navigate 'https://x.com/<handle>'`

**Wait**: `browser-cli --tab <tabId> wait '[data-testid="UserName"]' --timeout 5000`

**Extract profile info**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const nameEl = document.querySelector('[data-testid="UserName"]');
  const spans = nameEl ? [...nameEl.querySelectorAll('span')] : [];
  const displayName = spans.find(s => s.innerText && !s.innerText.startsWith('@'))?.innerText;
  const handle = spans.find(s => s.innerText?.startsWith('@'))?.innerText;
  const description = document.querySelector('[data-testid="UserDescription"]')?.innerText || "";
  const joinDate = document.querySelector('[data-testid="UserJoinDate"]')?.innerText || "";
  const website = document.querySelector('[data-testid="UserUrl"]')?.innerText || "";
  const following = document.querySelector('a[href$="/following"]')?.innerText || "";
  const followers = (document.querySelector('a[href$="/verified_followers"]') || document.querySelector('a[href$="/followers"]'))?.innerText || "";
  const verified = !!document.querySelector('[data-testid="icon-verified"]');
  return { displayName, handle, description, joinDate, website, following, followers, verified };
})())
EOF
```

**Key selectors**:

| Element        | Selector                                        | Description                                      |
| -------------- | ----------------------------------------------- | ------------------------------------------------ |
| Display name   | `[data-testid="UserName"]`                      | Contains display name + @handle                  |
| Bio            | `[data-testid="UserDescription"]`               | Profile bio text                                 |
| Header items   | `[data-testid="UserProfileHeader_Items"]`       | Container for location, website, join date       |
| Join date      | `[data-testid="UserJoinDate"]`                  | "Joined June 2009"                               |
| Website        | `[data-testid="UserUrl"]`                       | Profile website link                             |
| Avatar         | `[data-testid="UserAvatar-Container-<handle>"]` | Profile avatar (testid includes handle)          |
| Follow button  | `[data-testid="<userId>-follow"]`               | Follow/unfollow button (testid includes user ID) |
| Verified badge | `[data-testid="icon-verified"]`                 | Blue checkmark badge                             |
| Following link | `a[href$="/following"]`                         | "1,288 Following"                                |
| Followers link | `a[href$="/verified_followers"]`                | "235.2M Followers"                               |
| Banner photo   | `a[href*="/header_photo"]`                      | Profile banner image                             |
| Back button    | `[data-testid="app-bar-back"]`                  | Back arrow in header                             |

**Profile tabs**:

Tabs are `[role="tab"]` elements. Switch tabs via URL or click:

| Tab        | URL                      |
| ---------- | ------------------------ |
| Posts      | `/<handle>`              |
| Replies    | `/<handle>/with_replies` |
| Highlights | `/<handle>/highlights`   |
| Media      | `/<handle>/media`        |

```bash
# Switch to Replies tab
browser-cli --tab <tabId> navigate 'https://x.com/<handle>/with_replies'
browser-cli --tab <tabId> wait '[data-testid="tweet"]' --timeout 5000
```

## Timeline (Tweet List)

Tweets on profile pages, search results, and home feed all share the same `[data-testid="tweet"]` structure.

**Extract tweets from current page**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('[data-testid="tweet"]')].map((el, i) => {
  const userNameEl = el.querySelector('[data-testid="User-Name"]');
  const links = userNameEl ? [...userNameEl.querySelectorAll('a')] : [];
  const displayName = links[0]?.innerText || "";
  const handle = links[1]?.innerText || "";
  const text = el.querySelector('[data-testid="tweetText"]')?.innerText || "";
  const time = el.querySelector('time');
  const statusLink = el.querySelector('a[href*="/status/"]');
  const socialCtx = el.querySelector('[data-testid="socialContext"]')?.innerText || "";
  const parseCount = label => {
    if (!label) return "0";
    const m = label.match(/^(\d[\d,]*)/);
    return m ? m[1] : "0";
  };
  return {
    index: i + 1,
    displayName, handle,
    text: text.substring(0, 280),
    datetime: time?.getAttribute('datetime') || "",
    timeText: time?.innerText || "",
    tweetUrl: statusLink?.href || "",
    socialContext: socialCtx,
    replies: parseCount(el.querySelector('[data-testid="reply"]')?.getAttribute('aria-label')),
    retweets: parseCount(el.querySelector('[data-testid="retweet"]')?.getAttribute('aria-label')),
    likes: parseCount(el.querySelector('[data-testid="like"]')?.getAttribute('aria-label')),
    photos: [...el.querySelectorAll('[data-testid="tweetPhoto"] img')].map(img => img.src.replace(/name=\w+/, 'name=large')),
    hasVideo: !!el.querySelector('[data-testid="videoPlayer"]'),
    hasCard: !!el.querySelector('[data-testid="card.wrapper"]'),
  };
}))
EOF
```

**Key selectors (per tweet)**:

| Element         | Selector                            | Description                                      |
| --------------- | ----------------------------------- | ------------------------------------------------ |
| Tweet container | `[data-testid="tweet"]`             | Each tweet in timeline                           |
| User name area  | `[data-testid="User-Name"]`         | Display name + @handle + time                    |
| Avatar          | `[data-testid="Tweet-User-Avatar"]` | Tweet author avatar                              |
| Tweet text      | `[data-testid="tweetText"]`         | Tweet body text                                  |
| Time            | `time`                              | `datetime` attr has ISO format; text is relative |
| Tweet link      | `a[href*="/status/"]`               | Link to tweet detail page                        |
| Social context  | `[data-testid="socialContext"]`     | "Pinned", "X reposted"                           |
| Reply button    | `[data-testid="reply"]`             | `aria-label`: "1068 Replies. Reply"              |
| Repost button   | `[data-testid="retweet"]`           | `aria-label`: "1204 reposts. Repost"             |
| Like button     | `[data-testid="like"]`              | `aria-label`: "7656 Likes. Like"                 |
| Bookmark button | `[data-testid="bookmark"]`          | `aria-label`: "Bookmark" (no count in timeline)  |
| Options menu    | `[data-testid="caret"]`             | Three-dot menu on tweet                          |
| Photo           | `[data-testid="tweetPhoto"]`        | Image attachment(s)                              |
| Video           | `[data-testid="videoPlayer"]`       | Video player                                     |
| Card (link)     | `[data-testid="card.wrapper"]`      | Link preview card                                |
| Quote tweet     | `[data-testid="quoteTweet"]`        | Embedded quoted tweet                            |
| Timeline cell   | `[data-testid="cellInnerDiv"]`      | Wrapper div for each timeline item               |

**Engagement count parsing**:

Counts are in `aria-label` of the engagement buttons. Parse with regex:

```js
// aria-label format: "1068 Replies. Reply", "1204 reposts. Repost", "7656 Likes. Like"
// When count is 0: "Reply", "Repost", "Like" (no number prefix)
const parseCount = (label) => {
  if (!label) return '0';
  const m = label.match(/^(\d[\d,]*)/);
  return m ? m[1] : '0';
};
```

Visible abbreviated text (e.g., "1K", "7.6K") is in `[data-testid="app-text-transition-container"]` inside each button, but `aria-label` has the exact count.

**Infinite scroll — virtual scroll warning**:

X.com uses virtual scrolling — older tweets are **removed from the DOM** as you scroll down.
A simple `querySelectorAll` after scrolling will miss earlier tweets.

**For collecting N tweets, use the global collector pattern:**

Step 1 — Inject collector and collect initial batch:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
window.__tweetCollector = new Map();
function __collectTweets() {
  document.querySelectorAll('article[data-testid="tweet"]').forEach(el => {
    const url = el.querySelector('a[href*="/status/"]')?.href || "";
    if (!url || window.__tweetCollector.has(url)) return;
    const ctx = el.querySelector('[data-testid="socialContext"]')?.innerText || "";
    const userNameEl = el.querySelector('[data-testid="User-Name"]');
    const links = userNameEl ? [...userNameEl.querySelectorAll('a')] : [];
    const photos = [...el.querySelectorAll('[data-testid="tweetPhoto"] img')].map(img => img.src.replace(/name=\w+/, 'name=large'));
    window.__tweetCollector.set(url, {
      displayName: links[0]?.innerText || "",
      handle: links[1]?.innerText || "",
      text: el.querySelector('[data-testid="tweetText"]')?.innerText?.substring(0, 280) || "",
      time: el.querySelector('time')?.getAttribute('datetime') || "",
      url,
      socialContext: ctx,
      photos,
      hasVideo: !!el.querySelector('[data-testid="videoPlayer"]'),
    });
  });
  return window.__tweetCollector.size;
}
__collectTweets();
EOF
```

Step 2 — Scroll and collect in a loop until you have enough:

```bash
browser-cli --tab <tabId> scroll down --amount 2000
browser-cli --tab <tabId> wait 1500
browser-cli --tab <tabId> eval '__collectTweets()'   # returns total collected count
# Repeat until count >= N
```

Step 3 — Read results:

```bash
browser-cli --tab <tabId> eval 'JSON.stringify([...window.__tweetCollector.values()])'
```

Step 4 — Cleanup:

```bash
browser-cli --tab <tabId> eval 'delete window.__tweetCollector; delete window.__collectTweets;'
```

## Tweet Detail Page

**URL pattern**: `/<handle>/status/<tweetId>`

**Navigation**: `browser-cli --tab <tabId> navigate 'https://x.com/<handle>/status/<tweetId>'`

**Wait**: `browser-cli --tab <tabId> wait '[data-testid="tweet"]' --timeout 5000`

**Extract tweet detail**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const tweet = document.querySelector('[data-testid="tweet"]');
  if (!tweet) return { error: "tweet not found" };
  const userName = tweet.querySelector('[data-testid="User-Name"]');
  const links = userName ? [...userName.querySelectorAll('a')] : [];
  const displayName = links[0]?.innerText || "";
  const handle = links[1]?.innerText || "";
  const text = tweet.querySelector('[data-testid="tweetText"]')?.innerText || "";
  const time = tweet.querySelector('time');
  const parseCount = label => {
    if (!label) return "0";
    const m = label.match(/^(\d[\d,]*)/);
    return m ? m[1] : "0";
  };
  return {
    displayName, handle,
    text,
    datetime: time?.getAttribute('datetime') || "",
    timeText: time?.innerText || "",
    replies: parseCount(tweet.querySelector('[data-testid="reply"]')?.getAttribute('aria-label')),
    retweets: parseCount(tweet.querySelector('[data-testid="retweet"]')?.getAttribute('aria-label')),
    likes: parseCount(tweet.querySelector('[data-testid="like"]')?.getAttribute('aria-label')),
    bookmarks: parseCount(tweet.querySelector('[data-testid="bookmark"]')?.getAttribute('aria-label')),
    photos: [...tweet.querySelectorAll('[data-testid="tweetPhoto"] img')].map(img => img.src.replace(/name=\w+/, 'name=large')),
    hasVideo: !!tweet.querySelector('[data-testid="videoPlayer"]'),
    hasCard: !!tweet.querySelector('[data-testid="card.wrapper"]'),
  };
})())
EOF
```

**Differences from timeline**:

| Aspect      | Timeline                  | Detail page                               |
| ----------- | ------------------------- | ----------------------------------------- |
| Time format | Relative ("Feb 20", "2h") | Full ("8:56 AM · Apr 28, 2022")           |
| Bookmark    | No count in `aria-label`  | Count shown ("21538 Bookmarks. Bookmark") |
| Engagement  | Abbreviated text          | Full metric bar with counts               |
| Replies     | Not shown                 | Reply tweets appear below the focal tweet |

**Replies**: Reply tweets appear as additional `[data-testid="tweet"]` elements below the focal tweet. Use the same extraction script as Timeline. Replies also use virtual scrolling — use the global collector pattern (see Timeline section) when collecting multiple replies.

## Screenshot & Image Extraction

### Screenshot a tweet

```bash
# Entire tweet (text + media + engagement bar)
browser-cli --tab <tabId> screenshot --selector 'article[data-testid="tweet"]' --path tweet.png

# Only the photo/media area
browser-cli --tab <tabId> screenshot --selector 'article[data-testid="tweet"] [data-testid="tweetPhoto"]' --path tweet-photo.png

# Full page screenshot
browser-cli --tab <tabId> screenshot --path page.png
```

### Extract image URLs

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const tweet = document.querySelector('article[data-testid="tweet"]');
  const photos = [...(tweet?.querySelectorAll('[data-testid="tweetPhoto"] img') || [])];
  return photos.map((img, i) => ({
    index: i + 1,
    src: img.src,
    largeSrc: img.src.replace(/name=\w+/, 'name=large'),
  }));
})())
EOF
```

Image URL format: `https://pbs.twimg.com/media/<id>?format=jpg&name=<size>`

| Size param | Resolution |
| ---------- | ---------- |
| `small`    | 680px      |
| `medium`   | 1200px     |
| `large`    | Original   |

### Check media type

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const tweet = document.querySelector('article[data-testid="tweet"]');
  return {
    hasPhoto: !!tweet?.querySelector('[data-testid="tweetPhoto"]'),
    hasVideo: !!tweet?.querySelector('[data-testid="videoPlayer"]'),
    hasCard: !!tweet?.querySelector('[data-testid="card.wrapper"]'),
    photoCount: tweet?.querySelectorAll('[data-testid="tweetPhoto"] img').length || 0,
  };
})())
EOF
```

## Search

**URL pattern**: `/search?q=<query>&src=typed_query&f=<tab>`

**Navigate to search**:

```bash
browser-cli --tab <tabId> navigate 'https://x.com/search?q=<query>&src=typed_query'
browser-cli --tab <tabId> wait '[data-testid="tweet"]' --timeout 5000
```

**Search via input**:

```bash
browser-cli --tab <tabId> click '[data-testid="SearchBox_Search_Input"]'
browser-cli --tab <tabId> fill '[data-testid="SearchBox_Search_Input"]' '<query>'
browser-cli --tab <tabId> press Enter
browser-cli --tab <tabId> wait '[data-testid="tweet"]' --timeout 5000
```

**Search tabs** (URL `f` parameter):

| Tab    | URL param | Description   |
| ------ | --------- | ------------- |
| Top    | `f=top`   | Top results   |
| Latest | `f=live`  | Most recent   |
| People | `f=user`  | User results  |
| Media  | `f=media` | Media results |
| Lists  | `f=list`  | List results  |

**Extract search results**: Same tweet extraction script as Timeline section.

## Text Input (Draft.js)

X.com uses Draft.js `contentEditable` divs for all text inputs (compose, reply, quote).
**`browser-cli fill` and `browser-cli type` do NOT work** — they only support native `<input>`/`<textarea>`.

Use `browser-cli eval` to simulate a paste or insertText event:

```bash
# Method: InputEvent beforeinput (recommended)
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const el = document.querySelector('<textarea-selector>');
  el.focus();
  el.dispatchEvent(new InputEvent('beforeinput', {
    inputType: 'insertText',
    data: '<text>',
    bubbles: true,
    cancelable: true,
  }));
})()
EOF
```

After input, verify the submit button is enabled:

```bash
browser-cli --tab <tabId> eval 'document.querySelector("<button-selector>")?.getAttribute("aria-disabled")'
# null = enabled, "true" = disabled (text is empty or exceeds limit)
```

## Tweet Interactions

All interactions require navigating to the tweet first:

```bash
browser-cli --tab <tabId> navigate 'https://x.com/<handle>/status/<tweetId>'
browser-cli --tab <tabId> wait 'article[data-testid="tweet"]' --timeout 5000
```

### Like / Unlike

```bash
# Check state first
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify((() => {
  const tweet = document.querySelector('article[data-testid="tweet"]');
  return {
    liked: !!tweet?.querySelector('[data-testid="unlike"]'),
    notLiked: !!tweet?.querySelector('[data-testid="like"]'),
  };
})())
EOF

# Like (if not already liked)
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="like"]'
browser-cli --tab <tabId> wait 1000

# Verify — unlike button should now be visible
browser-cli --tab <tabId> eval '!!document.querySelector("article[data-testid=\"tweet\"] [data-testid=\"unlike\"]")'

# Unlike (if already liked)
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="unlike"]'
```

| State     | Selector                 |
| --------- | ------------------------ |
| Not liked | `[data-testid="like"]`   |
| Liked     | `[data-testid="unlike"]` |

### Repost

```bash
# Check state first
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify({
  reposted: !!document.querySelector('article[data-testid="tweet"] [data-testid="unretweet"]'),
  notReposted: !!document.querySelector('article[data-testid="tweet"] [data-testid="retweet"]'),
})
EOF

# Repost (if not already reposted)
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="retweet"]'
browser-cli --tab <tabId> wait '[data-testid="retweetConfirm"]' --timeout 3000
browser-cli --tab <tabId> click '[data-testid="retweetConfirm"]'
browser-cli --tab <tabId> wait 1500

# Verify — unretweet button should now be visible
browser-cli --tab <tabId> eval '!!document.querySelector("article[data-testid=\"tweet\"] [data-testid=\"unretweet\"]")'

# Undo repost
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="unretweet"]'
browser-cli --tab <tabId> wait '[data-testid="unretweetConfirm"]' --timeout 3000
browser-cli --tab <tabId> click '[data-testid="unretweetConfirm"]'
```

| State        | Selector                    | Menu confirm                       |
| ------------ | --------------------------- | ---------------------------------- |
| Not reposted | `[data-testid="retweet"]`   | `[data-testid="retweetConfirm"]`   |
| Reposted     | `[data-testid="unretweet"]` | `[data-testid="unretweetConfirm"]` |

### Quote Tweet

```bash
# Open retweet menu → click Quote
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="retweet"]'
browser-cli --tab <tabId> wait '[role="menuitem"]' --timeout 3000
browser-cli --tab <tabId> click '[role="menuitem"]:last-child'   # "Quote" is the second menu item
browser-cli --tab <tabId> wait '[role="dialog"][aria-modal="true"]' --timeout 3000

# Input comment via eval (see "Text Input" section)
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const el = document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]');
  el.focus();
  el.dispatchEvent(new InputEvent('beforeinput', {
    inputType: 'insertText', data: '<comment>', bubbles: true, cancelable: true,
  }));
})()
EOF

# Submit
browser-cli --tab <tabId> click '[role="dialog"] [data-testid="tweetButton"]'
browser-cli --tab <tabId> wait 2000
```

### Reply

```bash
# Click reply button → opens dialog
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="reply"]'
browser-cli --tab <tabId> wait '[role="dialog"][aria-modal="true"]' --timeout 3000

# Input reply via eval (see "Text Input" section)
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const el = document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]');
  el.focus();
  el.dispatchEvent(new InputEvent('beforeinput', {
    inputType: 'insertText', data: '<reply text>', bubbles: true, cancelable: true,
  }));
})()
EOF

# Submit
browser-cli --tab <tabId> click '[role="dialog"] [data-testid="tweetButton"]'
browser-cli --tab <tabId> wait 2000
```

### Bookmark

```bash
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="bookmark"]'         # Bookmark
browser-cli --tab <tabId> click 'article[data-testid="tweet"] [data-testid="removeBookmark"]'    # Remove bookmark
```

### Dialog selectors (reply / quote)

| Element       | Selector                                          |
| ------------- | ------------------------------------------------- |
| Dialog        | `[role="dialog"][aria-modal="true"]`              |
| Text input    | `[role="dialog"] [data-testid="tweetTextarea_0"]` |
| Submit button | `[role="dialog"] [data-testid="tweetButton"]`     |

## Compose Tweet

**From Home page** (inline compose):

```bash
browser-cli --tab <tabId> navigate 'https://x.com/home'
browser-cli --tab <tabId> wait '[data-testid="tweetTextarea_0"]' --timeout 5000

# Input text via eval (see "Text Input" section)
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const el = document.querySelector('[data-testid="tweetTextarea_0"]');
  el.focus();
  el.dispatchEvent(new InputEvent('beforeinput', {
    inputType: 'insertText', data: '<tweet text>', bubbles: true, cancelable: true,
  }));
})()
EOF

browser-cli --tab <tabId> click '[data-testid="tweetButtonInline"]'
browser-cli --tab <tabId> wait 2000
```

**From anywhere** (modal compose):

```bash
browser-cli --tab <tabId> click '[data-testid="SideNav_NewTweet_Button"]'
browser-cli --tab <tabId> wait '[role="dialog"] [data-testid="tweetTextarea_0"]' --timeout 3000

# Input text via eval (see "Text Input" section)
browser-cli --tab <tabId> eval --stdin <<'EOF'
(() => {
  const el = document.querySelector('[role="dialog"] [data-testid="tweetTextarea_0"]');
  el.focus();
  el.dispatchEvent(new InputEvent('beforeinput', {
    inputType: 'insertText', data: '<tweet text>', bubbles: true, cancelable: true,
  }));
})()
EOF

browser-cli --tab <tabId> click '[role="dialog"] [data-testid="tweetButton"]'
browser-cli --tab <tabId> wait 2000
```

> Note: Home page uses `tweetButtonInline`; modal compose (SideNav button, reply, quote) uses `tweetButton`.

## Explore / Trending

**URL**: `/explore`

```bash
browser-cli --tab <tabId> navigate 'https://x.com/explore'
browser-cli --tab <tabId> wait '[data-testid="trend"]' --timeout 5000
```

**Extract trending topics**:

```bash
browser-cli --tab <tabId> eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('[data-testid="trend"]')].map((el, i) => ({
  index: i + 1,
  text: el.innerText,
})))
EOF
```

## Logged-In Navigation Selectors

| Element          | Selector                                         |
| ---------------- | ------------------------------------------------ |
| Home             | `[data-testid="AppTabBar_Home_Link"]`            |
| Explore          | `[data-testid="AppTabBar_Explore_Link"]`         |
| Notifications    | `[data-testid="AppTabBar_Notifications_Link"]`   |
| Messages         | `[data-testid="AppTabBar_DirectMessage_Link"]`   |
| Profile          | `[data-testid="AppTabBar_Profile_Link"]`         |
| Compose button   | `[data-testid="SideNav_NewTweet_Button"]`        |
| Account switcher | `[data-testid="SideNav_AccountSwitcher_Button"]` |
| Search input     | `[data-testid="SearchBox_Search_Input"]`         |

## Notes

- **Draft.js text input**: All compose fields (`tweetTextarea_0`) are `contentEditable` divs (Draft.js), NOT native inputs. `browser-cli fill`/`type` will fail. Must use `eval` with `InputEvent('beforeinput', { inputType: 'insertText' })` — see "Text Input" section
- **`data-testid` stability**: Twitter/X uses `data-testid` attributes extensively and they are more stable than CSS classes (which are auto-generated hashes). Always prefer `data-testid` selectors
- **Engagement counts**: Use `aria-label` for exact counts (e.g., "7656 Likes. Like"), not the visible abbreviated text ("7.6K"). Zero counts have no number prefix — just "Reply", "Repost", "Like"
- **Bookmark count**: Only shown on tweet detail pages. In timeline, `aria-label` is just "Bookmark" with no count
- **Like/unlike state**: The `data-testid` toggles between `like`/`unlike` and `retweet`/`unretweet` based on state. Use presence of `unlike` to detect liked state
- **Social context**: `[data-testid="socialContext"]` shows "Pinned" for pinned tweets and "X reposted" for retweets
- **Media-only tweets**: Some tweets have no text — only images or video. `[data-testid="tweetText"]` will not exist. Always use `?.innerText || ""` and check `hasPhoto`/`hasVideo` to distinguish media-only tweets from empty results
- **Image URLs**: Tweet images are `<img>` inside `[data-testid="tweetPhoto"]`, with `src` like `https://pbs.twimg.com/media/<id>?format=jpg&name=small`
- **Card previews**: Link previews use `[data-testid="card.wrapper"]` with `[data-testid="card.layoutLarge.media"]` inside
- **SPA navigation**: X is a full SPA. Use `browser-cli navigate` for initial navigation, then `browser-cli wait` for dynamic content
- **Rate limiting**: Twitter may throttle requests. Add `browser-cli --tab <tabId> wait 1000` between rapid successive operations
- **Follow button**: The follow button's `data-testid` includes the user's numeric ID (e.g., `44196397-follow`). Use `[data-testid$="-follow"]` to match any user's follow button
- **Virtual scroll**: Timeline uses virtual scrolling — older tweets are removed from DOM as you scroll. Always use the global collector pattern (see "Infinite scroll" in Timeline section) when collecting multiple tweets
- **Domain**: Both `twitter.com` and `x.com` work; `twitter.com` redirects to `x.com`
- **CSP error with `eval`**: If `browser-cli eval` returns a CSP (Content Security Policy) error on Chrome, the browser extension likely lacks the "User Scripts" permission. Ask the user to: go to `chrome://extensions`, find the Browser-CLI extension, click **Details**, and enable **Allow User Scripts**. Then reload the x.com page and retry. Without this permission, `chrome.scripting.executeScript({ world: 'MAIN' })` cannot inject scripts into pages with strict CSP like x.com
