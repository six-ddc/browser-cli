# youtube.com

> YouTube — the world's largest video sharing and streaming platform.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://www.youtube.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/youtube.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/youtube.mjs --call extractVideoInfo
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/youtube.mjs --call search -- --query "rust tutorial"
> ```
>
> When the agent runs, replace `scripts/youtube.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/youtube.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from youtube.mjs extractSearchResults, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll("ytd-video-renderer")].slice(0,3).map(el => ({ title: el.querySelector("#video-title")?.innerText })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("ytd-video-renderer").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login Detection

| State         | Selector                                         | Notes                            |
| ------------- | ------------------------------------------------ | -------------------------------- |
| Logged in     | `#avatar-btn, button[aria-label="Account menu"]` | Account menu button in top-right |
| Not logged in | `a[href*="accounts.google.com/ServiceLogin"]`    | Sign-in link present             |

### Homepage Feed

**URL pattern**: `https://www.youtube.com/`

| Element           | Selector                                           | Notes                                    |
| ----------------- | -------------------------------------------------- | ---------------------------------------- |
| Video card        | `ytd-rich-item-renderer`                           | Filter out `ytd-ad-slot-renderer`        |
| Video link        | `a[href*="/watch?v="]` inside card                 | Shorts use `/shorts/`                    |
| Title             | `.yt-core-attributed-string--white-space-pre-wrap` | First matching in card                   |
| Channel/views/age | `.yt-content-metadata-view-model__metadata-text`   | 3 spans: [0]=channel, [1]=views, [2]=age |
| Duration badge    | `.yt-badge-shape__text`                            | e.g. "8:21"                              |
| Filter chips      | `yt-chip-cloud-chip-renderer`                      | "All", "Music", "Gaming", etc.           |

### Search Results

**URL pattern**: `/results?search_query=<query>`

| Element            | Selector                              | Notes                              |
| ------------------ | ------------------------------------- | ---------------------------------- |
| Video result       | `ytd-video-renderer`                  | Main video results                 |
| Title link         | `#video-title`                        | `<a>` with href and title text     |
| Channel name       | `ytd-channel-name a`                  |                                    |
| Views & age        | `#metadata-line span`                 | [0]=views, [1]=age                 |
| Duration           | `badge-shape .yt-badge-shape__text`   |                                    |
| Filter chips       | `yt-chip-cloud-chip-renderer`         | "All", "Videos", "Playlists", etc. |
| Search filters btn | `button[aria-label="Search filters"]` | Opens advanced filter panel        |

### Watch Page (Video Detail)

**URL pattern**: `/watch?v=<videoId>`

| Element          | Selector                                                      | Notes                                       |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------- |
| Video title      | `yt-formatted-string.style-scope.ytd-watch-metadata`          |                                             |
| Channel name     | `#owner #channel-name a`                                      |                                             |
| Channel URL      | `#owner #channel-name a` → `.href`                            |                                             |
| Subscriber count | `#owner-sub-count`                                            |                                             |
| Likes count      | `like-button-view-model button` → `aria-label` (parse number) | e.g. "like this video along with 10,120..." |
| Description      | `#snippet-text`                                               | Collapsed snippet                           |
| Expand desc.     | `tp-yt-paper-button#expand`                                   | Click to expand full description            |
| Comment count    | `ytd-comments-header-renderer #count span`                    |                                             |
| Subscribe button | `#subscribe-button button`                                    |                                             |
| Share button     | `button[aria-label="Share"]`                                  |                                             |

### Video Player Controls

| Element           | Selector                 | Notes                           |
| ----------------- | ------------------------ | ------------------------------- |
| Player container  | `#movie_player`          | Has JS API methods              |
| Video element     | `video`                  | Standard HTML5 video API        |
| Play/pause button | `.ytp-play-button`       |                                 |
| CC/subtitles btn  | `.ytp-subtitles-button`  | `aria-pressed` = "true"/"false" |
| Settings button   | `.ytp-settings-button`   |                                 |
| Fullscreen button | `.ytp-fullscreen-button` |                                 |
| Volume button     | `.ytp-mute-button`       |                                 |
| Progress bar      | `.ytp-progress-bar`      |                                 |

**Player JS API** (via `#movie_player`):

| Method                              | Returns                                 | Notes                               |
| ----------------------------------- | --------------------------------------- | ----------------------------------- |
| `getPlayerState()`                  | `-1`=unstarted, `1`=playing, `2`=paused | State enum                          |
| `getVideoData()`                    | `{ video_id, title, author, isLive }`   |                                     |
| `getOption('captions','tracklist')` | `[{ languageCode, languageName }]`      | Available CC tracks                 |
| `setOption('captions','track',{})`  | —                                       | Set caption track by `languageCode` |

### Captions & Transcript

**API-based extraction** (preferred — uses network-captured POT token):

The `extractTranscript` recipe fetches captions via YouTube's timedtext API:

1. Gets caption track metadata from `ytInitialPlayerResponse`
2. Finds a network-captured timedtext URL with POT (Proof of Origin Token)
3. POT is per-video — reuses any captured POT URL and swaps the `lang` param
4. Fetches JSON3 format via in-page `fetch()` and parses segments
5. Falls back to triggering caption load if no POT is captured yet

**Caption tracks via `ytInitialPlayerResponse`**:

```js
// Get available caption tracks with download URLs
ytInitialPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
// Each track: { languageCode, name: { simpleText }, kind, baseUrl }
// kind: "asr" = auto-generated, "" = manual
// baseUrl requires POT token for successful fetch (since mid-2025)
// POT is captured automatically by the browser's network log
```

**DOM-based selectors** (fallback reference):

| Element             | Selector                                                                                         | Notes                                      |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Show transcript btn | `button[aria-label="Show transcript"]`                                                           | In description area; may need expand first |
| Transcript panel    | `ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]` |                                            |
| Transcript segment  | `ytd-transcript-segment-renderer`                                                                | Click to seek video to that time           |
| Segment timestamp   | `.segment-timestamp`                                                                             | e.g. "1:02"                                |
| Segment text        | `.segment-text`                                                                                  |                                            |
| Close transcript    | `button[aria-label="Close transcript"]`                                                          |                                            |

### Comments

| Element        | Selector                        | Notes                         |
| -------------- | ------------------------------- | ----------------------------- |
| Comment thread | `ytd-comment-thread-renderer`   | Scroll down to load           |
| Author         | `#author-text span`             | e.g. "@username"              |
| Comment text   | `#content-text`                 |                               |
| Likes          | `#vote-count-middle`            | "2.1K", "0"                   |
| Published time | `a[href*="lc="]`                | e.g. "10 months ago"          |
| Reply count    | `#more-replies button span`     | e.g. "107 replies"            |
| Sort by button | `#sort-menu tp-yt-paper-button` | Toggle "Top" / "Newest first" |

### Related Videos (Sidebar)

| Element       | Selector                                           | Notes                  |
| ------------- | -------------------------------------------------- | ---------------------- |
| Related item  | `#related yt-lockup-view-model`                    |                        |
| Title         | `.yt-core-attributed-string--white-space-pre-wrap` |                        |
| Channel/views | `.yt-content-metadata-view-model__metadata-text`   | [0]=channel, [1]=views |
| Video link    | `a[href*="/watch?v="]`                             |                        |

### Channel Page

**URL pattern**: `/@<handle>` or `/@<handle>/videos`

| Element          | Selector                                | Notes                              |
| ---------------- | --------------------------------------- | ---------------------------------- |
| Channel header   | `yt-page-header-renderer`               | Contains name, handle, stats       |
| Channel name     | `yt-page-header-renderer` → first line  | Parse from `innerText`             |
| Handle           | `yt-page-header-renderer` → second line | e.g. "@username"                   |
| Subscriber count | `yt-page-header-renderer` → fourth line | e.g. "2.19M subscribers"           |
| Tab navigation   | `yt-tab-shape`                          | Home, Videos, Shorts, Playlists... |
| Video grid items | `ytd-rich-item-renderer`                | Same card component as homepage    |

## Common Interactions

### Search

```bash
# Direct URL navigation (most reliable)
browser-cli --tab <tabId> navigate 'https://www.youtube.com/results?search_query=<query>'
browser-cli --tab <tabId> wait 'ytd-video-renderer' --timeout 8000

# Or via recipe
browser-cli --tab <tabId> script scripts/youtube.mjs --call search -- --query "topic"
```

### Play/Pause/Seek

```bash
# Via HTML5 video element
browser-cli --tab <tabId> eval 'document.querySelector("video").play()'
browser-cli --tab <tabId> eval 'document.querySelector("video").pause()'
browser-cli --tab <tabId> eval 'document.querySelector("video").currentTime = 120'
browser-cli --tab <tabId> eval 'document.querySelector("video").playbackRate = 1.5'

# Or via recipe
browser-cli --tab <tabId> script scripts/youtube.mjs --call playerControl -- --action pause
browser-cli --tab <tabId> script scripts/youtube.mjs --call playerControl -- --action seek --value 120
```

### Extract Transcript (Subtitles)

```bash
# Step 1: Check available caption tracks
browser-cli --tab <tabId> script scripts/youtube.mjs --call getCaptionTracks

# Step 2: Extract full transcript with timestamps (prefers manual over auto-generated)
browser-cli --tab <tabId> script scripts/youtube.mjs --call extractTranscript

# Step 2 (alt): Extract transcript as plain text
browser-cli --tab <tabId> script scripts/youtube.mjs --call extractTranscriptText

# Step 2 (alt): Extract in specific language (POT is per-video, any language works)
browser-cli --tab <tabId> script scripts/youtube.mjs --call extractTranscript -- --lang ja
```

> **How it works**: The recipe captures the POT (Proof of Origin Token) from YouTube's
> automatic timedtext network requests, then reuses that POT to fetch any language track
> via in-page `fetch()`. No UI interaction needed — pure API-based extraction.

### Enable/Disable Captions

```bash
# Toggle CC button
browser-cli --tab <tabId> click '.ytp-subtitles-button'

# Or enable specific language via player API
browser-cli --tab <tabId> eval 'document.querySelector("#movie_player").setOption("captions","track",{languageCode:"en"})'
```

## Notes

- **SPA navigation**: YouTube is a single-page app. Use `navigate` with full URLs rather than clicking internal links, to ensure clean page state for extraction.
- **No `data-testid`**: YouTube does not use `data-testid` attributes. Selectors rely on element IDs (`#video-title`, `#owner`, `#movie_player`) and custom element tag names (`ytd-*`, `yt-*`).
- **Lazy loading**: Comments and homepage videos load on scroll. Scroll down (`scroll down --amount 1000`) and wait before extracting comments.
- **Ads**: Homepage feed may contain ad cards (`ytd-ad-slot-renderer`). Always filter these out when extracting videos.
- **Transcript availability**: Not all videos have transcripts. Use `getCaptionTracks` to check first.
- **Transcript extraction**: Uses API-based approach (timedtext JSON3) instead of DOM scraping. Requires a captured POT token from network log — YouTube player auto-fetches captions on page load, so POT is usually already available.
- **Auto-generated vs manual captions**: `kind: "asr"` indicates auto-generated captions; empty `kind` means manual/uploaded captions. Manual captions are generally more accurate. `extractTranscript` prefers manual captions by default.
- **Player API**: `#movie_player` exposes `getOption()`, `setOption()`, `getPlayerState()`, `getVideoData()` for programmatic control.
- **Selector stability**: IDs like `#video-title`, `#owner`, `#movie_player`, `#search` are stable. Class-based selectors (`.yt-badge-shape__text`, `.yt-content-metadata-view-model__metadata-text`) may change — use `snapshot -ic` to re-discover.
- **Login**: Most content is accessible without login. Some features (comments posting, subscription) require login. YouTube uses Google account authentication.
