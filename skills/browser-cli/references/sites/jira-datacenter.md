# jira-datacenter

> Atlassian Jira Server / Data Center — self-hosted enterprise issue tracker and agile project management platform.
> This guide is **domain-independent**: it applies to any company's self-hosted Jira instance (e.g., `jira.corp.example.com`).
> Detection signal: `document.querySelector('meta[name="application-name"]')?.content === 'JIRA'`.
> Tested against Jira Data Center v10.7.4.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```bash
> browser-cli tab new 'https://your-jira.example.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands. Replace `your-jira.example.com` with the actual Jira hostname.

> **Recipe scripts**: Common read-only operations are encapsulated in `scripts/jira.mjs`. Read the source for available functions and their `@requires` preconditions.
>
> ```bash
> # Detect the current page type
> browser-cli --tab <tabId> script scripts/jira.mjs --call detectPage
>
> # Get current user info
> browser-cli --tab <tabId> script scripts/jira.mjs --call getCurrentUser
>
> # Get a specific issue (all fields including custom)
> browser-cli --tab <tabId> script scripts/jira.mjs --call getIssue -- --issueKey PROJECT-123
>
> # List all fields including company-specific custom fields
> browser-cli --tab <tabId> script scripts/jira.mjs --call discoverCustomFields
>
> # Search with JQL
> browser-cli --tab <tabId> script scripts/jira.mjs --call searchIssues -- --jql "project = YOUR-PROJECT AND status = Open"
>
> # My open issues in active sprint
> browser-cli --tab <tabId> script scripts/jira.mjs --call getMyOpenIssues
>
> # All issues in a sprint
> browser-cli --tab <tabId> script scripts/jira.mjs --call getSprintIssues -- --sprintId 42
>
> # Extract cards from the current board page
> browser-cli --tab <tabId> script scripts/jira.mjs --call getBoardIssues
> ```
>
> When the agent runs, replace `scripts/jira.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails, copy it from `scripts/jira.mjs`, modify, and re-run via `script -`:
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   return browser.evaluate({
>     expression: `JSON.stringify({
>       key: document.querySelector('#summary-val')?.innerText?.trim(),
>       status: document.querySelector('#status-val')?.innerText?.trim()
>     })`
>   });
> }
> EOF
> ```
>
> Debug selectors inline: `browser-cli --tab <tabId> eval 'document.querySelector("#summary-val")?.innerText'`

---

## Detection & Navigation

### Verify This Is a Jira Instance

```bash
browser-cli --tab <tabId> eval 'document.querySelector("meta[name=\"application-name\"]")?.content'
# Expected output: "JIRA"
```

### Page Type Detection

| Page          | URL Pattern                              | DOM Signal                                 |
| ------------- | ---------------------------------------- | ------------------------------------------ |
| Issue detail  | `/browse/{KEY}`                          | `#issue-content` present                   |
| Agile board   | `/secure/RapidBoard.jspa`                | `.ghx-board` or `[aria-label*="Swimlane"]` |
| Issue search  | `/issues/?jql=`                          | `#issuetable` present                      |
| Project board | `/secure/RapidBoard.jspa?rapidView=<id>` | `.ghx-board`                               |

Use `detectPage()` to identify the current page automatically:

```bash
browser-cli --tab <tabId> script scripts/jira.mjs --call detectPage
# Returns: { type: "issue"|"board"|"search"|"other", context: { key?, summary?, rapidView?, ... } }
```

### Direct Navigation

```bash
# Navigate to a specific issue
browser-cli --tab <tabId> navigate 'https://your-jira.example.com/browse/PROJECT-123'
browser-cli --tab <tabId> wait '#issue-content'

# Navigate to a board (replace 42 with rapidView ID)
browser-cli --tab <tabId> navigate 'https://your-jira.example.com/secure/RapidBoard.jspa?rapidView=42'
browser-cli --tab <tabId> wait '.ghx-board'

# Navigate to issue search with JQL
browser-cli --tab <tabId> navigate 'https://your-jira.example.com/issues/?jql=assignee%3DcurrentUser()'
browser-cli --tab <tabId> wait '#issuetable'
```

---

## Issue Detail Page (`/browse/{KEY}`)

**URL pattern**: `https://{host}/browse/{PROJECT}-{number}` — e.g. `/browse/PROJECT-123`

