# mail.google.com

> Gmail — Google's email service. A heavy SPA with strict CSP.

## CSP and eval

Gmail enforces strict CSP that blocks `eval()` in the MAIN world. Use
`eval --user-script` (`-u`) to bypass CSP via the `chrome.userScripts` API.
Requires Developer Mode (or "Allow User Scripts" on Chrome 138+) enabled
in `chrome://extensions`.

If `--user-script` is not available, use these alternatives:

- **`snapshot -ic`** — interactive elements with ARIA names
- **`snapshot -c`** — full tree including non-interactive elements
- **`find`** — locate and interact with elements by role, text, or label
- **`get title`** / **`get url`** — page-level metadata (always works)
- **`markdown`** — does NOT work on Gmail (invalid CSS selectors in Gmail's DOM)

## Selector Strategy

Gmail's class names (`.zA`, `.hP`, `.gD`) are **obfuscated** and change across
deployments. This guide uses **stable HTML attributes** wherever possible:

| Attribute                       | Stability        | Use                                          |
| ------------------------------- | ---------------- | -------------------------------------------- |
| `span[data-thread-id]`          | High             | Thread ID + subject text                     |
| `[data-legacy-thread-id]`       | High             | Legacy thread ID (compatible with Gmail API) |
| `[data-thread-perm-id]`         | High             | Subject heading in detail view               |
| `[data-legacy-message-id]`      | High             | Message container in detail view             |
| `span[email]`                   | High             | Sender name and email                        |
| `img[alt="Has attachment"]`     | High             | Attachment indicator                         |
| `span[title]` (in date column)  | High             | Full date string                             |
| `font-weight: 700`              | Medium           | Unread indicator (bold text)                 |
| `div[role='link'] > div > span` | High             | Snippet text (2nd child of link div)         |
| `span[role='gridcell'][title]`  | High             | Date in detail view                          |
| `div.a3s`                       | Low (obfuscated) | Email body in detail view (no stable alt)    |

## Inbox (Email List)

**URL pattern**: `https://mail.google.com/mail/u/0/#inbox`

**Navigation**:

```bash
browser-cli navigate 'https://mail.google.com/mail/u/0/#inbox'
browser-cli wait 3000
```

**Wait signal**: The page title contains "Inbox" and an unread count:

```bash
browser-cli get title
# → "Inbox (48) - user@gmail.com - Gmail"
```

**Extract email list** (`eval -u`):

```bash
browser-cli eval -u --stdin <<'EOF'
JSON.stringify(Array.from(document.querySelectorAll("tr:has(span[data-thread-id])")).map(r => ({
  threadId: r.querySelector("span[data-thread-id]")?.getAttribute("data-legacy-thread-id") || "",
  unread: getComputedStyle(r.querySelector("span[email]")).fontWeight === "700",
  sender: r.querySelector("span[email]")?.getAttribute("name") || "",
  senderEmail: r.querySelector("span[email]")?.getAttribute("email") || "",
  subject: r.querySelector("span[data-thread-id]")?.textContent || "",
  snippet: r.querySelector("td[role='gridcell'] div[role='link'] > div > span")?.textContent?.replace(/^\s*-\s*/, "").trim() || "",
  date: r.querySelector("td span[title]")?.getAttribute("title") || "",
  hasAttachment: !!r.querySelector("img[alt='Has attachment']")
})))
EOF
```

**Key selectors** (verified from live DOM):

| Element      | Selector                                            | Notes                               |
| ------------ | --------------------------------------------------- | ----------------------------------- |
| Email row    | `tr:has(span[data-thread-id])`                      | Stable — uses data attribute        |
| Thread ID    | `span[data-thread-id]` attr `data-legacy-thread-id` | Hex ID, compatible with Gmail API   |
| Subject      | `span[data-thread-id]` textContent                  | Same element carries subject text   |
| Sender name  | `span[email]` attr `name`                           | Display name                        |
| Sender email | `span[email]` attr `email`                          | Email address                       |
| Unread       | `span[email]` font-weight `700`                     | Bold = unread                       |
| Date (full)  | `td span[title]` attr `title`                       | e.g. "Mon, Feb 23, 2026, 8:02 PM"   |
| Attachment   | `img[alt='Has attachment']`                         | Stable alt text                     |
| Snippet      | `td[role='gridcell'] div[role='link'] > div > span` | 2nd child of subject link container |

**Extract email list** (snapshot, always works):

```bash
browser-cli snapshot -ic | grep -E '^\s+row "'
```

Row accessible name format:

```
row "unread, <sender>, <subject>, <time>, <snippet>..."    ← unread
row "<sender>, <subject>, <time>, <snippet>..."             ← read
row "starred, <sender>, <subject>, <time>, <snippet>..."    ← starred
```

**Open an email**:

```bash
# Via snapshot ref
browser-cli click '@e41'   # use the actual @ref from snapshot

# Via find
browser-cli find text '<subject text>' click
```

**Category tabs** (Primary, Promotions, Social):

```bash
browser-cli snapshot -ic | grep 'tab "'
# → tab "Primary" [@e36]
# → tab "Promotions, 49 new messages," [@e37]
# → tab "Social, 13 new messages," [@e38]

browser-cli click '@e37'
browser-cli wait 2000
```

**Pagination**:

```bash
browser-cli find role 'button' --name 'Older' click
browser-cli wait 3000

browser-cli find role 'button' --name 'Newer' click
browser-cli wait 3000
```

**Snapshot key elements**:

| Element           | Snapshot identifier       |
| ----------------- | ------------------------- |
| Search box        | `textbox "Search mail"`   |
| Compose button    | `button "Compose"`        |
| Inbox link        | `link "Inbox <N> unread"` |
| Email row         | `row "<accessible-name>"` |
| Older (next page) | `button "Older"`          |
| Newer (prev page) | `button "Newer"`          |
| Primary tab       | `tab "Primary"`           |
| Promotions tab    | `tab "Promotions, ..."`   |
| Social tab        | `tab "Social, ..."`       |

## Email Detail Page

**URL pattern**: `https://mail.google.com/mail/u/0/#inbox/<message-id>`

**Navigation**:

```bash
browser-cli find text '<subject text>' click
browser-cli wait 2000
```

**Extract email metadata** (`eval -u`):

```bash
browser-cli eval -u --stdin <<'EOF'
JSON.stringify({
  subject: document.querySelector("h2[data-thread-perm-id]")?.textContent || "",
  senderName: document.querySelector("[data-legacy-message-id] span[email]")?.getAttribute("name") || "",
  senderEmail: document.querySelector("[data-legacy-message-id] span[email]")?.getAttribute("email") || "",
  date: document.querySelector("[data-legacy-message-id] span[role='gridcell'][title]")?.getAttribute("title") || "",
  messageId: document.querySelector("[data-legacy-message-id]")?.getAttribute("data-legacy-message-id") || ""
})
EOF
```

**Extract email body HTML** (`eval -u`):

```bash
browser-cli eval -u --stdin <<'EOF'
document.querySelector("[data-legacy-message-id] div.a3s")?.innerHTML
EOF
```

For threads with multiple messages:

```bash
browser-cli eval -u --stdin <<'EOF'
JSON.stringify(Array.from(document.querySelectorAll("[data-legacy-message-id]")).map(msg => ({
  messageId: msg.getAttribute("data-legacy-message-id") || "",
  sender: msg.querySelector("span[email]")?.getAttribute("name") || "",
  senderEmail: msg.querySelector("span[email]")?.getAttribute("email") || "",
  html: msg.querySelector("div.a3s")?.innerHTML || ""
})))
EOF
```

**Key selectors** (verified from live DOM):

| Element           | Selector                       | Notes                           |
| ----------------- | ------------------------------ | ------------------------------- |
| Subject           | `h2[data-thread-perm-id]`      | Stable data attribute           |
| Message container | `[data-legacy-message-id]`     | One per message in thread       |
| Sender            | `span[email]` inside container | `name` and `email` attrs        |
| Date              | `span[role='gridcell'][title]` | role + title attrs (stable)     |
| Body              | `div.a3s` inside container     | Obfuscated class, no stable alt |

**Email actions** (via snapshot/find):

| Action         | Element                            |
| -------------- | ---------------------------------- |
| Reply          | `link "Reply"` or `button "Reply"` |
| Forward        | `link "Forward"`                   |
| Archive        | `button "Archive"`                 |
| Delete         | `button "Delete"`                  |
| Mark as unread | `button "Mark as unread"`          |
| Star/Unstar    | `checkbox "Starred"`               |
| Back to inbox  | `button "Back to Inbox"`           |
| Older email    | `button "Older"`                   |
| Newer email    | `button "Newer"`                   |

**Return to inbox**:

```bash
browser-cli find role 'button' --name 'Back to Inbox' click
browser-cli wait 2000
```

## Search

**Navigation**:

```bash
# Option 1: Fill the search box
browser-cli find role 'textbox' --name 'Search mail' click
browser-cli find role 'textbox' --name 'Search mail' fill '<query>'
browser-cli press Enter
browser-cli wait 3000

# Option 2: Navigate directly
browser-cli navigate 'https://mail.google.com/mail/u/0/#search/<query>'
browser-cli wait 3000
```

**URL pattern**: `https://mail.google.com/mail/u/0/#search/<encoded-query>`

**Extract results**: Same selectors as Inbox (`tr:has(span[data-thread-id])` rows).

**Common Gmail search operators**:

| Operator         | Example             | Description        |
| ---------------- | ------------------- | ------------------ |
| `from:`          | `from:cloudflare`   | Emails from sender |
| `to:`            | `to:me`             | Emails sent to you |
| `subject:`       | `subject:invoice`   | Subject contains   |
| `has:attachment` | `has:attachment`    | Has attachments    |
| `is:unread`      | `is:unread`         | Unread emails      |
| `is:starred`     | `is:starred`        | Starred emails     |
| `after:`         | `after:2026/01/01`  | After date         |
| `before:`        | `before:2026/02/01` | Before date        |
| `label:`         | `label:inbox`       | In label/folder    |
| `in:`            | `in:sent`           | In folder          |

## Sidebar Navigation

| Label   | URL hash   |
| ------- | ---------- |
| Inbox   | `#inbox`   |
| Starred | `#starred` |
| Snoozed | `#snoozed` |
| Sent    | `#sent`    |
| Drafts  | `#drafts`  |

```bash
browser-cli navigate 'https://mail.google.com/mail/u/0/#sent'
browser-cli wait 3000
```

## Notes

- **`eval` requires `-u` flag**: Gmail's strict CSP blocks `eval` in MAIN world. Use `eval -u` (userScripts API, requires Developer Mode) to bypass CSP.
- **Stable selectors preferred**: This guide uses `data-*` attributes, `role`, `span[email]`, and `[title]` wherever possible. Only `div.a3s` (email body in detail view) relies on an obfuscated class name — monitor for breakage.
- **Compose dialog not in snapshot**: The Gmail compose window does not appear in the accessibility tree snapshot.
- **Authentication required**: Gmail requires a logged-in Google account. Redirects to accounts.google.com if not logged in.
- **SPA navigation**: Gmail uses hash-based routing (`#inbox`, `#sent`, `#search/query`).
- **Tab categories**: When tabs are enabled (Primary/Promotions/Social), the inbox shows only the active tab's emails.
- **Wait times**: Gmail is a heavy SPA. Use `wait 2000`-`wait 3000` after navigation actions.
- **Unread count in title**: Title format `"Inbox (<N>) - <email> - Gmail"` — parse for quick unread checks.
