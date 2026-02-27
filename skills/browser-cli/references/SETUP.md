# Browser-CLI Setup Guide

This guide helps diagnose and resolve setup issues when `browser-cli status` fails or shows no connected sessions.

## Prerequisites

- **Node.js >= 20**
- **Chrome / Chromium** or **Firefox**

## Step 1: Install the CLI

```bash
npm install -g @browser-cli/cli
```

Verify installation:

```bash
browser-cli --version
```

If the command is not found, ensure the npm global bin directory is in your `PATH`.

## Step 2: Install the Browser Extension

The browser extension is **required** — it bridges the CLI daemon and the browser.

Download the latest extension from [GitHub Releases](https://github.com/six-ddc/browser-cli/releases).

### Chrome / Chromium

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the extracted extension folder

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the extension zip file

> Firefox temporary add-ons are removed when the browser restarts. For persistent installation, use a signed extension.

## Step 3: Start the Daemon

```bash
browser-cli start              # default WebSocket port 9222
browser-cli start --port 9333  # custom port
```

## Step 4: Verify Connection

```bash
browser-cli status
```

A healthy output shows at least one connected session:

```
Daemon running (PID 12345)
Sessions:
  brave-falcon (connected)
    Extension: Chrome 120.0
    Tabs: 5
```

## Troubleshooting

### `browser-cli: command not found`

The CLI is not installed or not in your PATH.

```bash
npm install -g @browser-cli/cli
```

### `status` shows "Daemon not running"

The daemon process is not started.

```bash
browser-cli start
```

### `status` shows daemon running but sessions list is empty

The extension is either not installed or not connected to the daemon.

1. **Check the extension is loaded** — open `chrome://extensions` (Chrome) or `about:debugging` (Firefox) and confirm Browser-CLI extension is present and enabled
2. **Check the WebSocket port** — the extension connects to `ws://localhost:9222` by default. If you started the daemon with `--port`, the extension must use the same port
3. **Restart the extension** — toggle it off and on in the extensions page, or click the extension icon and reconnect
4. **Check browser console** — right-click the extension icon → "Inspect popup" or check the service worker logs for connection errors
5. **Restart the daemon** — `browser-cli stop && browser-cli start`

### Extension shows "Disconnected" or connection errors

- Ensure no firewall or proxy blocks `localhost:9222`
- Ensure no other process is using the same WebSocket port
- Try a different port: `browser-cli start --port 9333` and update the extension accordingly
