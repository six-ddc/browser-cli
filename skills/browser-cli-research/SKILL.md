---
name: browser-cli-research
description: >
  Deep research and information gathering using browser-cli to search, extract, and synthesize
  information from the real web. Covers Google search, YouTube transcript extraction, Reddit/HN
  community discussions, LinkedIn professional insights, WeChat/Xiaohongshu/Weibo Chinese-language
  sources, X/Twitter social posts, Google Scholar academic papers, Quora Q&A, Discord tech
  communities, article content extraction (markdown), and custom JS-based scraping for arbitrary
  websites.
  Use this skill whenever the user wants to research a topic, investigate a question, gather
  opinions from multiple sources, find discussions or community sentiment, compare viewpoints,
  collect references, or do any kind of information retrieval that goes beyond what a simple
  web search tool can provide. Also trigger when the user asks to "look into", "find out about",
  "what are people saying about", "summarize discussions on", or any research-oriented request
  — even if they don't explicitly say "research". This skill is especially valuable for
  multi-source research that combines English and Chinese sources, technical community opinions,
  professional/industry insights, academic findings, and video content analysis.
allowed-tools: Bash(browser-cli:*)
argument-hint: '<describe what you want to research>'
---

# Research Skill

Use browser-cli to gather, extract, and synthesize information from the live web. This skill
orchestrates browser-cli's site-specific capabilities into structured research workflows — it
does not replace browser-cli but builds targeted information retrieval patterns on top of it.

## Prerequisites

Run `browser-cli status` to verify the daemon is running and an extension is connected.
If not ready, run `browser-cli start` and ensure the browser extension is installed and connected.

Read the [browser-cli SKILL.md](../browser-cli/SKILL.md) if you need the full command reference.
This skill only covers the research-relevant subset.

## Research Workflow

Follow this structured workflow for any research task. The key insight from DeepResearch
best practices is that good research is iterative and planned — not just "search and summarize".

### Phase 1: Plan

Before touching the browser, decompose the research question:

1. **Clarify the goal** — What does the user actually need? A factual answer, a comparison,
   community sentiment, a comprehensive report?
2. **Break into sub-questions** — Split the main question into 3-5 specific sub-questions
   that can be independently researched
3. **Select sources** — For each sub-question, decide which sources are most likely to have
   good answers:
   - **Factual/technical**: Google → articles (markdown) → Google Scholar
   - **Community opinion**: Reddit, HN, X/Twitter, Quora
   - **Professional/industry**: LinkedIn content search, LinkedIn company pages
   - **Chinese perspective**: WeChat, Xiaohongshu, Weibo
   - **Expert explanation**: YouTube transcripts
   - **Current events**: Google News, X/Twitter, Weibo trending
   - **Tech communities**: HN, Discord (open-source projects, dev communities)
4. **Report the plan** — Tell the user: "I'll research X by looking into [sub-questions]
   across [sources]. Let me get started."

### Phase 2: Gather

Open a dedicated tab group and execute searches across sources. Use parallel tabs when
gathering from independent sources.

**Parallel research pattern** — open multiple tabs simultaneously:

```bash
# Open tabs for different sources in one group
browser-cli tab new 'https://www.google.com' --group research
# Output: Tab 101 (use for Google)
browser-cli tab new 'https://www.reddit.com' --group research
# Output: Tab 102 (use for Reddit)
browser-cli tab new 'https://news.ycombinator.com' --group research
# Output: Tab 103 (use for HN)

# Now work across tabs — search on Google while Reddit loads, etc.
browser-cli --tab 101 script SCRIPT_PATH/google.mjs --call search -- --query "your query"
browser-cli --tab 102 script SCRIPT_PATH/reddit.mjs --call navigateSubreddit -- --subreddit "relevant" --sort "top" --timeframe "month"
```

**Iterative refinement** — after initial results, refine your approach:

