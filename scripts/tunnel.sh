#!/usr/bin/env bash
#
# tunnel.sh — Expose the browser-cli daemon WS port via Cloudflare Tunnel
#
# Usage:
#   ./scripts/tunnel.sh          # auto-detect port from running daemon
#   ./scripts/tunnel.sh 9333     # override port manually
#
# The script will:
#   1. Check that cloudflared is installed (guide install if missing)
#   2. Query daemon status via `browser-cli status --json`
#   3. Warn if no auth token is configured (public tunnel = security risk)
#   4. Start a quick tunnel (TryCloudflare, no account needed)
#   5. Print the public WSS URL for use in the browser extension
#   6. Shut down cleanly on Ctrl-C

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${CYAN}[info]${RESET}  $*"; }
warn()  { echo -e "${YELLOW}[warn]${RESET}  $*"; }
error() { echo -e "${RED}[error]${RESET} $*"; }
ok()    { echo -e "${GREEN}[ok]${RESET}    $*"; }

# ── 1. Check dependencies ─────────────────────────────────────────────
for cmd in jq cloudflared; do
  if ! command -v "$cmd" &>/dev/null; then
    error "$cmd is not installed."
    echo ""
    if [[ "$cmd" == "cloudflared" ]]; then
      echo "  See install instructions:"
      echo "  https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
    else
      echo "  Install: apt install jq / brew install jq"
    fi
    echo ""
    exit 1
  fi
done

ok "cloudflared found: $(cloudflared --version 2>&1 | head -1)"

# ── 2. Check daemon status via CLI ───────────────────────────────────
CLI_BIN="browser-cli"
if ! command -v "$CLI_BIN" &>/dev/null; then
  # Try local dev binary
  CLI_BIN="$(dirname "$0")/../node_modules/.bin/browser-cli"
  if [[ ! -x "$CLI_BIN" ]]; then
    CLI_BIN="npx browser-cli"
  fi
fi

info "Querying daemon status..."

STATUS_JSON=$($CLI_BIN status --json 2>/dev/null || echo '{}')

DAEMON_RUNNING=$(echo "$STATUS_JSON" | jq -r '.daemon // false')

if [[ "$DAEMON_RUNNING" != "true" ]]; then
  error "Daemon is not running."
  echo ""
  echo "  Start it first:"
  echo ""
  echo "    browser-cli start               # no auth (local only)"
  echo "    browser-cli start --auth        # with auto-generated auth token (recommended for tunnel)"
  echo "    browser-cli start --token <t>   # with a specific token"
  echo ""
  exit 1
fi
ok "Daemon is running"

# Extract wsPort from status JSON (fall back to arg or 9222)
DETECTED_PORT=$(echo "$STATUS_JSON" | jq -r '.wsPort // empty')
PORT="${1:-${DETECTED_PORT:-9222}}"
info "WebSocket port: ${PORT}"

# ── 3. Check auth token ──────────────────────────────────────────────
AUTH_ENABLED=$(echo "$STATUS_JSON" | jq -r '.authEnabled // false')

if [[ "$AUTH_ENABLED" != "true" ]]; then
  echo ""
  warn "${BOLD}No auth token detected!${RESET}"
  warn "Exposing the daemon to the public internet without an auth token"
  warn "means anyone with the URL can control your browser."
  echo ""
  warn "Recommended: restart the daemon with auth enabled:"
  echo ""
  echo "    browser-cli stop"
  echo "    browser-cli start --auth"
  echo ""
  # Ask user whether to continue
  read -rp "Continue without auth? [y/N] " REPLY
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    info "Aborted. Restart the daemon with --auth and try again."
    exit 0
  fi
  echo ""
else
  ok "Auth token is configured"
fi

# ── 4. Start Cloudflare Tunnel ───────────────────────────────────────
echo ""
info "Starting Cloudflare Tunnel → localhost:${PORT} ..."
info "Press Ctrl-C to stop."
echo ""

CF_LOG=$(mktemp)
trap 'rm -f "$CF_LOG"; kill 0 2>/dev/null' EXIT

cloudflared tunnel --url "http://localhost:${PORT}" \
  --no-autoupdate \
  2>&1 | tee "$CF_LOG" &
CF_PID=$!

# Wait for the public URL to appear (usually ~3-8s)
PUBLIC_URL=""
for _ in $(seq 1 30); do
  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" | head -1 || true)
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo ""
  error "Could not detect public URL. Check cloudflared output above."
  wait "$CF_PID"
  exit 1
fi

# Convert https:// to wss:// for WebSocket usage
WS_URL="${PUBLIC_URL/https:\/\//wss:\/\/}"

echo ""
echo -e "${GREEN}${BOLD}============================================${RESET}"
echo -e "${GREEN}${BOLD}  Tunnel is live!${RESET}"
echo ""
echo -e "  HTTPS : ${CYAN}${PUBLIC_URL}${RESET}"
echo -e "  WSS   : ${CYAN}${BOLD}${WS_URL}${RESET}"
echo ""
echo "  Set this WSS URL in your browser extension"
echo "  to connect from a remote machine."
echo -e "${GREEN}${BOLD}============================================${RESET}"
echo ""

# Keep running until Ctrl-C
wait "$CF_PID"
