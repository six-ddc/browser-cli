# linkedin.com

> LinkedIn — the world's largest professional networking platform for job searching, networking, industry news, and recruiting.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://www.linkedin.com/feed/' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/linkedin.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/linkedin.mjs --call detectLogin
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/linkedin.mjs --call searchPeople -- --keywords "software engineer"
> ```
>
> When the agent runs, replace `scripts/linkedin.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/linkedin.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll(".feed-shared-update-v2[data-urn*='activity']")].slice(0,3).map(el => ({ text: el.innerText?.substring(0,100) })))`
>   });
> }
> EOF
> ```

## Login Detection

| State      | Selector                   | Notes          |
| ---------- | -------------------------- | -------------- |
| Logged in  | `.search-global-typeahead` | Top search bar |
| Logged in  | `.global-nav__me`          | Nav "Me" menu  |
| Logged out | `a[href*="/login"]`        | Login button   |
| Logged out | `a[href*="/signup"]`       | Sign up button |

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const loggedIn = !!document.querySelector('.global-nav__me') && !!document.querySelector('.search-global-typeahead');
  const loginBtn = !!document.querySelector('a[href*="/login"]');
  return { loggedIn, loginBtn };
})())
EOF
```

## Feed

**URL pattern**: `https://www.linkedin.com/feed/`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/feed/'`

**Wait**: `browser-cli wait '.feed-shared-update-v2' --timeout 5000`

### Post Containers

The LinkedIn feed contains multiple card types, distinguished by the `data-urn` attribute:

| URN Type           | Description                      |
| ------------------ | -------------------------------- |
| `urn:li:activity`  | User/company-published posts     |
| `urn:li:ugcPost`   | User-generated content           |
| `urn:li:aggregate` | Follow recommendation card group |
| `urn:li:company`   | Single company recommendation    |

**Extract real posts (excluding ads and recommendations):**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.feed-shared-update-v2[data-urn*="activity"], .feed-shared-update-v2[data-urn*="ugcPost"]')].map((el, i) => ({
  index: i + 1,
  urn: el.getAttribute('data-urn'),
  author: el.querySelector('.update-components-actor__title span[dir="ltr"] > span[aria-hidden="true"]')?.innerText?.trim() || '',
  authorDesc: el.querySelector('.update-components-actor__description span[aria-hidden="true"]')?.innerText?.trim() || '',
  time: el.querySelector('.update-components-actor__sub-description span[aria-hidden="true"]')?.innerText?.trim() || '',
  body: el.querySelector('.feed-shared-inline-show-more-text')?.innerText?.trim()?.substring(0, 300) || '',
  reactions: el.querySelector('.social-details-social-counts__reactions-count')?.innerText?.trim() || '0',
  comments: el.querySelector('.social-details-social-counts__comments')?.innerText?.trim() || '',
  hasImage: !!el.querySelector('.update-components-image'),
  hasVideo: !!el.querySelector('.update-components-video, video'),
  hasArticle: !!el.querySelector('.update-components-article'),
})))
EOF
```

### Post Selectors

| Element        | Selector                                                                     | Notes                      |
| -------------- | ---------------------------------------------------------------------------- | -------------------------- |
| Post card      | `.feed-shared-update-v2[data-urn]`                                           | Single feed update card    |
| Author name    | `.update-components-actor__title span[dir="ltr"] > span[aria-hidden="true"]` | Poster's display name      |
| Author desc    | `.update-components-actor__description span[aria-hidden="true"]`             | Follower count / job title |
| Post time      | `.update-components-actor__sub-description span[aria-hidden="true"]`         | Timestamp or "Promoted"    |
| Post body      | `.feed-shared-inline-show-more-text`                                         | Post text content          |
| Reaction count | `.social-details-social-counts__reactions-count`                             | Total likes/reactions      |
| Comment count  | `.social-details-social-counts__comments`                                    | Number of comments         |
| Author link    | `.update-components-actor__container-link`                                   | Link to author's profile   |
| Image media    | `.update-components-image`                                                   | Image attachment           |
| Video media    | `.update-components-video`                                                   | Video attachment           |
| Article media  | `.update-components-article`                                                 | Shared article             |

### Action Buttons

| Action  | Selector / Attribute                                                                                              | Notes                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Like    | `button[aria-label*="React"]` or `button[aria-label*="Reaction button"]` (EN) / `button[aria-label*="回应"]` (ZH) | `aria-pressed="true"` = already liked |
| Comment | `.comment-button`                                                                                                 | Opens comment section                 |
| Repost  | `.artdeco-dropdown__trigger` (with "Repost" text)                                                                 | Repost dropdown menu                  |
| Send    | `button[aria-label="Send via private message"]` (EN) / `button[aria-label="通过私信发送"]` (ZH)                   | Send via DM                           |

## Profile

**URL pattern**: `https://www.linkedin.com/in/<username>/` or `https://www.linkedin.com/in/me/`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/in/me/'`