- If Google results are too broad, add `site:` operators or time filters
- If a source gives unexpected results, adjust keywords (try synonyms, more specific terms)
- If English sources lack depth, try Chinese-language queries on WeChat/Xiaohongshu
- If you find a key term or concept in early results, use it to refine subsequent searches

### Phase 3: Evaluate & Deepen

As you collect information, assess source quality:

- **Recency**: Is the information current enough for the question?
- **Authority**: Is the source credible? (established publication, domain expert, high-engagement post)
- **Engagement**: For community sources, check upvotes/likes/comment count
- **Consensus vs. outlier**: Does this view match or contradict other sources?
- **Depth decision**: If a source is particularly rich, go deeper (read full article, extract all
  comments). If shallow, move on to the next source.

When sources contradict each other, note both viewpoints and which has stronger evidence.

### Phase 4: Synthesize & Report

Structure your output as a research report:

```
## [Research Topic]

### Summary
[2-3 sentence executive summary of key findings]

### Key Findings
1. **[Finding 1]** — [detail with context]
   - Source: [title](url) | [additional source](url)
2. **[Finding 2]** — [detail with context]
   - Source: [title](url)

### Different Perspectives
- **[Viewpoint A]**: [summary] (supported by [source])
- **[Viewpoint B]**: [summary] (supported by [source])

### Gaps & Caveats
- [What couldn't be determined or needs more research]
- [Any notable biases in sources]

### Sources
1. [Title — Source Name](url) — [one-line description of what was extracted]
2. ...
```

Adjust the format based on what the user asked for — a quick answer needs less structure
than a comprehensive analysis. But always include source URLs for verification.

## Research Toolkit

### Script Path Resolution

All recipe scripts live in the browser-cli skill directory. When invoking scripts,
use the absolute path derived from this SKILL.md's location:

```
SCRIPT_PATH = <this SKILL.md's directory>/../browser-cli/scripts
```

For example, if this file is at `/Users/me/skills/browser-cli-research/SKILL.md`, then:
`SCRIPT_PATH=/Users/me/skills/browser-cli/scripts`

### 1. Article Content Extraction (any website)

The `markdown` command is the universal content extractor. It converts any article page into
clean Markdown using Defuddle — works on blogs, news sites, documentation, etc.

```bash
browser-cli --tab <tabId> navigate '<article-url>'
browser-cli --tab <tabId> markdown
```

Prefer `markdown` over `snapshot` or `eval` for article-type pages. For pages where `markdown`
doesn't capture structured data well (tables, lists, metadata), fall back to `eval` with
custom selectors.

### 2. Google Search

Google is the primary entry point for broad research. The recipe script supports web, news,
and image search with time filtering.

**Script path**: `SCRIPT_PATH/google.mjs`

```bash
# Web search
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call search -- --query "your query"
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call extractResults

# News search (current events)
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call search -- --query "your query" --type news
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call extractNewsResults

# Image search
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call search -- --query "your query" --type images
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call extractImageResults

# Time-filtered search (h=hour, d=day, w=week, m=month, y=year)
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call search -- --query "your query"
browser-cli --tab <tabId> script SCRIPT_PATH/google.mjs --call applyTimeFilter -- --range w
```

**Search query tips**:

- `site:reddit.com <topic>` — target a specific platform
- `"exact phrase"` — find exact matches
- `<topic> -unwanted` — exclude terms
- `<topic> after:2025-01-01` — recent results only

### 3. Google Scholar (Academic Research)

For academic papers, citations, and scholarly sources.

**Script path**: `SCRIPT_PATH/scholar.mjs`

```bash
# Search (with optional year filter and date sort)
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call search -- --query "attention mechanism" --yearFrom 2024
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call extractResults

# Page metadata (result count, related searches)
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call extractMeta

# Follow citation chains
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call navigateCitedBy -- --url "<citedByUrl from extractResults>"
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call extractResults

# Pagination
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call nextPage
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call extractResults

# Or full workflow (search + extract in one call)
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs -- --query "LLM reasoning" --yearFrom 2023 --sort date
```

