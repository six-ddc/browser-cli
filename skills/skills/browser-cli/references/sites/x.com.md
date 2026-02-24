# x.com

> X (formerly Twitter) — social media platform for short-form posts, news, and discussions.

## Login Detection

**Check login status before operations that require authentication** (search, explore, compose, likes, followers list). Public profiles and individual tweets are accessible without login.

**Detect login state**:

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const bottomBar = !!document.querySelector('[data-testid="BottomBar"]');
  const sidebarSignup = !!document.querySelector('[data-testid="sidebarColumn"] [data-testid="google_sign_in_container"]');
  const tweetButton = !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
  const accountSwitcher = !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
  return {
    loggedIn: !bottomBar && (!!tweetButton || !!accountSwitcher),
    bottomBar,
    sidebarSignup,
  };
})())
EOF
```

**Key selectors**:

| State      | Selector                                                                 | Description                                |
| ---------- | ------------------------------------------------------------------------ | ------------------------------------------ |
| Logged out | `[data-testid="BottomBar"]`                                              | Bottom bar with "Log in" / "Sign up" links |
| Logged out | `[data-testid="sidebarColumn"] [data-testid="google_sign_in_container"]` | Sidebar signup prompt                      |
| Logged in  | `[data-testid="SideNav_NewTweet_Button"]`                                | Compose tweet button in left sidebar       |
| Logged in  | `[data-testid="SideNav_AccountSwitcher_Button"]`                         | Account switcher at bottom of left sidebar |
| Login flow | `[data-testid="app-bar-close"]`                                          | Close button on login modal                |

**Login flow** (when browser is at `/i/flow/login`):

```bash
browser-cli fill 'input[name="text"]' '<username or email>'
browser-cli click 'div[role="button"]:has-text("Next")'
browser-cli wait 'input[name="password"]' --timeout 5000
browser-cli fill 'input[name="password"]' '<password>'
browser-cli click '[data-testid="LoginForm_Login_Button"]'
browser-cli wait '[data-testid="SideNav_NewTweet_Button"]' --timeout 10000
```

**Recommended flow**: If login is needed, prompt the user to log in manually in the browser, then `browser-cli reload`.

### Accessible Without Login

| Page            | URL Pattern                   |
| --------------- | ----------------------------- |
| Profile         | `x.com/<handle>`              |
| Tweet detail    | `x.com/<handle>/status/<id>`  |
| Profile Replies | `x.com/<handle>/with_replies` |
| Highlights      | `x.com/<handle>/highlights`   |

### Requires Login (redirects to `/i/flow/login`)

| Page      | URL Pattern                |
| --------- | -------------------------- |
| Search    | `x.com/search?q=...`       |
| Explore   | `x.com/explore`            |
| Hashtags  | `x.com/hashtag/<tag>`      |
| Followers | `x.com/<handle>/followers` |
| Likes     | `x.com/<handle>/likes`     |
| Home feed | `x.com/home`               |

## Profile Page

**URL pattern**: `/<handle>` (e.g., `/elonmusk`, `/OpenAI`)

**Navigation**: `browser-cli navigate 'https://x.com/<handle>'`

**Wait**: `browser-cli wait '[data-testid="UserName"]' --timeout 5000`

**Extract profile info**:

```bash
browser-cli eval --stdin <<'EOF'
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
browser-cli navigate 'https://x.com/<handle>/with_replies'
browser-cli wait '[data-testid="tweet"]' --timeout 5000
```

## Timeline (Tweet List)

Tweets on profile pages, search results, and home feed all share the same `[data-testid="tweet"]` structure.

**Extract tweets from current page**:

```bash
browser-cli eval --stdin <<'EOF'
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
    hasPhoto: !!el.querySelector('[data-testid="tweetPhoto"]'),
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

**Infinite scroll pagination**:

```bash
browser-cli scroll down --amount 2000
browser-cli wait 1500
```

## Tweet Detail Page

**URL pattern**: `/<handle>/status/<tweetId>`

**Navigation**: `browser-cli navigate 'https://x.com/<handle>/status/<tweetId>'`

**Wait**: `browser-cli wait '[data-testid="tweet"]' --timeout 5000`

**Extract tweet detail**:

```bash
browser-cli eval --stdin <<'EOF'
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
    hasPhoto: !!tweet.querySelector('[data-testid="tweetPhoto"]'),
    hasVideo: !!tweet.querySelector('[data-testid="videoPlayer"]'),
    hasCard: !!tweet.querySelector('[data-testid="card.wrapper"]'),
  };
})())
EOF
```

**Differences from timeline**:

| Aspect      | Timeline                  | Detail page                                                    |
| ----------- | ------------------------- | -------------------------------------------------------------- |
| Time format | Relative ("Feb 20", "2h") | Full ("8:56 AM · Apr 28, 2022")                                |
| Bookmark    | No count in `aria-label`  | Count shown ("21538 Bookmarks. Bookmark")                      |
| Engagement  | Abbreviated text          | Full metric bar with counts                                    |
| Replies     | Not shown                 | `[data-testid="logged_out_read_replies_pivot"]` for logged-out |

**Replies (logged out)**:

When logged out, replies are hidden behind a login prompt:

```bash
browser-cli eval '!!document.querySelector("[data-testid=logged_out_read_replies_pivot]")'
# Returns: true (when logged out — replies not visible)
# Text: "Read 1K replies"
```