**Wait**: `browser-cli wait 'h1' --timeout 5000`

**Extract profile info:**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const name = document.querySelector('h1')?.innerText?.trim() || '';
  const headline = document.querySelector('.text-body-medium')?.innerText?.trim() || '';
  const location = document.querySelector('.text-body-small.inline')?.innerText?.trim() || '';
  return { name, headline, location, url: window.location.href };
})())
EOF
```

**Extract work experience:**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const section = document.querySelector('#experience')?.closest('section');
  if (!section) return [];
  return [...section.querySelectorAll('li.artdeco-list__item')].map((el, i) => ({
    index: i + 1,
    title: el.querySelector('.t-bold span[aria-hidden="true"]')?.innerText?.trim() || '',
    company: el.querySelector('.t-normal span[aria-hidden="true"]')?.innerText?.trim() || '',
    duration: el.querySelector('.t-black--light span[aria-hidden="true"]')?.innerText?.trim() || '',
  }));
})())
EOF
```

### Profile Selectors

| Element         | Selector                                            | Notes                     |
| --------------- | --------------------------------------------------- | ------------------------- |
| Name            | `h1`                                                | Page's unique h1          |
| Headline        | `.text-body-medium`                                 | Job title / tagline       |
| Location        | `.text-body-small.inline`                           | Geographic location       |
| Experience      | `#experience`                                       | Experience section anchor |
| Education       | `#education`                                        | Education section anchor  |
| Skills          | `#skills`                                           | Skills section anchor     |
| Experience item | `li.artdeco-list__item` (within experience section) | Single experience entry   |

## Search

### All Results

**URL pattern**: `https://www.linkedin.com/search/results/all/?keywords=<query>`

### People Search

**URL pattern**: `https://www.linkedin.com/search/results/people/?keywords=<query>`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/search/results/people/?keywords=software%20engineer'`

**Wait**: `browser-cli wait '[role="main"]' --timeout 5000`

**Extract people results:**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const list = document.querySelector('[role="list"]');
  if (!list) return [];
  return [...list.children]
    .filter(el => el.innerText?.trim().length > 5)
    .map((el, i) => {
      const lines = el.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      const img = el.querySelector('img');
      return {
        index: i + 1,
        name: lines[0] || '',
        title: lines[1] || '',
        location: lines[2] || '',
        extra: lines.slice(3).join(' | '),
        avatar: img?.src || '',
      };
    });
})())
EOF
```

### Search URL Patterns

| Type      | URL                                             | Description    |
| --------- | ----------------------------------------------- | -------------- |
| All       | `/search/results/all/?keywords=<query>`         | All types      |
| People    | `/search/results/people/?keywords=<query>`      | People search  |
| Jobs      | `/jobs/search/?keywords=<query>&location=<loc>` | Job search     |
| Companies | `/search/results/companies/?keywords=<query>`   | Company search |
| Posts     | `/search/results/content/?keywords=<query>`     | Post search    |

## Job Search

**URL pattern**: `https://www.linkedin.com/jobs/search/?keywords=<query>&location=<location>`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/jobs/search/?keywords=software%20engineer&location=San%20Francisco'`

**Wait**: `browser-cli wait '.job-card-container' --timeout 5000`

**Extract job listings:**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.job-card-container')].map((el, i) => ({
  index: i + 1,
  title: el.querySelector('a[class*="job-card"]')?.innerText?.trim()?.split('\n')[0] || '',
  company: el.querySelector('.artdeco-entity-lockup__subtitle')?.innerText?.trim() || '',
  location: el.querySelector('.artdeco-entity-lockup__caption')?.innerText?.trim() || '',
  link: el.querySelector('a')?.href || '',
  isPromoted: el.innerText?.includes('Promoted'),
})))
EOF
```

**Extract job detail (right panel):**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.innerText?.trim() || '';
  const company = document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.innerText?.trim()
    || document.querySelector('.job-details-jobs-unified-top-card__company-name')?.innerText?.trim() || '';
  const desc = document.querySelector('#job-details')?.innerText?.trim()?.substring(0, 500) || '';
  const hasApply = !!document.querySelector('.jobs-apply-button');
  const hasSave = !!document.querySelector('.jobs-save-button');
  return { title, company, description: desc, hasApply, hasSave };
})())
EOF
```