**Wait for**: `#issue-content`

### Key Selectors

| Element          | Selector                                   | Notes                                                             |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Issue container  | `#issue-content`                           | Top-level container; presence confirms page loaded                |
| Summary (title)  | `#summary-val`                             | Plain text                                                        |
| Status           | `[data-issue-status]` (attr)               | Most reliable; fallback: `#status-val .jira-issue-status-lozenge` |
| Assignee         | `#assignee-val .user-hover`                | Display name                                                      |
| Reporter         | `#reporter-val .user-hover`                | Display name                                                      |
| Priority         | `#priority-val img`                        | `alt` attribute contains priority name                            |
| Issue type       | `#type-val img`                            | `alt` attribute contains type name                                |
| Description      | `#description-val`                         | May contain rendered HTML                                         |
| Labels           | `#labels-val`                              | Space-separated labels                                            |
| Fix versions     | `#fixVersions-val`                         | Version names                                                     |
| Affects versions | `#affectsVersions-val`                     |                                                                   |
| Comments count   | `#issue_actions_container .action-details` |                                                                   |
| Custom fields    | `#customfield_{id}-val`                    | ID varies by instance — use `discoverCustomFields()`              |

### Extract Issue Data via DOM

```bash
browser-cli --tab <tabId> eval 'JSON.stringify({
  key: document.querySelector("#summary-val")?.innerText?.trim(),
  status: document.querySelector("#status-val .jira-issue-status-lozenge")?.innerText?.trim(),
  assignee: document.querySelector("#assignee-val .user-hover")?.innerText?.trim(),
  priority: document.querySelector("#priority-val img")?.alt,
  type: document.querySelector("#type-val img")?.alt
})'
```

> **Prefer REST API over DOM**: The `/rest/api/2/issue/{key}?fields=*all` endpoint is more reliable than DOM selectors and returns all fields (including custom) in a structured format. Use `getIssue()` from the recipe script.

### Custom Fields on Issue Page

Custom fields appear in the right sidebar with IDs like `#customfield_10016-val`. To discover all custom field IDs used in your instance:

```bash
browser-cli --tab <tabId> script scripts/jira.mjs --call discoverCustomFields
# Returns: { customFields: [{ id: "customfield_10016", name: "Story Points", schema: "number" }, ...] }
```

---

## Agile Board (`/secure/RapidBoard.jspa`)

**URL pattern**: `https://{host}/secure/RapidBoard.jspa?rapidView={id}`

**URL parameters**:

| Parameter     | Description                                      |
| ------------- | ------------------------------------------------ |
| `rapidView`   | Board ID (required)                              |
| `quickFilter` | Quick filter ID to pre-apply                     |
| `sprint`      | Sprint ID to view                                |
| `view`        | `planning` (backlog view) or omit for board view |

**Wait for**: `.ghx-board` (legacy) or `[role="group"][aria-label*="Swimlane"]` (newer ARIA)

### Board Structure

Jira DC boards have two parallel DOM representations:

**ARIA structure** (newer versions):

- Swimlanes: `[role="group"][aria-label*="Swimlane"]`
- Cards: `[role="group"][aria-label*="Issue"]` inside each swimlane

**Legacy `.ghx-*` selectors** (stable across all DC versions):

| Element                  | Selector                                       |
| ------------------------ | ---------------------------------------------- |
| Board container          | `.ghx-board`                                   |
| Column headers           | `#ghx-column-headers .ghx-column`              |
| Column title             | `.ghx-column-title` within column header       |
| Swimlane container       | `.ghx-swimlane`                                |
| Swimlane name            | `.ghx-swimlane-name`                           |
| Column cells in swimlane | `.ghx-columns > .ghx-column`                   |
| Issue card               | `.ghx-issue`                                   |
| Card key                 | `.ghx-key-link-issue-num`                      |
| Card summary             | `.ghx-summary`                                 |
| Assignee avatar          | `.ghx-avatar img` (alt = display name)         |
| Priority icon            | `.ghx-priority-icon img` (alt = priority name) |
| Issue type icon          | `.ghx-type img` (alt = type name)              |

### Extract Board Issues

Use `getBoardIssues()` from the recipe script (automatically tries ARIA then `.ghx-*` fallback):