**Research workflow**:

1. Search Scholar for the topic with year filter for recency
2. Extract results — each includes title, authors, venue, citedBy count, PDF links
3. Follow citation chains (`citedByUrl`) to find influential related work
4. Read full papers via `markdown` — works on arxiv, ACL Anthology, Nature, Springer,
   PMC, IEEE, MDPI, and most academic publishers

**Notes**: `markdown` does NOT work on Scholar itself (use the recipe script). Scholar
may trigger CAPTCHA on frequent automated queries — space out requests.

### 4. YouTube (Video Search + Transcript Extraction)

YouTube transcripts contain detailed explanations, tutorials, interviews, and presentations
that often aren't available as text elsewhere.

**Script path**: `SCRIPT_PATH/youtube.mjs`

```bash
# Search for videos on a topic
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call search -- --query "topic"
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call extractSearchResults

# Open a specific video and get its metadata
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call openVideo -- --url "https://youtube.com/watch?v=..."
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call extractVideoInfo

# Extract transcript (the key research capability)
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call getCaptionTracks
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call extractTranscriptText
# Or with timestamps:
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call extractTranscript
# Specific language:
browser-cli --tab <tabId> script SCRIPT_PATH/youtube.mjs --call extractTranscript -- --lang ja
```

**Research workflow**:

1. Search YouTube for the topic
2. Pick the most relevant videos (check view count, channel credibility)
3. Extract transcripts as plain text for analysis
4. Summarize key points from transcripts

**Notes**: Not all videos have captions. Use `getCaptionTracks` to check first. Auto-generated
captions (`kind: "asr"`) are less accurate than manual ones.

### 5. Reddit (Community Discussions + Opinions)

Reddit is the best source for authentic community opinions, troubleshooting experiences, and
product reviews.

**Script path**: `SCRIPT_PATH/reddit.mjs`

```bash
# Check login (required for most subreddits)
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call detectLogin

# Navigate to a subreddit (sort: hot/new/top, timeframe for top: hour/day/week/month/year/all)
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call navigateSubreddit -- --subreddit "programming" --sort "top" --timeframe "week"
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call extractFeed

# Read a specific post + comments
browser-cli --tab <tabId> navigate 'https://www.reddit.com/r/...'
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call extractPostDetail
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call extractComments
# Or formatted as an indented tree:
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call formatCommentTree
```

**Research workflow**:

1. Search Google with `site:reddit.com <topic>` to find relevant threads
2. Or navigate directly to a relevant subreddit sorted by top/week
3. Extract post details and comment trees from the most upvoted threads
4. `formatCommentTree` gives a human-readable indented view with scores

**Notes**: Reddit blocks unauthenticated access. If `detectLogin` returns `loggedIn: false`,
ask the user to log in manually first.

### 6. Hacker News (Tech Community)

Hacker News is the go-to for tech industry opinions, startup discussions, and technical deep dives.
No login required for reading.

**Script path**: `SCRIPT_PATH/hn.mjs`

```bash
# Browse categories (or use navigateTo: top/new/ask/show/jobs)
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call navigateTo -- --category "top"
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call extractPosts

# Next page of posts
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call nextPage
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call extractPosts

# Navigate to a specific post and get metadata
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call navigateToPost -- --id "<postId>"
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call extractPostDetail

# Extract comments (structured tree with depth)
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call extractComments
# Or as a human-readable indented tree (ideal for research reports):
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call formatCommentTree
```

**Research workflow**:

1. Search Google with `site:news.ycombinator.com <topic>` to find relevant threads
2. Or use HN's built-in search: `https://hn.algolia.com/?q=<query>`
3. Navigate to the post with `navigateToPost`, get metadata with `extractPostDetail`
4. Extract comments — use `formatCommentTree` for a readable indented view with usernames

### 7. LinkedIn (Professional & Industry Insights)

LinkedIn is essential for professional/industry research — company information, expert opinions,
industry trends, and professional discussions. Login required.