### Job Selectors

| Element         | Selector                                             | Notes                |
| --------------- | ---------------------------------------------------- | -------------------- |
| Job card        | `.job-card-container`                                | Single job listing   |
| Job title       | `a[class*="job-card"]`                               | Title link           |
| Company         | `.artdeco-entity-lockup__subtitle`                   | Company name         |
| Location        | `.artdeco-entity-lockup__caption`                    | City / Remote        |
| Job link        | `a[href*="/jobs/view/"]`                             | Job detail page link |
| Detail title    | `.job-details-jobs-unified-top-card__job-title`      | Detail panel title   |
| Detail company  | `.job-details-jobs-unified-top-card__company-name a` | Detail panel company |
| Job description | `#job-details`                                       | Full JD content      |
| Apply button    | `.jobs-apply-button`                                 | Apply / Easy Apply   |
| Save button     | `.jobs-save-button`                                  | Save / Bookmark      |

## Company Page

**URL pattern**: `https://www.linkedin.com/company/<slug>/`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/company/google/'`

**Wait**: `browser-cli wait 'h1' --timeout 5000`

**Extract company info:**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const name = document.querySelector('h1')?.innerText?.trim() || '';
  const infoItems = [...document.querySelectorAll('.org-top-card-summary-info-list__info-item')];
  const about = document.querySelector('.org-about-module__description, [class*="org-about"]')?.innerText?.trim()?.substring(0, 500) || '';
  const tabs = [...document.querySelectorAll('.org-page-navigation__item a')].map(a => a.innerText?.trim());
  return {
    name,
    industry: infoItems[0]?.innerText?.trim() || '',
    headquarters: infoItems[1]?.innerText?.trim() || '',
    followers: infoItems[2]?.innerText?.trim() || '',
    employeeCount: infoItems[3]?.innerText?.trim() || '',
    about,
    tabs,
  };
})())
EOF
```

### Company Selectors

| Element      | Selector                                                  | Notes              |
| ------------ | --------------------------------------------------------- | ------------------ |
| Company name | `h1`                                                      | Page heading       |
| Industry     | `.org-top-card-summary-info-list__info-item:nth-child(1)` | Industry category  |
| Headquarters | `.org-top-card-summary-info-list__info-item:nth-child(2)` | HQ location        |
| Followers    | `.org-top-card-summary-info-list__info-item:nth-child(3)` | Follower count     |
| Employees    | `.org-top-card-summary-info-list__info-item:nth-child(4)` | Employee count     |
| About        | `.org-about-module__description`                          | Company overview   |
| Nav tabs     | `.org-page-navigation__item a`                            | Home/About/Jobs... |

## Notifications

**URL pattern**: `https://www.linkedin.com/notifications/`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/notifications/'`

**Wait**: `browser-cli wait '.nt-card' --timeout 5000`

**Extract notifications:**

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify([...document.querySelectorAll('.nt-card')].slice(0, 20).map((el, i) => ({
  index: i + 1,
  text: el.innerText?.trim()?.replace(/\n+/g, ' ')?.substring(0, 200),
  time: el.querySelector('.nt-card__time-ago, time')?.innerText?.trim() || '',
  link: el.querySelector('a')?.href || '',
  isUnread: el.classList.contains('nt-card--unread'),
})))
EOF
```

### Notification Selectors

| Element           | Selector                   | Notes                  |
| ----------------- | -------------------------- | ---------------------- |
| Notification card | `.nt-card`                 | Single notification    |
| Time              | `.nt-card__time-ago`       | Relative time          |
| Unread            | `.nt-card--unread` (class) | Unread indicator       |
| Filter tabs       | Filter bar buttons         | Notification type tabs |

## Messaging

**URL pattern**: `https://www.linkedin.com/messaging/`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/messaging/'`

**Wait**: `browser-cli wait '.msg-conversations-container__conversations-list' --timeout 5000`

### Messaging Selectors

| Element           | Selector                                                | Notes                |
| ----------------- | ------------------------------------------------------- | -------------------- |
| Conversation list | `.msg-conversations-container__conversations-list`      | Message list         |
| Filter tabs       | Filter bar buttons (Focused/Jobs/Unread/InMail/Starred) | Message type filters |
| Compose           | Button with "Compose message" / "New message" text      | New message button   |

