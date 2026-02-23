# CLAUDE.md

## Project Overview

Browser-CLI: Extension-based browser automation CLI that replicates agent-browser capabilities
without Playwright. Uses a Chrome extension + daemon architecture.

## Architecture

- Three-layer: CLI (client) → Daemon (WS server + socket server) → Extension (WS client)
- CLI connects to Daemon via Unix socket (~/.browser-cli/{session}.sock)
- Daemon runs WS server on localhost:9222 for Extension connection
- Extension background SW routes commands to chrome APIs or content scripts
- Protocol defined in packages/shared/src/protocol/

## Key Commands

- pnpm install && pnpm build — full build
- pnpm turbo lint/typecheck/test — quality checks (unit tests)
- pnpm test:e2e — E2E tests (Playwright, auto-starts daemon + extension)
- pnpm --filter @browser-cli/extension dev — extension dev mode
- pnpm --filter @browser-cli/cli build — CLI build
- browser-cli start/stop/status — daemon lifecycle

## Packages

- packages/shared — protocol types, Zod schemas, constants (raw .ts exports, no build)
- apps/cli — Commander.js CLI + daemon process (tsdown ESM build)
- apps/extension — WXT + React browser extension (Vite build)

## Conventions

- Shared package exports raw .ts (no build step), consumers bundle it
- CLI uses tsdown with noExternal: ['@browser-cli/shared'] to bundle shared code
- CLI has two entry points: src/index.ts (CLI client) and src/daemon/index.ts (daemon)
- Extension tsconfig extends .wxt/tsconfig.json (run wxt prepare first)
- Extension typecheck: wxt prepare && tsc --noEmit
- All actions defined as discriminated union on 'action' field in packages/shared/src/protocol/actions.ts
- Element refs (@e1, @e2) map to CSS selectors via RefMap in content script
- Content script runs in isolated world; evaluate uses background `chrome.scripting.executeScript({ world: 'MAIN' })` to bypass CSP
- CLI ↔ Daemon uses NDJSON over Unix socket
- Daemon ↔ Extension uses JSON over WebSocket

## Documentation

### Single Source of Truth

- **`skills/skills/browser-cli/SKILL.md`** is the authoritative CLI command reference.
- Whenever CLI behavior changes — adding, removing, or modifying commands, options, flags, or syntax — **you MUST update SKILL.md** in the same changeset.
- README.md only contains a brief usage snippet and links to SKILL.md; do NOT duplicate command details in README.md.

## Development Principles

### Backward Compatibility

- **NOT REQUIRED**: Browser-CLI is in active development. Breaking changes are acceptable.
- Focus on correctness and W3C compliance over backward compatibility
- Document breaking changes in COMPARISON_WITH_AGENT_BROWSER.md
- Update version number appropriately (major version bump for breaking changes)

### ARIA Implementation

- Uses standard libraries (aria-api, dom-accessibility-api) for W3C compliance
- Provides fallback for test environments (jsdom) that don't support all CSS selectors

### Semantic Locator Syntax (AgentBrowser-compatible)

- Uses `=` delimiter: `text=Submit`, `role=button`, `label=Email`, `xpath=//button`
- Role name via bracket: `role=button[name="Submit"]`
- Quoted value for exact match: `text="Submit"`, `label="Email"`
- Bracket options: `[exact]`, `[hidden]`
- XPath: `xpath=//button[@type="submit"]`
- TestID always exact, case-sensitive: `testid=login-button`

### Find Command (AgentBrowser-compatible)

- `find <engine> <value> [action] [action-value]` — locate + act in one step
- Action defaults to `click` when omitted
- Engines: role, text, label, placeholder, alt, title, testid, xpath
- Position selectors: first, last, nth (e.g., `find nth 2 ".item" click`)
- Options: `--name` (for role), `--exact` (exact text match)
- Actions: click, dblclick, fill, type, hover, check, uncheck, select, press, clear, focus

### Error Message Design

- Error messages are consumed by AI agents, not just humans
- Every error must include a clear description of what went wrong
- Every error should include a `hint` suggesting what the AI should do next
- Use specific error codes (not catch-all `CONTENT_SCRIPT_ERROR`) — map to the closest `ErrorCode`
- Translate browser-internal errors (e.g., "Receiving end does not exist") into understandable language
- Error classifier in `apps/extension/src/lib/error-classifier.ts` maps Chrome errors to structured errors

### Snapshot Flags (AgentBrowser-compatible)

- `-i` / `--interactive` — only interactive elements
- `-c` / `--compact` — compact output
- `-C` / `--cursor` — include cursor-interactive elements (cursor:pointer)
- `-d` / `--depth <n>` — max tree depth
- `-s` / `--selector <sel>` — scope to element

### Command Syntax (AgentBrowser-compatible)

- `press <key>` — page-level key press (no selector, alias: `key`)
- `wait <selector>` / `wait <ms>` / `wait --url <pattern>` — unified wait
- `tab` / `tab <n>` / `tab new` / `tab close` — tab management
- `frame <selector>` / `frame main` / `frame list` — frame management
- `get url` / `get title` / `get count` / `get box` — data queries as subcommands
- `cookies set <name> <value> --url <url>` — positional args for cookie set
- `storage local [key]` / `storage session [key]` — area as subcommand
- `network route <pattern> --abort` — use --abort (not --block)

## Testing

### Unit Tests

- Vitest for parsing, building, and formatting logic
- Run with `pnpm test` or `pnpm turbo test`

### E2E Tests (Playwright)

- Automated E2E tests using Playwright with real Chrome + extension
- CLI operates, Playwright provides independent browser state verification
- Local HTML fixture pages (no external dependencies)
- Auto-starts daemon and loads extension via `--load-extension`
- Full guide: see `docs/TESTING_E2E.md`

**Run tests:**

```bash
pnpm test:e2e           # All E2E tests
pnpm test:e2e:basic     # Basic commands (navigation, interaction, selectors)
pnpm test:e2e:advanced  # Advanced features (find, semantic locators, position selectors)
pnpm test:e2e:data      # Data queries (get, is, wait)
pnpm test:e2e:state     # Browser state (cookies, storage)
pnpm test:e2e:cross     # Cross-command interactions, --json flag
```

### Manual Testing

- Reference implementation: `.agent-browser-ref/` (clone of vercel-labs/agent-browser, in .gitignore)

## Gotchas

- WXT + Vite 7 requires Node >= 20 (crypto.hash API)
- tsdown (Rolldown) requires Node ^20.19.0 for native bindings — .npmrc has node-version=20.19.0
- Extension CSP must include `connect-src ws://localhost:*` for WS connections
- chrome.tabs.sendMessage only works on http/https pages (not chrome://, extension pages)
- fill() must use native value setter to work with React/Vue controlled components
- Daemon socket path: ~/.browser-cli/{session}.sock (Unix) or TCP port (Windows)