**Script path**: `SCRIPT_PATH/linkedin.mjs`

```bash
# Check login (required)
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call detectLogin

# Search for content/posts on a topic (with extraction)
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call searchContent -- --keywords "AI trends 2025"

# Search for people (experts in a field)
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call searchPeople -- --keywords "AI researcher"

# Extract a person's profile
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call navigateProfile -- --username "johndoe"
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call extractProfile

# Search for companies
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call searchCompanies -- --keywords "autonomous driving"

# Extract company info
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call navigateCompany -- --slug "openai"
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call extractCompany

# Job market research
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call searchJobs -- --keywords "ML engineer" --location "San Francisco"
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call extractJobDetail

# Extract feed posts (industry discussions)
browser-cli --tab <tabId> navigate 'https://www.linkedin.com/feed/'
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call extractFeed
```

**Research use cases**:

- Company due diligence: `searchCompanies` → `navigateCompany` → `extractCompany`
- Expert identification: `searchPeople` → `navigateProfile` → `extractProfile`
- Industry trends: `searchContent` → post extraction with engagement metrics
- Job market research: `searchJobs` → `extractJobDetail` for listings and descriptions

**Notes**: Login required for all LinkedIn pages. If not logged in, ask the user to log in first.

### 8. WeChat Articles (Chinese Sources)

Sogou WeChat search (`weixin.sogou.com`) indexes WeChat public account articles — the primary
channel for Chinese-language analysis, commentary, and news. No login required.

**Script path**: `SCRIPT_PATH/weixin.mjs`

```bash
# Search for articles
browser-cli --tab <tabId> script SCRIPT_PATH/weixin.mjs --call search -- --keyword "人工智能"
browser-cli --tab <tabId> script SCRIPT_PATH/weixin.mjs --call extractResults

# Read a specific article (use URL from search results)
browser-cli --tab <tabId> script SCRIPT_PATH/weixin.mjs --call openArticle -- --url "<article-url>"

# Or use markdown for cleaner extraction from the article page
browser-cli --tab <tabId> navigate '<mp.weixin.qq.com article URL>'
browser-cli --tab <tabId> markdown
```

**Notes**: Article links from search results are redirects — `navigate` follows them automatically.
`markdown` produces the cleanest output for WeChat articles.

### 9. Xiaohongshu (Chinese Social/Lifestyle)

Xiaohongshu is a Chinese lifestyle and social commerce platform. Useful for consumer opinions,
product reviews, travel tips, and lifestyle trends in the Chinese market.

**Script path**: `SCRIPT_PATH/xhs.mjs`

```bash
# Check login and dismiss login modal if needed
browser-cli --tab <tabId> script SCRIPT_PATH/xhs.mjs --call detectLogin

# Search
browser-cli --tab <tabId> script SCRIPT_PATH/xhs.mjs --call search -- --keyword "关键词"
browser-cli --tab <tabId> script SCRIPT_PATH/xhs.mjs --call extractSearchResults

# Read a post detail (must navigate from search results to keep xsec_token)
browser-cli --tab <tabId> click '<link-selector-from-search>'
browser-cli --tab <tabId> script SCRIPT_PATH/xhs.mjs --call extractPost
browser-cli --tab <tabId> script SCRIPT_PATH/xhs.mjs --call extractComments
```

**Notes**: Direct URLs without `xsec_token` return 404. Always navigate from search results.
Detail page scrolling requires `--selector '.note-scroller'`.

### 10. X / Twitter (Real-time Social Posts)

X is useful for real-time discussions, expert opinions, and trending topics.

**Script path**: `SCRIPT_PATH/x.mjs`

```bash
# Search (requires login)
browser-cli --tab <tabId> script SCRIPT_PATH/x.mjs --call detectLogin
browser-cli --tab <tabId> script SCRIPT_PATH/x.mjs --call navigateSearch -- --query "AI news" --tab "live"
browser-cli --tab <tabId> script SCRIPT_PATH/x.mjs --call extractTweets

# Check a specific user's posts
browser-cli --tab <tabId> navigate 'https://x.com/<handle>'
browser-cli --tab <tabId> script SCRIPT_PATH/x.mjs --call extractTweets
```