```bash
# Navigate to board first, then extract
browser-cli --tab <tabId> navigate 'https://your-jira.example.com/secure/RapidBoard.jspa?rapidView=42'
browser-cli --tab <tabId> wait '.ghx-board'
browser-cli --tab <tabId> script scripts/jira.mjs --call getBoardIssues
# Returns: [{ swimlane, column, key, title, assignee, priority, type }, ...]
```

---

## REST API Reference

> **Why prefer REST API over DOM**: REST API responses are consistent across Jira DC versions, include all fields (custom and system), and are unaffected by rendering delays. DOM selectors may break across minor versions or with custom themes.

All API calls use the browser's session cookies. The recipe script's `jiraFetch()` helper handles authentication automatically via `browser.evaluate()` + synchronous XHR.

### Common Endpoints

| Endpoint                                      | Description                            | Recipe function                |
| --------------------------------------------- | -------------------------------------- | ------------------------------ |
| `GET /rest/api/2/myself`                      | Current logged-in user                 | `getCurrentUser()`             |
| `GET /rest/api/2/issue/{key}`                 | Full issue details                     | `getIssue()`                   |
| `GET /rest/api/2/issue/{key}?fields=*all`     | Issue with all fields including custom | `getIssue({ fields: "*all" })` |
| `GET /rest/api/2/search?jql={jql}`            | JQL search                             | `searchIssues()`               |
| `GET /rest/api/2/field`                       | All fields (system + custom)           | `discoverCustomFields()`       |
| `GET /rest/agile/1.0/board/{boardId}/sprint`  | List sprints for a board               | — (use eval)                   |
| `GET /rest/agile/1.0/sprint/{sprintId}/issue` | Issues in a sprint (Agile API)         | —                              |

### Custom Field Discovery

Custom fields vary by company configuration. Use `discoverCustomFields()` before building scripts that reference custom fields:

```bash
browser-cli --tab <tabId> script scripts/jira.mjs --call discoverCustomFields
```

Common custom fields (IDs may differ per instance):

| Typical Name | Typical ID          | Schema   |
| ------------ | ------------------- | -------- |
| Story Points | `customfield_10016` | `number` |
| Epic Link    | `customfield_10008` | `any`    |
| Sprint       | `customfield_10020` | `array`  |

Always verify IDs with `discoverCustomFields()` — hardcoded IDs will fail on other instances.

### JQL Quick Reference

```
# My open issues in current sprint
assignee = currentUser() AND sprint in openSprints()

# Issues updated in the last 7 days
updated >= -7d

# Issues in a specific project with a status
project = YOUR-PROJECT AND status in ("In Progress", "In Review")

# Epic children
"Epic Link" = YOUR-PROJECT-100

# Issues with no assignee
assignee is EMPTY

# Combine: high priority bugs in current sprint
project = YOUR-PROJECT AND issuetype = Bug AND priority in (High, Highest) AND sprint in openSprints()
```

---

## Notes

- **Domain independence**: This guide applies to any Jira Server/DC instance. Detect with `meta[name="application-name"]` before running scripts.
- **Custom field IDs are instance-specific**: `customfield_10016` (Story Points) on one instance may be `customfield_10200` on another. Always run `discoverCustomFields()` first.
- **QuickFilter IDs are board-scoped**: Quick filter IDs in URLs are unique to each board and cannot be reused across boards or instances.
- **`.ghx-*` selectors are legacy but stable**: These CSS classes exist across all Jira DC versions and are reliable for board scraping.
- **Jira Software vs. Jira Core**: Sprint-related JQL (`sprint in openSprints()`) and board endpoints require Jira Software. Pure Jira Core instances may not have these.
- **REST API versions**: `/rest/api/2/` is the stable REST API available on all Jira Server/DC versions. `/rest/agile/1.0/` (sprint/board endpoints) requires Jira Software.
- **Pagination**: `searchIssues` returns up to `maxResults` issues. For large result sets, increment `startAt` by `maxResults` until `startAt >= total`.
- **Authentication**: All recipe script functions run in the browser context and use session cookies. No API tokens needed. If calls return 401, navigate to the Jira instance and log in first.
- **`chrome.tabs.sendMessage` limitation**: Browser-CLI content scripts only work on `http://` and `https://` pages — Jira web UI qualifies, but `chrome://` extension pages do not.