## Company Search

**URL pattern**: `https://www.linkedin.com/search/results/companies/?keywords=<query>`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/search/results/companies/?keywords=artificial%20intelligence'`

**Wait**: `browser-cli wait '[role="list"]' --timeout 5000`

**Extract company results** (uses `[role="list"]` + text-line parsing, since search SDUI classes are obfuscated):

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const list = document.querySelector('[role="list"]');
  if (!list) return [];
  return [...list.children]
    .filter(el => el.innerText?.trim().length > 5)
    .map((el, i) => {
      const lines = el.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      const link = el.querySelector('a[href*="/company/"]');
      const followerMatch = el.innerText.match(/(\d[\d,.KMkm万千]+)\s*(?:followers|个?关注者)/);
      return {
        index: i + 1,
        name: lines[0] || '',
        industry: lines[1] || '',
        location: lines[2] || '',
        followers: followerMatch ? followerMatch[1] : '',
        companyUrl: link?.href || '',
      };
    });
})())
EOF
```

## Content Search

**URL pattern**: `https://www.linkedin.com/search/results/content/?keywords=<query>`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/search/results/content/?keywords=machine%20learning'`

**Wait**: `browser-cli wait 3000`

Content search uses SDUI with obfuscated classes. Extraction uses the **LCA (Lowest Common Ancestor)** algorithm: find like buttons → compute their shared parent depth → derive card container boundaries.

Like button aria-labels vary by page:

- Feed: `aria-label="React Like"` or `aria-label="React Like to <name>'s post"`
- Content search: `aria-label="Reaction button state: no reaction"`

## My Network

**URL pattern**: `https://www.linkedin.com/mynetwork/`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/mynetwork/'`

**Wait**: `browser-cli wait 3000`

**Extract "People you may know" suggestions** (traverses up from Connect buttons to find card containers):

```bash
browser-cli eval --stdin <<'EOF'
JSON.stringify((() => {
  const connectBtns = [...document.querySelectorAll('button')].filter(b =>
    /^(Connect|加为好友)$/.test(b.innerText?.trim())
  );
  return connectBtns.map((btn, i) => {
    let card = btn;
    for (let j = 0; j < 6; j++) card = card.parentElement;
    const lines = card.innerText.split('\n').map(l => l.trim()).filter(l =>
      l && !/^(Connect|加为好友|Follow|关注|Pending|待处理)$/.test(l) && l.length > 1
    );
    const link = card.querySelector('a[href*="/in/"]');
    return {
      index: i + 1,
      name: lines[0]?.replace(/,\s*(Verified|已验证)/, '') || '',
      title: lines[2] || '',
      mutual: lines.find(l => /mutual|共同/.test(l)) || lines[3] || '',
      profileUrl: link?.href || '',
    };
  });
})())
EOF
```

## Invitations

**URL pattern**: `https://www.linkedin.com/mynetwork/invitation-manager/`

**Navigation**: `browser-cli navigate 'https://www.linkedin.com/mynetwork/invitation-manager/'`

**Wait**: `browser-cli wait 3000`

### Invitation Selectors

| Element         | Selector                  | Notes                   |
| --------------- | ------------------------- | ----------------------- |
| Invitation card | `.invitation-card`        | Single invitation entry |
| Accept button   | Button with "Accept" text | Accept invitation       |
| Ignore button   | Button with "Ignore" text | Ignore invitation       |
| Empty state     | "No new invitations" text | No pending invitations  |

## Interactions

### Like / Unlike

Like buttons use multi-language `aria-label` detection:

| Page type      | aria-label pattern                               |
| -------------- | ------------------------------------------------ |
| Feed           | `React Like` or `React Like to <name>'s post`    |
| Content search | `Reaction button state: no reaction`             |
| Already liked  | `aria-pressed="true"` or label contains `Unlike` |

### Comment

| Element        | Selector                                             | Notes                  |
| -------------- | ---------------------------------------------------- | ---------------------- |
| Comment button | `.comment-button` or `button[aria-label*="Comment"]` | Opens comment area     |
| Comment editor | `.ql-editor[data-placeholder]`                       | Quill rich text editor |
| Submit comment | `.comments-comment-box__submit-button`               | Post the comment       |

### Create Post

| Element      | Selector                         | Notes                         |
| ------------ | -------------------------------- | ----------------------------- |
| Start a post | `.share-box-feed-entry__top-bar` | Opens compose modal           |
| Post editor  | `.ql-editor` (inside modal)      | Quill editor, contentEditable |
| Post button  | `.share-actions__primary-action` | Publish the post              |