### 11. Weibo (Chinese Public Discourse + Trending)

Weibo is China's largest microblogging platform — essential for Chinese public opinion, trending
topics, breaking news, and celebrity/brand discussions. Login required for full access.

**Script path**: `SCRIPT_PATH/weibo.mjs`

```bash
# Check login
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call detectLogin

# Search for a topic
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call search -- --keyword "人工智能"
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call extractSearchResults

# Extract trending topics (热搜榜)
browser-cli --tab <tabId> navigate 'https://weibo.com/hot/search'
browser-cli --tab <tabId> wait 3000
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call extractTrending

# Extract feed posts (homepage or hot)
browser-cli --tab <tabId> navigate 'https://weibo.com/hot'
browser-cli --tab <tabId> wait 3000
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call extractFeed

# Read a post's comments
browser-cli --tab <tabId> navigate '<post-detail-url>'
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call openComments
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call extractComments
```

**Research workflow**:

1. Check `extractTrending` for what's currently hot in China
2. Search specific topics with `search` + `extractSearchResults`
3. For deeper sentiment, read comments on popular posts
4. Comments use virtual scrolling — use `scrollComments` + `getComments` for more

**Notes**: Weibo has strong anti-bot measures. All interactions must go through page clicks
(not API calls). Add delays (500-2000ms) between operations. Login required.

### 12. Quora (Q&A Knowledge)

Quora is useful for expert answers, explanations, and diverse perspectives on questions.

**Script path**: `SCRIPT_PATH/quora.mjs`

```bash
# Search for questions
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call navigateToSearch -- --query "best practices for X"
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call extractSearchResults

# Read answers on a specific question
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call navigateToQuestion -- --url "<question-url>"
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call extractQuestionMeta
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call expandAllAnswers
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call extractAnswers

# Load more answers if needed
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call loadMoreAnswers
browser-cli --tab <tabId> script SCRIPT_PATH/quora.mjs --call extractAnswers
```

**Research workflow**:

1. Search Google with `site:quora.com <topic>` or use `navigateToSearch` directly
2. Navigate to high-quality questions, expand all answers
3. Extract answers with upvote counts and author credentials

### 13. Discord (Tech Communities + Open Source)

Discord communities are valuable for real-time discussions in open-source projects, dev tools,
crypto, gaming, and niche tech communities. Login required; read-only operations.

**Script path**: `SCRIPT_PATH/discord.mjs`

```bash
# Check login
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call detectLogin

# List joined servers
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call listServers

# Navigate to a server and list channels
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call navigateServer -- --name "Open WebUI"
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call listChannels

# Read messages in a channel
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call navigateChannel -- --url "<channel-url>"
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call extractMessages

# Search messages across the server
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call searchMessages -- --query "bug report"

# View pinned messages
browser-cli --tab <tabId> script SCRIPT_PATH/discord.mjs --call extractPinnedMessages
```

**Research workflow**:

1. Navigate to the relevant server and channel
2. Search for topic-specific messages with `searchMessages`
3. Extract messages and pinned messages for context
4. Check member list with `extractMembers` for community size/roles

**Notes**: Login required. Discord search uses Draft.js contentEditable input (handled by
the recipe script). Read-only operations only.

### 14. Visual Evidence (Screenshots)

For research involving charts, infographics, or visual data that `markdown` can't capture:

```bash
# Full page screenshot
browser-cli --tab <tabId> screenshot --path /tmp/research-evidence.png

# Specific element screenshot
browser-cli --tab <tabId> screenshot --selector '.chart-container' --path /tmp/chart.png
```

### 15. Custom JS Extraction (Arbitrary Websites)

For websites without a dedicated site guide, use `eval` or `script -` to extract data directly.

