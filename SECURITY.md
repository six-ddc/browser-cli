# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue.
2. Email the maintainer or use [GitHub's private vulnerability reporting](https://github.com/six-ddc/browser-cli/security/advisories/new).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.

We will acknowledge receipt within 48 hours and aim to release a fix promptly.

## Security Considerations

Browser-CLI is a browser automation tool with elevated permissions by design:

- **Extension permissions**: The extension requires `<all_urls>`, `tabs`, `cookies`, `scripting`, `webNavigation`, and `storage` permissions to function.
- **URL scheme blocking**: Navigation commands (`navigate`, `tab new`, `window new`) block dangerous URL schemes (`javascript:`, `data:`, `vbscript:`).
- **evaluate command**: Executes arbitrary JavaScript in the page's MAIN world. Only use with trusted input.
- **Unix socket**: The daemon socket is created in `~/.browser-cli/` with default file permissions. Any process running as your user can talk to it and drive the browser.

### WebSocket origin enforcement

The daemon binds its WebSocket server to `127.0.0.1` by default. **This alone does not
make it private.** Any web page you visit can run `new WebSocket('ws://127.0.0.1:9222')`:
the connection originates from your own browser, so a loopback bind does nothing to stop
it. Before this was enforced, a malicious page could have driven your browser through the
daemon — reading cookies, navigating, exfiltrating page content.

Every handshake is therefore checked against its `Origin` header:

| Origin                                                               | Verdict                             |
| -------------------------------------------------------------------- | ----------------------------------- |
| `chrome-extension://`, `moz-extension://`, `safari-web-extension://` | accepted                            |
| Any web origin (`https://`, `http://`, `file://`, `null`)            | rejected with HTTP 403              |
| No `Origin` header (non-browser client)                              | accepted, subject to the auth token |

Browsers set `Origin` themselves and a page cannot override it, so this reliably separates
the extension from a page. The check is always on and cannot be disabled.

Two limits worth stating plainly:

- The scheme is checked, not the extension ID. Any extension installed in your browser can
  connect, not only Browser-CLI's own.
- A client that sends no `Origin` header is not a browser — it is a script or test harness
  connecting directly. On loopback without `--auth` there is no token (see below), so such
  clients are accepted unconditionally. **Any process running as your user can drive your
  browser through the daemon**, the same exposure as the Unix socket noted above. Origin
  enforcement keeps web pages out; it is not a defence against local code.

### Auth token

When binding to a non-loopback host (`--ws-host`) or with `--auth`, a random 32-byte token
is required in the handshake message. It is stored at `~/.browser-cli/auth-token` with
`0600` permissions, and shown once at daemon startup so it can be pasted into the extension
popup. On loopback without `--auth` no token is required; origin enforcement is what keeps
web pages out.

### Action policy is not a security boundary

`--policy` (see SKILL.md) restricts which actions a CLI invocation may perform. It is
enforced inside the CLI process only — the daemon does not re-check. Anything that speaks
to `~/.browser-cli/daemon.sock` directly is unconstrained, as is a second `browser-cli`
invocation started without `--policy`. Use it to keep a cooperating agent in its lane, not
to contain untrusted code.