### Connection Request

On a profile page (`/in/<username>/`):

| Element        | Selector / Pattern                              | Notes                        |
| -------------- | ----------------------------------------------- | ---------------------------- |
| Connect button | Button with text `Connect` or `加为好友`        | Send connection request      |
| Add a note     | Button with text `Add a note` or `添加备注`     | Optional: add note to invite |
| Note textarea  | `#custom-message` or `textarea[name="message"]` | Note text input              |
| Send button    | Button with text `Send now` / `Send` / `发送`   | Confirm and send             |

### Message

On a profile of a 1st-degree connection:

| Element        | Selector                                              | Notes                   |
| -------------- | ----------------------------------------------------- | ----------------------- |
| Message button | Button with text `Message` or `发消息`                | Opens messaging overlay |
| Message editor | `.msg-form__contenteditable [contenteditable="true"]` | Message input           |
| Send button    | `.msg-form__send-button`                              | Send the message        |

### Follow / Unfollow Company

On a company page (`/company/<slug>/`):

| State         | Button text                         |
| ------------- | ----------------------------------- |
| Not following | `Follow` / `关注`                   |
| Following     | `Following` / `正在关注` / `已关注` |

### Save Job

On a job search page with detail panel open:

| Element     | Selector            | Notes           |
| ----------- | ------------------- | --------------- |
| Save button | `.jobs-save-button` | Save/unsave job |

## Global Navigation

| Element       | Selector                                    | URL                |
| ------------- | ------------------------------------------- | ------------------ |
| Home          | `.global-nav__primary-link` (Home)          | `/feed/`           |
| Network       | `.global-nav__primary-link` (Network)       | `/mynetwork/`      |
| Jobs          | `.global-nav__primary-link` (Jobs)          | `/jobs/`           |
| Messaging     | `.global-nav__primary-link` (Messaging)     | `/messaging/`      |
| Notifications | `.global-nav__primary-link` (Notifications) | `/notifications/`  |
| Search        | `.search-global-typeahead input`            | —                  |
| Me            | `.global-nav__me`                           | User dropdown menu |

## Notes

- **Login required**: Nearly all LinkedIn pages require authentication. Always verify login state before any operation; if not logged in, stop and prompt the user to log in manually.
- **No `data-testid`**: LinkedIn does not use `data-testid` attributes. Use semantic class names (e.g. `.feed-shared-update-v2`, `.job-card-container`, `.nt-card`).
- **Obfuscated CSS classes**: Newer pages (e.g. search results) use the SDUI framework with hashed class names (e.g. `_69e756d6`). Prefer `[role]` attributes and semantic class names; fall back to text-content matching.
- **Infinite scroll**: The feed uses lazy-loaded infinite scroll. Use `scroll down --amount 3000` + `wait 2000` to load more posts.
- **People search privacy**: People search results may show "LinkedIn Member" instead of the actual name due to privacy settings.
- **Job detail panel**: The job search page uses a left-list + right-detail split layout. Clicking a job card on the left updates the detail panel on the right.
- **`aria-hidden="true"` pattern**: LinkedIn frequently uses `span[aria-hidden="true"]` to render visible text, avoiding duplicate screen reader content. Use this selector to extract clean text.
- **SPA navigation**: LinkedIn is a single-page app; page transitions do not fully reload. Use `browser-cli navigate` for navigation and `browser-cli wait` for content loading.
- **Localization**: LinkedIn UI text varies by locale (e.g. "Comment" vs "评论", "Like" vs "赞"). Extraction scripts that parse interaction counts must handle both English and localized text formats (e.g. "297 comments" vs "297 条评论").
- **Like button aria-labels vary by page**: Feed uses `React Like`, content search uses `Reaction button state: no reaction`. Use a broad regex like `/Reaction button|React Like|回应按钮/` to match across page types.
- **Content search SDUI**: Content search results use obfuscated SDUI classes with no `data-urn` or semantic class names. The LCA (Lowest Common Ancestor) algorithm finds card boundaries by computing the shared parent depth of two like buttons.
- **"Verified" badge in names**: Network suggestion cards include "Verified" text (e.g. "John Doe, Verified"). Strip with `.replace(/,\s*(Verified|已验证)/, '')`.
- **Feedback cards in search**: Content search may include "Are these results helpful?" cards mixed into results. Filter with `/helpful|Are these/` regex.
