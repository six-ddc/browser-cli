# quora.com

> Q&A platform where users ask questions and get answers from the community.

> **Tip**: To avoid disrupting user browsing, open a dedicated tab first:
>
> ```
> browser-cli tab new 'https://www.quora.com' --group browser-cli
> ```
>
> Then use `--tab <tabId>` for all subsequent commands.

> **Recipe scripts**: Common operations are encapsulated as reusable script functions. Read `scripts/quora.mjs` source to see available recipe functions and their preconditions (`@requires`).
>
> ```bash
> # Call a specific function
> browser-cli --tab <tabId> script scripts/quora.mjs --call extractAnswers
> # Pass arguments to a function
> browser-cli --tab <tabId> script scripts/quora.mjs --call navigateToSearch -- --query "machine learning"
> ```
>
> When the agent runs, replace `scripts/quora.mjs` with the absolute path (derived from the SKILL.md directory).

> **Recipe debugging**: If a recipe function fails (e.g. selectors changed), copy the function from `scripts/quora.mjs`, modify the selectors, and re-run via `script -` (stdin):
>
> ```bash
> browser-cli --tab <tabId> script - <<'EOF'
> export default async function(browser) {
>   // Copied from quora.mjs extractAnswers, with modified selectors
>   return browser.evaluate({
>     expression: `JSON.stringify([...document.querySelectorAll('[class*="dom_annotate_question_answer_item_"]')].slice(0,3).map(card => ({ author: card.querySelector('a[href*="/profile/"]')?.innerText || "" })))`
>   });
> }
> EOF
> ```
>
> You can also debug selectors step by step with `eval`: `browser-cli --tab <tabId> eval 'document.querySelectorAll("[class*=dom_annotate_question_answer_item_]").length'`
>
> See the selector tables below for reference.

## Selector Reference

### Login Detection

| State      | Selector                              | Notes                                              |
| ---------- | ------------------------------------- | -------------------------------------------------- |
| Logged in  | `img[alt*="Profile photo for"]`       | User avatar; alt text = "Profile photo for <name>" |
| Username   | `img[alt*="Profile photo for"]` (alt) | Extract name from alt attribute                    |
| Logged out | Login/signup wall on homepage         | Redirects to login page for unauthenticated users  |

### Stable Class Name Patterns

Quora uses CSS-in-JS (styled-components) with generated class names. Use these stable patterns instead:

| Pattern                                 | Purpose              | Notes                   |
| --------------------------------------- | -------------------- | ----------------------- |
| `.puppeteer_test_*`                     | Test-stable elements | Most reliable selectors |
| `[class*="dom_annotate_*"]`             | Annotated containers | Answer items, ads, feed |
| `.q-box`, `.q-click-wrapper`, `.q-text` | Layout primitives    | Quora's design system   |
| `.spacing_log_header_nav`               | Header navigation    | Only on home/feed pages |

### Search Results

**URL pattern**: `/search?q=<query>&type=<type>&time=<time>`

| Parameter | Values                                                    |
| --------- | --------------------------------------------------------- |
| `type`    | `question`, `answer`, `post`, `profile`, `topic`, `space` |
| `time`    | `hour`, `day`, `week`, `month`, `year`                    |

| Element        | Selector                                  | Notes                    |
| -------------- | ----------------------------------------- | ------------------------ |
| Result item    | `.puppeteer_test_question_component_base` | Each search result card  |
| Question title | `.puppeteer_test_question_title`          | Title text               |
| Question link  | `a[href*="quora.com/"]` (inside item)     | First non-search link    |
| Answer count   | Text match: `/\d[\d,.K]+ answers?/i`      | Extracted from item text |

### Question Page

**URL pattern**: `/<QuestionSlug>` (e.g., `/What-is-artificial-intelligence-15`)

| Element            | Selector                                              | Notes                             |
| ------------------ | ----------------------------------------------------- | --------------------------------- |
| Question title     | `.puppeteer_test_question_title`                      | First instance = page question    |
| Question container | `.puppeteer_test_question_main`                       | Full question area                |
| Topic tags         | `.puppeteer_test_question_main a[href*="/topic/"]`    | Topic links above the question    |
| Answer card        | `[class*="dom_annotate_question_answer_item_"]`       | Indexed: `_0`, `_1`, `_2`, ...    |
| Answer content     | `.puppeteer_test_answer_content`                      | Answer body text                  |
| Upvote button      | `.puppeteer_test_votable_upvote_button`               | Text = "Upvote\n<count>"          |
| Author link        | `a[href*="quora.com/profile/"]` (with non-empty text) | Inside answer card                |
| Time link          | `a[href*="/answer/"]` or long-path Space link         | "2y", "19h ago", "Jan 20"         |
| Space name         | `.puppeteer_test_tribe_name`                          | If answer posted via a Space      |
| Expand "(more)"    | `.qt_read_more`                                       | Click to expand truncated answers |
| Promoted answer    | `[class*="dom_annotate_ad_promoted_answer"]`          | Filter out ads                    |
| Related questions  | `[class*="dom_annotate_related_questions"]`           | Sidebar related questions         |
| Overflow menu      | `.puppeteer_test_overflow_menu`                       | "..." menu per answer             |

### Home Feed

**URL pattern**: `/`

| Element        | Selector                                     | Notes                           |
| -------------- | -------------------------------------------- | ------------------------------- |
| Feed container | `[class*="dom_annotate_multifeed_home"]`     | Main feed area                  |
| Feed item      | `.puppeteer_test_tribe_post_item_feed_story` | Individual post in feed         |
| Feed switcher  | `[class*="dom_annotate_feed_switcher"]`      | "For You" / "Following" tabs    |
| Header nav     | `.spacing_log_header_nav`                    | Home, Following, Answer, Spaces |
| Add question   | `.puppeteer_test_add_question_button`        | Only visible when logged in     |
| Search input   | `.puppeteer_test_selector_input`             | Top search bar                  |

### Profile Page

**URL pattern**: `/profile/<Username>`

Profile pages display user stats (followers, following, answers, questions, posts) as plain text. No stable selectors for individual stat fields — parse from `document.body.innerText`.

## Notes

- **No `data-testid` attributes**: Quora uses `puppeteer_test_*` class names and `dom_annotate_*` class names as stable selectors instead.
- **CSS-in-JS**: All visual class names are generated (e.g., `c1nud10e`, `b1l8alrs`). Never use these for selectors — they change between deployments.
- **Login wall on homepage**: Unauthenticated users are redirected to a login/signup page. Direct question URLs (`/What-is-...`) are accessible without login.
- **Locale redirect**: `www.quora.com` may redirect to a locale-specific subdomain (e.g., `jp.quora.com`) based on browser language. Direct question URLs stay on `www.quora.com`.
- **Infinite scroll**: Question pages and search results use infinite scroll. Call `loadMoreAnswers()` or `scroll down --amount 3000` + `wait 2000` to load more.
- **Promoted answers**: Ads are mixed into the answer list. Filter with `[class*="dom_annotate_ad_promoted_answer"]` to exclude them.
- **Space-posted answers**: When an answer is posted via a Quora Space, the time link points to `<space-name>.quora.com/<slug>` instead of `/answer/<user>`. The `extractAnswers` recipe handles both formats.
- **Time format varies**: Recent = "19h ago", "4h ago"; older = "2y", "1y"; date = "Jan 20", "Oct 23, 2024".
- **Upvote count format**: Raw button text is `"Upvote\n<count>"` (e.g., `"Upvote\n390"`). Some promoted answers show `"Upvote · 12.3K12.3K"` (duplicated).