```bash
# Quick extraction with eval
browser-cli --tab <tabId> navigate '<url>'
browser-cli --tab <tabId> eval 'JSON.stringify([...document.querySelectorAll("article h2")].map(el => el.innerText))'

# Complex extraction with inline script
browser-cli --tab <tabId> script - <<'EOF'
export default async function(browser) {
  await browser.navigate({ url: 'https://example.com/data' });
  await browser.wait({ selector: '.content', timeout: 5000 });
  return browser.evaluate({
    expression: `JSON.stringify({
      title: document.querySelector("h1")?.innerText,
      items: [...document.querySelectorAll(".item")].map(el => ({
        name: el.querySelector(".name")?.innerText,
        value: el.querySelector(".value")?.innerText,
      }))
    })`
  });
}
EOF
```

**Common patterns**:

- Tables: `[...document.querySelectorAll("table tr")].map(tr => [...tr.cells].map(td => td.innerText))`
- Lists: `[...document.querySelectorAll("ul li")].map(li => li.innerText)`
- Metadata: `JSON.stringify(Object.fromEntries([...document.querySelectorAll("meta[name]")].map(m => [m.name, m.content])))`
- JSON-LD: `JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || '{}')`

## Error Recovery & Fallbacks

When a source fails, don't stop — fall back to alternatives:

| Problem                          | Fallback                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| Reddit requires login            | Search Google with `site:reddit.com <topic>` and read cached/indexed results via `markdown` |
| Paywall blocks article           | Try Google cache: `cache:<url>`, or search for the article title to find mirrors            |
| `markdown` returns empty/garbage | Try `snapshot -c` for structure, or `eval` with custom selectors                            |
| Site blocks extraction           | Use `screenshot` to capture visual content, then describe what you see                      |
| YouTube has no captions          | Check video description for links to blog posts/articles covering the same topic            |
| X/Twitter requires login         | Search Google with `site:x.com <topic>` for indexed tweets                                  |
| WeChat article expired           | Search for the article title on Google or Baidu for cached versions                         |
| LinkedIn not logged in           | Ask user to log in; meanwhile use Google `site:linkedin.com` for public profiles            |
| Discord not logged in            | Ask user to log in; no public fallback available                                            |
| Weibo anti-bot blocks            | Add longer delays (2-5s) between operations; avoid rapid sequential requests                |
| Scholar CAPTCHA triggered        | Wait 30-60s and retry; reduce query frequency; try alternative search terms                 |
| Quora blocks extraction          | Search Google with `site:quora.com <topic>` and read via `markdown`                         |

## Handling Pagination

For sites with infinite scroll or pagination:

```bash
# Reddit: use the scroll collector for feed pages
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call initPostCollector
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call scrollAndCollect
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call scrollAndCollect
browser-cli --tab <tabId> script SCRIPT_PATH/reddit.mjs --call getCollectedPosts

# Google: paginate via URL parameter
browser-cli --tab <tabId> navigate 'https://www.google.com/search?q=topic&start=10'

# WeChat: use nextPage
browser-cli --tab <tabId> script SCRIPT_PATH/weixin.mjs --call nextPage

# HN: click "More" link for next page
browser-cli --tab <tabId> script SCRIPT_PATH/hn.mjs --call nextPage

# Scholar: next page of results
browser-cli --tab <tabId> script SCRIPT_PATH/scholar.mjs --call nextPage

# Weibo: use scroll collector for feed/search pages
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call initScrollCollector
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call scrollAndCollect
browser-cli --tab <tabId> script SCRIPT_PATH/weibo.mjs --call getCollected

# LinkedIn: use feed collector for infinite scroll
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call initFeedCollector
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call scrollAndCollect
browser-cli --tab <tabId> script SCRIPT_PATH/linkedin.mjs --call getCollectedPosts

# General infinite scroll: scroll + wait + extract
browser-cli --tab <tabId> scroll down --amount 3000
browser-cli --tab <tabId> wait 2000
```
