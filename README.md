# Browser-CLI

[![npm version](https://img.shields.io/npm/v/@browser-cli/cli.svg)](https://www.npmjs.com/package/@browser-cli/cli)
[![license](https://img.shields.io/npm/l/@browser-cli/cli.svg)](LICENSE)

Skill-powered browser automation CLI for AI agents — real browser extensions, optional CDP, no Playwright.

## Why Browser-CLI?

Most browser automation tools (Playwright, Puppeteer, Selenium) rely on CDP or WebDriver protocols — running a headless or debug-mode browser that doesn't behave like a real user's browser. Browser-CLI takes a different approach:

- **Real browser, zero fingerprint** — Runs inside your actual Chrome/Firefox via a lightweight extension. No `navigator.webdriver`, no headless flags, no CDP traces by default — behaves exactly like a human user, minimizing the risk of triggering anti-bot detection.
- **Same session, same identity** — Operates in your existing browser with all your cookies, login state, and extensions intact. No separate browser profile or cold start.
- **Skill-first design** — Ships with a [skill definition](skills/browser-cli/SKILL.md) so AI agents (Claude Code, etc.) can call `/browser-cli` as a tool and automate tasks autonomously.
- **CDP-free by default** — The extension communicates over WebSocket, with no dependency on browser drivers. Opt-in `--debugger` flag uses CDP for trusted (`isTrusted=true`) input events when needed.
- **Agent-friendly output** — Accessibility snapshots with element refs (`@e1`, `@e2`), semantic locators, structured errors with hints, and `--json` mode.

## Architecture

```
CLI (client) ── NDJSON / Unix socket ──→ Daemon (server) ── JSON / WebSocket ──→ Extension (browser)
```

The CLI sends commands to a background daemon, which relays them over WebSocket to a browser extension. The extension executes commands via Chrome APIs or content scripts and returns results through the same path. CDP-free by default — just a lightweight extension in your real browser. Opt-in `--debugger` flag uses CDP for trusted input events when needed.

## Features

**Page & Content**

- Navigate (goto, back, forward, reload), take screenshots
- Extract clean readable Markdown via [Defuddle](https://github.com/nickersoft/defuddle) — strips nav, ads, and boilerplate
- Accessibility snapshots with element refs (`@e1`, `@e2`) for precise interaction
- Evaluate JavaScript in page context

**Interaction**

- Actions — click, fill, type, press, hover, drag & drop, scroll, check/uncheck, select, upload
- Semantic locators — find elements by role, text, label, placeholder, alt, title, testid, xpath
- `find` command — locate + act in one step: `find role button click --name "Submit"`
- Wait for selector, URL, duration, text, load state, or custom function

**Browser State**

- Tabs, windows, tab groups; frame switching
- Cookies, localStorage, sessionStorage
- Network interception (block, redirect, track)
- Dialogs (alert/confirm/prompt), console logs

**Scripting**

- `script` command — run multi-step automation as a single ES module (Node.js process)
- Browser SDK with 1:1 CLI command mapping (`browser.navigate()`, `browser.click()`, etc.)
- Supports stdin, file input, CLI arguments, and per-command timeouts

**Data & Config**

- Query text, HTML, value, attributes, element state, count, bounding box
- Viewport, geolocation, media preferences, custom headers
- Bookmarks & history management

## Site-Specific Guides — Pre-built Automation for Popular Sites

Browser-CLI ships with **site-specific guides** that contain tested CSS selectors, extraction scripts, and interaction patterns for popular websites. When an AI agent automates a known site, it can skip trial-and-error DOM exploration and use the pre-built scripts directly — **saving tokens and dramatically improving accuracy**.

| Site                                                                                | What's Covered                                           |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [google.com](skills/browser-cli/references/sites/google.com.md)                     | Search results extraction, pagination, "People also ask" |
| [mail.google.com](skills/browser-cli/references/sites/mail.google.com.md)           | Gmail inbox, email reading, compose, labels              |
| [x.com](skills/browser-cli/references/sites/x.com.md)                               | Timeline, tweets, search, profiles                       |
| [reddit.com](skills/browser-cli/references/sites/reddit.com.md)                     | Feeds, posts, threaded comments, subreddit search        |
| [news.ycombinator.com](skills/browser-cli/references/sites/news.ycombinator.com.md) | Front page, comments, search                             |
| [xiaohongshu.com](skills/browser-cli/references/sites/xiaohongshu.com.md)           | Search, note detail, comments                            |
| [weixin.sogou.com](skills/browser-cli/references/sites/weixin.sogou.com.md)         | WeChat article search                                    |

Each guide includes ready-to-use `browser-cli eval` scripts, key selectors, pagination/scroll patterns, and site-specific gotchas (auth requirements, shadow DOM, SPA caveats). Community contributions welcome — use the [site-guide skill](skills/site-guide/SKILL.md) to interactively explore a site's live DOM and generate a tested guide, or see the [contributing guide](skills/browser-cli/references/sites/CONTRIBUTING.md) for manual authoring.

## Quick Start

```bash
npm install -g @browser-cli/cli
```

Then install the browser extension from [GitHub Releases](https://github.com/six-ddc/browser-cli/releases) and load it into Chrome or Firefox. For detailed steps (extension loading, daemon connection, troubleshooting), see the **[Setup Guide](skills/browser-cli/references/SETUP.md)**.

```bash
# Start the daemon and verify connection
browser-cli start
browser-cli status

# Navigate and inspect
browser-cli navigate https://example.com
browser-cli snapshot -ic

# Interact with elements
browser-cli click 'role=button[name="Submit"]'
browser-cli fill 'label=Email' user@example.com
browser-cli find role button --name "Submit"

# Extract page content
browser-cli markdown

# Stop the daemon
browser-cli stop
```

For the full command reference — including all operations, selector types, semantic locators, and workflow examples — see **[skills/browser-cli/SKILL.md](skills/browser-cli/SKILL.md)**.

### Install as Claude Code Skill

Browser-CLI ships with a [skill definition](skills/browser-cli/SKILL.md) that lets AI agents use it as a tool. To install it in Claude Code:

```bash
# Add the marketplace
/plugin marketplace add six-ddc/browser-cli

# Install the skill
/plugin install browser-cli@six-ddc/browser-cli
```

Once installed, agents can invoke `/browser-cli` directly in Claude Code conversations:

```bash
# /browser-cli navigate to hacker news and get the top 3 stories
```

## Development

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- [Bun](https://bun.sh/) (used to build the CLI)

### Setup

```bash
git clone https://github.com/six-ddc/browser-cli.git
cd browser-cli
pnpm install
pnpm build

# Link the CLI command globally for local development
cd apps/cli && pnpm link --global
```

After linking, the `browser-cli` command will be available system-wide. Changes to the code will be reflected after running `pnpm build` (no need to re-link).

```bash
# Start extension in dev mode (hot reload)
pnpm --filter @browser-cli/extension dev

# Build CLI only
pnpm --filter @browser-cli/cli build

# Run quality checks
pnpm lint          # ESLint
pnpm typecheck     # TypeScript
pnpm test          # Vitest

# Format code
pnpm format
```

To unlink the global command:

```bash
cd apps/cli && pnpm unlink --global
```

## Packages

| Package                  | Path              | Description                                        |
| ------------------------ | ----------------- | -------------------------------------------------- |
| `@browser-cli/cli`       | `apps/cli`        | CLI client + daemon process                        |
| `@browser-cli/extension` | `apps/extension`  | Browser extension — Chrome + Firefox (WXT + React) |
| `@browser-cli/shared`    | `packages/shared` | Protocol types, Zod schemas, constants             |

## License

[MIT](LICENSE)
