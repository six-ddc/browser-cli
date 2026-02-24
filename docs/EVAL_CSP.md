# Eval & CSP: Cross-Platform Strategy

How `browser-cli eval` handles Content Security Policy (CSP) across Chrome and Firefox.

## Problem

Many sites (GitHub, Gmail, x.com, Google Drive) enforce strict CSP that blocks `eval()`:

- `script-src` without `'unsafe-eval'` — blocks `eval()` and `new Function()`
- `require-trusted-types-for 'script'` — blocks `eval()` without a `TrustedScript`
- Service Worker caching — SW-cached responses bypass `webRequest`, so header modification doesn't help

## Eval Tiers

Both platforms follow the same tiered strategy. Each tier falls back to the next on CSP error:

```
Step 1: MAIN world eval (both platforms)
  │  ✓ Full page JS globals visible (window.X, __NEXT_DATA__, etc.)
  │  ✓ DOM access
  │  ✗ Blocked by page CSP on strict sites
  │
  ├─ Chrome Step 2: chrome.userScripts.execute (USER_SCRIPT world)
  │    ✓ Exempt from page CSP
  │    ✓ Full page JS globals visible
  │    ✗ Requires Developer Mode / "Allow User Scripts" in chrome://extensions
  │
  ├─ Firefox Step 2: ISOLATED world eval (content script)
  │    ✓ Exempt from page CSP (uses extension's own CSP)
  │    ✓ DOM access (document, elements, attributes)
  │    ✗ Page JS globals NOT visible (window.X, etc.)
  │
  └─ Step 3: Error with actionable hint
```

## Platform Details

### Chrome (MV3)

| Mechanism                                            | Where                       | Purpose                                    |
| ---------------------------------------------------- | --------------------------- | ------------------------------------------ |
| `scripting.executeScript({ world: 'MAIN' })`         | command-router.ts           | Step 1: MAIN world eval                    |
| Trusted Types policy (`browser-cli-eval`)            | Inside MAIN world func      | Handle `require-trusted-types-for` (Gmail) |
| `chrome.userScripts.execute()`                       | command-router.ts           | Step 2: USER_SCRIPT world (CSP-exempt)     |
| `userScripts.configureWorld({ csp: "unsafe-eval" })` | background.ts (onInstalled) | Pre-configure USER_SCRIPT world CSP        |

**Why not webRequest?** Chrome MV3 `webRequest` is read-only (no `blocking` mode). Header modification requires `declarativeNetRequest`, which can't inject `unsafe-eval` into CSP.

**Requirement**: Developer Mode (or "Allow User Scripts" on Chrome 138+) must be enabled in `chrome://extensions` for the userScripts fallback to work.

### Firefox (MV2)

| Mechanism                                    | Where             | Purpose                                                             |
| -------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| `webRequest.onHeadersReceived` (blocking)    | background.ts     | Strip CSP: inject `unsafe-eval`, remove `require-trusted-types-for` |
| `scripting.executeScript({ world: 'MAIN' })` | command-router.ts | Step 1: MAIN world eval (works when webRequest stripped CSP)        |
| Content script `eval()` in ISOLATED world    | evaluate.ts       | Step 2: fallback for SW-cached pages                                |

**Why ISOLATED world fallback?** Service Worker cached responses bypass `webRequest.onHeadersReceived`, so CSP headers can't be modified. The ISOLATED world uses the extension's own CSP (which allows eval), not the page's.

**Trade-off**: ISOLATED world eval can access DOM (document, elements, attributes) but NOT page JS globals (`window.someVar`, `__NEXT_DATA__`, etc.).

## Key Files

| File                                           | Role                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `apps/extension/src/lib/command-router.ts`     | Evaluate case: tiered eval with auto-fallback                      |
| `apps/extension/src/entrypoints/background.ts` | Firefox webRequest CSP modifier, Chrome userScripts.configureWorld |
| `apps/extension/src/content-lib/evaluate.ts`   | ISOLATED world eval handler (Firefox fallback)                     |
| `apps/extension/src/lib/error-classifier.ts`   | Maps raw CSP errors to structured ProtocolErrors                   |
| `packages/shared/src/protocol/errors.ts`       | `isProtocolError()` type guard, `createError()`                    |

## Error Handling

Errors flow through a single classification point:

```
routeCommand throws
  → handleBackgroundCommand catches
    → isProtocolError(err)? → use directly
    → otherwise → classifyError(err) → pattern match → ProtocolError
```

`classifyError` only handles raw `Error` / string errors. Already-structured `ProtocolError` objects (from `createError()`) are passed through by `handleBackgroundCommand` without re-classification.
