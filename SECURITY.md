# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue.
2. Email the maintainer or use [GitHub's private vulnerability reporting](https://github.com/six-ddc/browser-cli/security/advisories/new).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.

We will acknowledge receipt within 48 hours and aim to release a fix promptly.

## Security Considerations

Browser-CLI is a browser automation tool with elevated permissions by design:

- **Extension permissions**: The extension requires `<all_urls>`, `tabs`, `cookies`, `scripting`, and `storage` permissions to function.
- **Local-only communication**: The daemon binds to `127.0.0.1` only — it does not accept remote connections.
- **evaluate command**: Executes arbitrary JavaScript in the page's MAIN world. Only use with trusted input.
- **Unix socket**: The daemon socket is created in `~/.browser-cli/` with default file permissions.
