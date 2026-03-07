# discord.com

> Discord — 社区沟通与协作平台。本指南聚焦于已登录状态下的只读社区维护操作。

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://discord.com/channels/@me' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/discord.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/discord.mjs --call listServers
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/discord.mjs --call navigateServer -- --name "Open WebUI"
> ```
>
> When the agent runs, replace `scripts/discord.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/discord.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from discord.mjs extractMessages, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll('li[id^="chat-messages"]')].slice(0,3).map(el => ({ content: el.querySelector('[id^="message-content"]')?.innerText || "" })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("li[id^=\"chat-messages\"]").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login Detection

| State         | Selector                                         | Notes                             |
| ------------- | ------------------------------------------------ | --------------------------------- |
| Logged in     | `section[aria-label="User status and settings"]` | User panel at bottom of sidebar   |
| Logged in     | `[class*="nameTag"]`                             | Contains username + discriminator |
| Not logged in | page title contains "Login" or URL is `/login`   | Redirected to login page          |

### Server Sidebar (Global)

| Element         | Selector                                              | Notes                               |
| --------------- | ----------------------------------------------------- | ----------------------------------- |
| Servers nav     | `nav[aria-label="Servers sidebar"]`                   | Left-most sidebar with server icons |
| Server item     | `nav[aria-label="Servers sidebar"] [role="treeitem"]` | Each server icon                    |
| Server name     | `[role="treeitem"] span[class*="hiddenVisually"]`     | Hidden text inside each server icon |
| Server icon img | `[role="treeitem"] img[class*="icon"]`                | Server avatar image                 |
| DM button       | First `[role="treeitem"]` (name = "Direct Messages")  | Discord logo icon at top            |

### Channel Sidebar (Per Server)

| Element            | Selector                                                  | Notes                                         |
| ------------------ | --------------------------------------------------------- | --------------------------------------------- |
| Server nav         | `nav[aria-label*="server"]`                               | `aria-label` = `"ServerName (server)"`        |
| Server name button | `button[aria-label*="server actions"]`                    | Dropdown with server actions                  |
| Channel list       | `ul[aria-label="Channels"]`                               | Contains all channels and categories          |
| Channel link       | `ul[aria-label="Channels"] a`                             | `aria-label` = `"channelName (text channel)"` |
| Category button    | `ul[aria-label="Channels"] button` (label has "category") | Collapsible category header                   |
| Show All button    | `ul[aria-label="Channels"] button` (text = "Show All")    | Expands collapsed channel categories          |
| Boost goal         | `button[aria-label*="Boost"]`                             | Server boost progress                         |

**Channel `aria-label` patterns**:

- `"channelName (text channel)"` — text channel
- `"unread, channelName (text channel)"` — text channel with unread
- `"channelName (announcement channel)"` — announcement channel
- `"channelName (voice channel), N users"` — voice channel

**Channel URL pattern**: `https://discord.com/channels/<serverId>/<channelId>`

### Channel Header

| Element               | Selector                                                              | Notes                              |
| --------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| Channel header        | `section[aria-label="Channel header"]`                                | Not a standard `<section>` tag     |
| Channel topic         | `[class*="topic"]`                                                    | Channel description text           |
| Threads button        | `[aria-label="Threads"]`                                              | `div[role="button"]`, not `button` |
| Pinned Messages       | `[aria-label="Pinned Messages"]`                                      | `div[role="button"]`               |
| Show/Hide Members     | `[aria-label="Show Member List"]` / `[aria-label="Hide Member List"]` | Toggles member sidebar             |
| Notification Settings | `[aria-label="Notification Settings"]`                                | Per-channel notification config    |
| Search                | `[role="combobox"]`                                                   | Draft.js input (see Notes)         |

### Messages

**Container**: `main` with `aria-label` = `"channelName (channel)"`
**Message list**: `ol[aria-label^="Messages in"]`

| Element           | Selector                                        | Notes                                                 |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------- |
| Message item      | `li[id^="chat-messages"]`                       | ID format: `chat-messages-<channelId>-<msgId>`        |
| Message content   | `[id^="message-content"]`                       | Text body of the message                              |
| Header (grouped)  | `h3[class*="header"]`                           | Only on first message in a group                      |
| Username          | `span[class*="username_"][class*="clickable"]`  | Inside the header                                     |
| Bot tag           | `[class*="botTag"]`                             | "BOT" or "APP" badge                                  |
| Timestamp         | `time`                                          | `datetime` attribute is ISO format                    |
| Reply indicator   | `[class*="repliedMessage"]`                     | Shows replied-to message preview                      |
| Reply username    | `[class*="repliedMessage"] [class*="username"]` | Who was replied to                                    |
| Embeds            | `article[class*="embed"]`                       | Link previews, rich embeds                            |
| Image attachments | `[class*="imageWrapper"]`                       | Uploaded images                                       |
| Reactions group   | `[class*="reactions"]`                          | Container for all reactions                           |
| Single reaction   | `[class*="reactionInner"][role="button"]`       | `aria-label` = `"emoji, N reactions, press to react"` |
| Reaction count    | `[class*="reactionCount"]`                      | Numeric count inside reaction                         |

**Message grouping**: Discord groups consecutive messages from the same user. Only the first message has `h3[class*="header"]` with username and timestamp. Subsequent messages inherit the username.

### Pinned Messages Popout

| Element          | Selector                         | Notes                  |
| ---------------- | -------------------------------- | ---------------------- |
| Popout container | `[class*="messagesPopout"]`      | Overlay panel          |
| Message wrapper  | `[class*="messageGroupWrapper"]` | Each pinned message    |
| Username         | `[class*="username"]`            | Inside message wrapper |
| Content          | `[class*="messageContent"]`      | Message text           |
| Timestamp        | `time`                           | ISO datetime           |

### Threads Panel

| Element        | Selector                       | Notes                             |
| -------------- | ------------------------------ | --------------------------------- |
| Thread item    | `[class*="container__6764b"]`  | Each thread entry                 |
| Section header | `[class*="sectionHeader"]`     | "ACTIVE THREADS", "OLDER THREADS" |
| Thread search  | `input[placeholder*="Thread"]` | Filter threads by name            |

### Member List

| Element           | Selector                                                 | Notes                              |
| ----------------- | -------------------------------------------------------- | ---------------------------------- |
| Members wrap      | `[class*="membersWrap"]`                                 | Outer container (check visibility) |
| Members scroller  | `[class*="members_"][class*="thin_"] [class*="content"]` | Scrollable member list             |
| Role group header | `[class*="membersGroupName"]`                            | Role name text (e.g. "maintainer") |
| Member item       | `[role="listitem"]`                                      | Inside members scroller            |
| Member username   | `[class*="username"]`                                    | May contain newlines with clan tag |
| Owner badge       | `[class*="ownerIcon"]`                                   | Server owner indicator             |
| Activity status   | `[class*="activity"]`                                    | "Playing ...", etc.                |

### Search Results

| Element          | Selector                              | Notes                        |
| ---------------- | ------------------------------------- | ---------------------------- |
| Results wrapper  | `[class*="searchResultsWrap"]`        | Contains total + result list |
| Result item      | `[class*="searchResult__"]`           | Individual search result     |
| Result username  | `[class*="username"]`                 | Inside result item           |
| Result content   | `[class*="messageContent"]`           | Message text in result       |
| Result timestamp | `time`                                | ISO datetime                 |
| Filters button   | `.button` with text "Filters"         | Opens filter options         |
| Sort button      | `[aria-label="Sort"]`                 | Sort options                 |
| Pagination       | `.pageButton` with text "Back"/"Next" | Navigate result pages        |

### Server Dropdown Menu

Opened by clicking the server name button at the top of the channel sidebar.

| Element                 | Menu Item ID                            |
| ----------------------- | --------------------------------------- |
| Server Boost            | `guild-header-popout-premium-subscribe` |
| Invite to Server        | `guild-header-popout-invite-people`     |
| Notification Settings   | `guild-header-popout-notifications`     |
| Privacy Settings        | `guild-header-popout-privacy`           |
| Edit Per-server Profile | `guild-header-popout-change-nickname`   |
| Leave Server            | `guild-header-popout-leave`             |

### User Panel (Bottom Sidebar)

| Element          | Selector                                         | Notes                     |
| ---------------- | ------------------------------------------------ | ------------------------- |
| User section     | `section[aria-label="User status and settings"]` | Bottom of channel sidebar |
| Username display | `[class*="nameTag"]`                             | Username + discriminator  |
| Mute toggle      | `switch[aria-label="Mute"]`                      | Microphone mute           |
| Deafen toggle    | `switch[aria-label="Deafen"]`                    | Speaker mute              |
| User Settings    | `button[aria-label="User Settings"]`             | Opens settings            |

## Common Interactions

### Navigate to a Server

```bash
# Via recipe (recommended)
browser-cli --tab <tabId> script scripts/discord.mjs --call navigateServer -- --name "Server Name"

# Via URL (if you know the server + channel IDs)
browser-cli --tab <tabId> navigate 'https://discord.com/channels/<serverId>/<channelId>'
browser-cli --tab <tabId> wait 'ol[aria-label^="Messages in"]' --timeout 5000
```

### Read Channel Messages

```bash
# Extract all visible messages
browser-cli --tab <tabId> script scripts/discord.mjs --call extractMessages

# Load older messages by scrolling up
browser-cli --tab <tabId> script scripts/discord.mjs --call loadOlderMessages -- --amount 5000
browser-cli --tab <tabId> script scripts/discord.mjs --call extractMessages
```

### Search Messages

```bash
# Search in current server (uses CDP key dispatch for Draft.js input)
browser-cli --tab <tabId> script scripts/discord.mjs --call searchMessages -- --query "search term"

# Close search results
browser-cli --tab <tabId> press Escape
```

### View Members by Role

```bash
browser-cli --tab <tabId> script scripts/discord.mjs --call extractMembers
```

## Notes

- **Read-only scope**: This guide is designed for read-only community maintenance (viewing messages, members, channels, threads, pins). No write operations (sending messages, reactions, etc.) are included.
- **Login required**: All operations require the user to be logged in. Discord redirects to `/login` for unauthenticated users.
- **SPA navigation**: Discord is a full SPA (React). Use `browser-cli navigate` for cross-server navigation and `browser-cli wait` for content loading.
- **Draft.js search input**: The search combobox is a Draft.js `contentEditable` div (`role="combobox"`). Standard `fill`/`type` won't work. Use CDP key dispatch (`press --debugger`) for character-by-character input.
- **Channel header buttons**: Buttons like "Threads", "Pinned Messages", "Show Member List" are `div[role="button"]`, not `<button>` elements. Use `[aria-label="..."]` selectors (without `button` tag prefix).
- **Message grouping**: Consecutive messages from the same user share a single header. Only the first message in a group has `h3[class*="header"]` with username/timestamp. When extracting, track the last-seen username for header-less messages.
- **Auto-generated CSS classes**: Discord uses hashed class names (e.g., `message__5126c`, `username_c19a55`). These change between deploys. Prefer `aria-label`, `role`, `id` prefix, and partial class matches (`[class*="username"]`) over exact class names.
- **Virtual scrolling**: Message lists use virtual scrolling. Older messages are removed from the DOM as you scroll down. If collecting a large history, use scroll-and-extract loops.
- **Member list toggle**: The member list button label toggles between "Show Member List" and "Hide Member List" depending on current state. Check `[class*="membersWrap"]` visibility before toggling.
- **Thread panel class stability**: Thread item class `container__6764b` contains a hash suffix that may change between deployments. If extraction fails, re-discover via: `browser-cli eval 'document.querySelector("[class*=list_c441f0] [class*=content]")?.children[2]?.className'`
- **Rate limiting**: Discord may throttle rapid navigation. Add `wait 1000` between successive operations.
