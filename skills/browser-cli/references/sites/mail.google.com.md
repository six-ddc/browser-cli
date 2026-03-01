# mail.google.com

> Gmail — Google's email service, a heavy SPA with strict CSP.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://mail.google.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/gmail.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/gmail.mjs --call extractInbox
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/gmail.mjs --call searchEmails -- --query "from:github"
> ```
>
> When the agent runs, replace `scripts/gmail.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/gmail.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from gmail.mjs extractInbox, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify(Array.from(document.querySelectorAll("tr:has(span[data-thread-id])")).slice(0,3).map(r => ({ subject: r.querySelector("span[data-thread-id]")?.textContent || "" })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("tr:has(span[data-thread-id])").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Stability Notes

Gmail class names (e.g., `.zA`, `.hP`, `.gD`) are obfuscated and change across versions. This guide prefers stable HTML attributes wherever possible.

| Attribute                       | Stability        | Purpose                                           |
| ------------------------------- | ---------------- | ------------------------------------------------- |
| `span[data-thread-id]`          | High             | Thread ID + subject text                          |
| `[data-legacy-thread-id]`       | High             | Legacy thread ID (compatible with Gmail API)      |
| `[data-thread-perm-id]`         | High             | Subject heading in detail view                    |
| `[data-legacy-message-id]`      | High             | Message container in detail view                  |
| `span[email]`                   | High             | Sender name and email address                     |
| `img[alt="Has attachment"]`     | High             | Attachment indicator icon                         |
| `span[title]` (date column)     | High             | Full date string                                  |
| `font-weight: 700`              | Medium           | Unread indicator (bold text)                      |
| `div[role='link'] > div > span` | High             | Snippet text (2nd child of link container)        |
| `span[role='gridcell'][title]`  | High             | Date in detail view                               |
| `div.a3s`                       | Low (obfuscated) | Email body in detail view (no stable alternative) |

### Email List

URL pattern: `https://mail.google.com/mail/u/0/#inbox`

| Element       | Selector                                            | Notes                                      |
| ------------- | --------------------------------------------------- | ------------------------------------------ |
| Email row     | `tr:has(span[data-thread-id])`                      | Stable, based on data attribute            |
| Thread ID     | `span[data-thread-id]` attr `data-legacy-thread-id` | Hex ID, compatible with Gmail API          |
| Subject       | `span[data-thread-id]` textContent                  | Same element also carries the subject text |
| Sender name   | `span[email]` attr `name`                           | Display name                               |
| Sender email  | `span[email]` attr `email`                          | Email address                              |
| Unread marker | `span[email]` font-weight `700`                     | Bold = unread                              |
| Date (full)   | `td span[title]` attr `title`                       | e.g., `Mon, Feb 23, 2026, 8:02 PM`         |
| Attachment    | `img[alt='Has attachment']`                         | Stable alt text                            |
| Snippet       | `td[role='gridcell'] div[role='link'] > div > span` | 2nd child of the subject link container    |

### Email Detail

URL pattern: `https://mail.google.com/mail/u/0/#inbox/<message-id>`

| Element           | Selector                       | Notes                                                              |
| ----------------- | ------------------------------ | ------------------------------------------------------------------ |
| Subject           | `h2[data-thread-perm-id]`      | Stable data attribute                                              |
| Message container | `[data-legacy-message-id]`     | One per message in the thread                                      |
| Sender            | `span[email]` inside container | `name` and `email` attributes                                      |
| Date              | `span[role='gridcell'][title]` | role + title attribute (stable)                                    |
| Body              | `div.a3s` inside container     | Obfuscated class name, no stable alternative, monitor for breakage |

### Action Buttons

| Action           | Element identifier                 |
| ---------------- | ---------------------------------- |
| Reply            | `link "Reply"` or `button "Reply"` |
| Forward          | `link "Forward"`                   |
| Archive          | `button "Archive"`                 |
| Delete           | `button "Delete"`                  |
| Mark as unread   | `button "Mark as unread"`          |
| Star / Unstar    | `checkbox "Starred"`               |
| Back to inbox    | `button "Back to Inbox"`           |
| Previous message | `button "Older"`                   |
| Next message     | `button "Newer"`                   |

### Navigation

Sidebar tab URLs:

| Tab     | URL hash   |
| ------- | ---------- |
| Inbox   | `#inbox`   |
| Starred | `#starred` |
| Snoozed | `#snoozed` |
| Sent    | `#sent`    |
| Drafts  | `#drafts`  |

Snapshot key elements:

| Element        | Snapshot identifier       |
| -------------- | ------------------------- |
| Search box     | `textbox "Search mail"`   |
| Compose button | `button "Compose"`        |
| Inbox link     | `link "Inbox <N> unread"` |
| Email row      | `row "<accessible-name>"` |
| Next page      | `button "Older"`          |
| Previous page  | `button "Newer"`          |
| Primary tab    | `tab "Primary"`           |
| Promotions tab | `tab "Promotions, ..."`   |
| Social tab     | `tab "Social, ..."`       |

### Search Operators

URL pattern: `https://mail.google.com/mail/u/0/#search/<encoded-query>`

Search result pages use the same selectors as the inbox (`tr:has(span[data-thread-id])` rows).

| Operator         | Example             | Description          |
| ---------------- | ------------------- | -------------------- |
| `from:`          | `from:cloudflare`   | Filter by sender     |
| `to:`            | `to:me`             | Sent to yourself     |
| `subject:`       | `subject:invoice`   | Subject contains     |
| `has:attachment` | `has:attachment`    | Has attachment       |
| `is:unread`      | `is:unread`         | Unread emails        |
| `is:starred`     | `is:starred`        | Starred emails       |
| `after:`         | `after:2026/01/01`  | After a date         |
| `before:`        | `before:2026/02/01` | Before a date        |
| `label:`         | `label:inbox`       | In a specific label  |
| `in:`            | `in:sent`           | In a specific folder |

## Notes

- **`eval` needs no extra flags**: Browser-CLI automatically handles Gmail's Trusted Types policy and CSP fallback; `eval` works on Gmail out of the box.
- **Prefer stable selectors**: This guide favors `data-*` attributes, `role`, `span[email]`, and `[title]`. Only `div.a3s` (email body in detail view) relies on an obfuscated class name and should be monitored for breakage.
- **Compose window is not in the snapshot**: Gmail's compose window does not appear in the accessibility tree snapshot.
- **Login required**: Gmail requires a signed-in Google account; unauthenticated sessions are redirected to accounts.google.com.
- **SPA routing**: Gmail uses hash routing (`#inbox`, `#sent`, `#search/query`).
- **Category tabs**: When category tabs (Primary / Promotions / Social) are enabled, the inbox only shows emails for the currently active tab.
- **Wait times**: Gmail is a heavy SPA; after navigation actions, allow `wait 2000`–`wait 3000`.
- **Unread count in title**: The title format is `"Inbox (<N>) - <email> - Gmail"` and can be parsed to quickly retrieve the unread count.
- **`markdown` command does not work**: CSS selectors in the Gmail DOM are incompatible; the `markdown` command will not function correctly.