**Replies (logged in)**: Reply tweets appear as additional `[data-testid="tweet"]` elements below the focal tweet. Use the same extraction script as timeline.

## Search (Requires Login)

**URL pattern**: `/search?q=<query>&src=typed_query&f=<tab>`

Search redirects to `/i/flow/login` when not logged in.

**Navigate to search** (logged in):

```bash
browser-cli navigate 'https://x.com/search?q=<query>&src=typed_query'
browser-cli wait '[data-testid="tweet"]' --timeout 5000
```

**Search via input** (logged in):

```bash
browser-cli click '[data-testid="SearchBox_Search_Input"]'
browser-cli fill '[data-testid="SearchBox_Search_Input"]' '<query>'
browser-cli press Enter
browser-cli wait '[data-testid="tweet"]' --timeout 5000
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

## Tweet Interactions (Requires Login)

### Like / Unlike

```bash
browser-cli click '[data-testid="like"]'       # Like (when not liked)
browser-cli click '[data-testid="unlike"]'      # Unlike (when already liked)
```

**Detect like state**:

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const tweet = document.querySelector('[data-testid="tweet"]');
  return {
    liked: !!tweet?.querySelector('[data-testid="unlike"]'),
    notLiked: !!tweet?.querySelector('[data-testid="like"]'),
  };
})())
EOF
```

| State     | Selector                 |
| --------- | ------------------------ |
| Not liked | `[data-testid="like"]`   |
| Liked     | `[data-testid="unlike"]` |

### Repost / Unrepost

```bash
browser-cli click '[data-testid="retweet"]'     # Open repost menu
# Menu appears with "Repost" and "Quote" options
```

| State        | Selector                    |
| ------------ | --------------------------- |
| Not reposted | `[data-testid="retweet"]`   |
| Reposted     | `[data-testid="unretweet"]` |

### Bookmark

```bash
browser-cli click '[data-testid="bookmark"]'    # Bookmark
browser-cli click '[data-testid="removeBookmark"]'  # Remove bookmark
```

### Reply (Compose)

On tweet detail page (logged in):

```bash
browser-cli click '[data-testid="tweetTextarea_0"]'
browser-cli fill '[data-testid="tweetTextarea_0"]' '<reply text>'
browser-cli click '[data-testid="tweetButton"]'
browser-cli wait 2000
```

## Compose Tweet (Requires Login)

```bash
browser-cli click '[data-testid="SideNav_NewTweet_Button"]'
browser-cli wait '[data-testid="tweetTextarea_0"]' --timeout 3000
browser-cli fill '[data-testid="tweetTextarea_0"]' '<tweet text>'
browser-cli click '[data-testid="tweetButton"]'
```

## Explore / Trending (Requires Login)

**URL**: `/explore`

```bash
browser-cli navigate 'https://x.com/explore'
browser-cli wait '[data-testid="trend"]' --timeout 5000
```

**Extract trending topics** (logged in):

```bash
browser-cli eval --stdin <<'EOF'
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

- **Search requires login**: `/search`, `/explore`, `/hashtag/<tag>` all redirect to `/i/flow/login`. Use URL-based navigation (`x.com/search?q=...`) after logging in
- **Replies hidden for logged out**: Tweet detail pages show `[data-testid="logged_out_read_replies_pivot"]` ("Read 1K replies") instead of actual replies. User must log in to see replies
- **`data-testid` stability**: Twitter/X uses `data-testid` attributes extensively and they are more stable than CSS classes (which are auto-generated hashes). Always prefer `data-testid` selectors
- **Engagement counts**: Use `aria-label` for exact counts (e.g., "7656 Likes. Like"), not the visible abbreviated text ("7.6K"). Zero counts have no number prefix — just "Reply", "Repost", "Like"
- **Bookmark count**: Only shown on tweet detail pages. In timeline, `aria-label` is just "Bookmark" with no count
- **Like/unlike state**: The `data-testid` toggles between `like`/`unlike` and `retweet`/`unretweet` based on state. Use presence of `unlike` to detect liked state
- **Social context**: `[data-testid="socialContext"]` shows "Pinned" for pinned tweets and "X reposted" for retweets
- **Image URLs**: Tweet images are `<img>` inside `[data-testid="tweetPhoto"]`, with `src` like `https://pbs.twimg.com/media/<id>?format=jpg&name=small`
- **Card previews**: Link previews use `[data-testid="card.wrapper"]` with `[data-testid="card.layoutLarge.media"]` inside
- **SPA navigation**: X is a full SPA. Use `browser-cli navigate` for initial navigation, then `browser-cli wait` for dynamic content
- **Rate limiting**: Twitter may throttle requests. Add `browser-cli wait 1000` between rapid successive operations
- **Bottom bar (logged out)**: The `[data-testid="BottomBar"]` occupies screen space. It cannot be dismissed without logging in
- **Follow button**: The follow button's `data-testid` includes the user's numeric ID (e.g., `44196397-follow`). Use `[data-testid$="-follow"]` to match any user's follow button
- **Virtual scroll**: Timeline uses virtual scrolling similar to other social platforms. For batch collection, use the edge-scroll-and-collect pattern (inject a global collector, scroll repeatedly, read results)
- **Domain**: Both `twitter.com` and `x.com` work; `twitter.com` redirects to `x.com`
