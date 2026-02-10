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
- pnpm turbo lint/typecheck/test — quality checks
- pnpm --filter @browser-cli/extension dev — extension dev mode
- pnpm --filter @browser-cli/cli build — CLI build
- browser-cli start/stop/status — daemon lifecycle

## Packages
- packages/shared — protocol types, Zod schemas, constants (raw .ts exports, no build)
- apps/cli — Commander.js CLI + daemon process (tsup ESM build)
- apps/extension — WXT + React browser extension (Vite build)

## Conventions
- Shared package exports raw .ts (no build step), consumers bundle it
- CLI uses tsup with noExternal: ['@browser-cli/shared'] to bundle shared code
- CLI has two entry points: src/index.ts (CLI client) and src/daemon/index.ts (daemon)
- Extension tsconfig extends .wxt/tsconfig.json (run wxt prepare first)
- Extension typecheck: wxt prepare && tsc --noEmit
- All actions defined as discriminated union on 'action' field in packages/shared/src/protocol/actions.ts
- Element refs (@e1, @e2) map to CSS selectors via RefMap in content script
- Content script runs in isolated world; evaluate/console use MAIN world injection
- CLI ↔ Daemon uses NDJSON over Unix socket
- Daemon ↔ Extension uses JSON over WebSocket

## Development Principles

### Backward Compatibility
- **NOT REQUIRED**: Browser-CLI is in active development. Breaking changes are acceptable.
- Focus on correctness and W3C compliance over backward compatibility
- Document breaking changes in COMPARISON_WITH_AGENT_BROWSER.md
- Update version number appropriately (major version bump for breaking changes)

### ARIA Implementation
- Uses standard libraries (aria-api, dom-accessibility-api) for W3C compliance
- Provides fallback for test environments (happy-dom) that don't support all CSS selectors
- Label/placeholder locators default to exact matching (aligns with Playwright/Testing Library)

## Gotchas
- WXT + Vite 7 requires Node >= 20 (crypto.hash API)
- tsup temp files (*.bundled_*.mjs) can race with ESLint — avoid concurrent lint + build
- Extension CSP must include `connect-src ws://localhost:*` for WS connections
- chrome.tabs.sendMessage only works on http/https pages (not chrome://, extension pages)
- fill() must use native value setter to work with React/Vue controlled components
- Daemon socket path: ~/.browser-cli/{session}.sock (Unix) or TCP port (Windows)
