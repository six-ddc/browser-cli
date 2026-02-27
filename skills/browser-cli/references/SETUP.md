# Browser-CLI Setup Guide

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

## Step 4: Connect the Extension

Click the Browser-CLI extension icon in the browser toolbar to open the popup. The extension connects to `ws://127.0.0.1:9222` by default.

- **Default port** — if you started the daemon with `browser-cli start` (port 9222), the extension connects automatically. Wait a few seconds and the status should show **Connected**.
- **Custom port** — if you used `--port`, expand **Settings** in the popup and update the **Daemon URL** (e.g., `ws://127.0.0.1:9333`), then click **Save Changes**.
- **Remote daemon** — for non-loopback URLs (e.g., `wss://my-server.com:9222`), an **Auth Token** field will appear. Paste the token from the daemon startup log.

The extension icon badge indicates the connection state:

| Badge | Color  | Meaning                            |
| ----- | ------ | ---------------------------------- |
| `ON`  | Blue   | Connected                          |
| `...` | Yellow | Disconnected / reconnecting        |
| `KEY` | Red    | Auth failed (token required/wrong) |

## Step 5: Verify

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

The extension is not connected to the daemon.

1. **Check the extension is loaded** — open `chrome://extensions` (Chrome) or `about:debugging` (Firefox) and confirm Browser-CLI extension is present and enabled
2. **Check the popup status** — click the extension icon; if it shows "Disconnected", the daemon URL may not match
3. **Check the port** — the extension connects to `ws://127.0.0.1:9222` by default. If you started the daemon with `--port`, update the URL in the extension popup Settings
4. **Retry connection** — click **Retry connection** in the popup, or toggle the extension off and on
5. **Check service worker logs** — right-click the extension icon → "Inspect popup", or check the service worker console for errors
6. **Restart the daemon** — `browser-cli stop && browser-cli start`

### Extension badge shows `KEY` (auth failed)

The daemon requires a token but the extension has no token or the wrong one.

1. Check the daemon startup log for the auth token
2. Click the extension icon → Settings → paste the token into **Auth Token**
3. Click **Save Changes** — the extension will reconnect automatically

### Extension shows "Disconnected" or connection errors

- Ensure no firewall or proxy blocks `localhost:9222`
- Ensure no other process is using the same WebSocket port
- Try a different port: `browser-cli start --port 9333` and update the extension popup URL accordingly
