# x.com

> X (formerly Twitter) — social media platform for short-form posts, news, and discussions.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://x.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/x.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/x.mjs --call detectLogin
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/x.mjs --call navigateSearch -- --query "AI news" --tab "live"
> ```
>
> When the agent runs, replace `scripts/x.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/x.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from x.mjs extractTweets, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll('[data-testid="tweet"]')].slice(0,3).map(el => ({ text: el.querySelector('[data-testid="tweetText"]')?.innerText || "" })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("[data-testid=\"tweet\"]").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login Detection

| State     | Selector                                         | Notes                                              |
| --------- | ------------------------------------------------ | -------------------------------------------------- |
| Logged in | `[data-testid="SideNav_NewTweet_Button"]`        | Post button in left sidebar; presence = logged in  |
| Logged in | `[data-testid="SideNav_AccountSwitcher_Button"]` | Account switcher at the bottom of the left sidebar |

> Note: `[data-testid="BottomBar"]` exists as an empty div even when logged in. Do NOT use it for login detection.

### Profile Page

**URL format**: `/<handle>` (e.g. `/elonmusk`, `/OpenAI`)

| Element               | Selector                                        | Notes                                      |
| --------------------- | ----------------------------------------------- | ------------------------------------------ |
| Display name          | `[data-testid="UserName"]`                      | Contains display name + @handle            |
| Bio                   | `[data-testid="UserDescription"]`               | Profile bio text                           |
| Header info container | `[data-testid="UserProfileHeader_Items"]`       | Container for location, website, join date |
| Join date             | `[data-testid="UserJoinDate"]`                  | "Joined June 2009"                         |
| Website               | `[data-testid="UserUrl"]`                       | Profile website link                       |
| Avatar                | `[data-testid="UserAvatar-Container-<handle>"]` | testid includes handle                     |
| Follow button         | `[data-testid="<userId>-follow"]`               | testid includes numeric user ID            |
| Verified badge        | `[data-testid="icon-verified"]`                 | Blue verified checkmark                    |
| Following link        | `a[href$="/following"]`                         | "1,288 Following"                          |
| Followers link        | `a[href$="/verified_followers"]`                | "235.2M Followers"                         |
| Banner photo          | `a[href*="/header_photo"]`                      | Profile banner image                       |
| Back button           | `[data-testid="app-bar-back"]`                  | Back arrow in header                       |

**Profile tab URLs**:

| Tab        | URL                      |
| ---------- | ------------------------ |
| Posts      | `/<handle>`              |
| Replies    | `/<handle>/with_replies` |
| Highlights | `/<handle>/highlights`   |
| Media      | `/<handle>/media`        |

### Tweets (Timeline / Search / Detail page — universal)

| Element          | Selector                            | Notes                                                        |
| ---------------- | ----------------------------------- | ------------------------------------------------------------ |
| Tweet container  | `[data-testid="tweet"]`             | Each tweet in the Timeline                                   |
| Username area    | `[data-testid="User-Name"]`         | Contains display name + @handle + timestamp                  |
| Avatar           | `[data-testid="Tweet-User-Avatar"]` | Tweet author avatar                                          |
| Tweet text       | `[data-testid="tweetText"]`         | Tweet body text                                              |
| Timestamp        | `time`                              | `datetime` attribute is ISO format; visible text is relative |
| Tweet link       | `a[href*="/status/"]`               | Links to tweet detail page                                   |
| Social context   | `[data-testid="socialContext"]`     | "Pinned", "X reposted"                                       |
| Reply button     | `[data-testid="reply"]`             | `aria-label`: "1068 Replies. Reply"                          |
| Repost button    | `[data-testid="retweet"]`           | `aria-label`: "1204 reposts. Repost"                         |
| Like button      | `[data-testid="like"]`              | `aria-label`: "7656 Likes. Like"                             |
| Bookmark button  | `[data-testid="bookmark"]`          | `aria-label`: "Bookmark" (no count in Timeline)              |
| Options menu     | `[data-testid="caret"]`             | Tweet three-dot menu                                         |
| Photo attachment | `[data-testid="tweetPhoto"]`        | Photo attachment                                             |
| Video player     | `[data-testid="videoPlayer"]`       | Video player                                                 |
| Link card        | `[data-testid="card.wrapper"]`      | Link preview card                                            |
| Quote tweet      | `[data-testid="quoteTweet"]`        | Embedded quote tweet                                         |
| Timeline item    | `[data-testid="cellInnerDiv"]`      | Outer div for each Timeline entry                            |

### Interaction State

| Action   | Inactive selector          | Active selector                  | Confirmation menu                                                     |
| -------- | -------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| Like     | `[data-testid="like"]`     | `[data-testid="unlike"]`         | —                                                                     |
| Repost   | `[data-testid="retweet"]`  | `[data-testid="unretweet"]`      | `[data-testid="retweetConfirm"]` / `[data-testid="unretweetConfirm"]` |
| Bookmark | `[data-testid="bookmark"]` | `[data-testid="removeBookmark"]` | —                                                                     |

### Compose & Reply

| Element              | Selector                                          | Notes                                            |
| -------------------- | ------------------------------------------------- | ------------------------------------------------ |
| Text input           | `[data-testid="tweetTextarea_0"]`                 | Draft.js `contentEditable` div                   |
| Post button (inline) | `[data-testid="tweetButtonInline"]`               | Used in the inline compose area on the Home page |
| Post button (modal)  | `[data-testid="tweetButton"]`                     | Used in sidebar button, reply, and quote modals  |
| Modal container      | `[role="dialog"][aria-modal="true"]`              | Reply / quote / sidebar compose modal            |
| Modal text input     | `[role="dialog"] [data-testid="tweetTextarea_0"]` | Text input inside the modal                      |
| Modal post button    | `[role="dialog"] [data-testid="tweetButton"]`     | Submit button inside the modal                   |

### Search

**URL format**: `/search?q=<query>&src=typed_query&f=<tab>`

| Element      | Selector                                 |
| ------------ | ---------------------------------------- |
| Search input | `[data-testid="SearchBox_Search_Input"]` |

**Search tabs (URL `f` parameter)**:

| Tab    | URL param | Notes          |
| ------ | --------- | -------------- |
| Top    | `f=top`   | Top results    |
| Latest | `f=live`  | Latest results |
| People | `f=user`  | User results   |
| Media  | `f=media` | Media results  |
| Lists  | `f=list`  | List results   |

### Global Navigation

| Element          | Selector                                         |
| ---------------- | ------------------------------------------------ |
| Home             | `[data-testid="AppTabBar_Home_Link"]`            |
| Explore          | `[data-testid="AppTabBar_Explore_Link"]`         |
| Notifications    | `[data-testid="AppTabBar_Notifications_Link"]`   |
| Messages         | `[data-testid="AppTabBar_DirectMessage_Link"]`   |
| Profile          | `[data-testid="AppTabBar_Profile_Link"]`         |
| Post button      | `[data-testid="SideNav_NewTweet_Button"]`        |
| Account switcher | `[data-testid="SideNav_AccountSwitcher_Button"]` |
| Search input     | `[data-testid="SearchBox_Search_Input"]`         |

### Image URL Sizes

Image URL format: `https://pbs.twimg.com/media/<id>?format=jpg&name=<size>`

| Size param | Resolution    |
| ---------- | ------------- |
| `small`    | 680px         |
| `medium`   | 1200px        |
| `large`    | Original size |

## Notes

- **Draft.js text input**: All compose boxes (`tweetTextarea_0`) are `contentEditable` divs (Draft.js), not native inputs. `browser-cli fill`/`type` will not work; you must use `eval` to dispatch `InputEvent('beforeinput', { inputType: 'insertText' })`
- **`data-testid` stability**: Twitter/X makes heavy use of `data-testid` attributes, which are more stable than auto-generated hash CSS classes; prefer `data-testid` selectors
- **Interaction counts**: Use the button's `aria-label` for accurate counts (e.g. "7656 Likes. Like") rather than the visible abbreviated text ("7.6K"); when the count is 0 there is no numeric prefix — only "Reply", "Repost", "Like"
- **Bookmark count**: Only shown on tweet detail pages; in the Timeline the `aria-label` is just "Bookmark" with no count
- **Like/repost state**: `data-testid` toggles between `like`/`unlike` and `retweet`/`unretweet` based on state; the presence of `unlike` means the tweet is already liked
- **Social context**: `[data-testid="socialContext"]` shows "Pinned" for pinned tweets and "X reposted" for retweets
- **Media-only tweets**: Some tweets have no text and contain only images or video; `[data-testid="tweetText"]` will not exist — always use `?.innerText || ""` and distinguish via `hasPhoto`/`hasVideo`
- **Image URLs**: Tweet images are `<img>` elements inside `[data-testid="tweetPhoto"]`; `src` format is `https://pbs.twimg.com/media/<id>?format=jpg&name=small`
- **Link cards**: Link previews use `[data-testid="card.wrapper"]`, which contains `[data-testid="card.layoutLarge.media"]`
- **SPA navigation**: X is a full SPA; use `browser-cli navigate` for initial navigation and `browser-cli wait` to wait for dynamic content
- **Rate limiting**: Twitter may throttle requests; add `browser-cli --tab <tabId> wait 1000` between rapid successive operations
- **Follow button**: The follow button's `data-testid` includes the numeric user ID (e.g. `44196397-follow`); use `[data-testid$="-follow"]` to match any user
- **Virtual scrolling**: The Timeline uses virtual scrolling — older tweets are removed from the DOM as you scroll; always use the global collector pattern (recipe: `initScrollCollector` + `scrollAndCollect`) when collecting multiple tweets
- **Domain**: Both `twitter.com` and `x.com` work; `twitter.com` redirects to `x.com`
- **CSP and `eval`**: If `browser-cli eval` returns a CSP error, the extension may be missing the "User Scripts" permission. Ask the user to go to `chrome://extensions`, find the Browser-CLI extension, click "Details", enable "Allow user scripts", then reload the x.com page and retry
