#!/usr/bin/env bash
# helpers/daemon.bash — Daemon utility functions for browser-cli E2E tests

# Resolve paths
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
export BROWSER_CLI="${BROWSER_CLI:-${REPO_ROOT}/apps/cli/bin/cli.js}"
export BROWSER_CLI_SESSION="${BROWSER_CLI_SESSION:-e2e-test}"

# Default timeouts (seconds)
export BCLI_NAV_TIMEOUT="${BCLI_NAV_TIMEOUT:-10}"
export BCLI_CMD_TIMEOUT="${BCLI_CMD_TIMEOUT:-10}"
export BCLI_PAGE_LOAD_WAIT="${BCLI_PAGE_LOAD_WAIT:-2}"

# ---------------------------------------------------------------------------
# bcli — run a browser-cli command with session flag
# Usage: bcli <subcommand> [args...]
# ---------------------------------------------------------------------------
bcli() {
  node "$BROWSER_CLI" --session "$BROWSER_CLI_SESSION" "$@"
}

# ---------------------------------------------------------------------------
# ensure_daemon_ready — verify the daemon is running and extension connected
# Returns 0 if ready, 1 otherwise
# ---------------------------------------------------------------------------
ensure_daemon_ready() {
  local status_output
  status_output=$(bcli status 2>&1) || true

  if echo "$status_output" | grep -qi "daemon.*running\|running"; then
    return 0
  fi

  echo "Daemon is not ready. Status output:" >&2
  echo "$status_output" >&2
  return 1
}

# ---------------------------------------------------------------------------
# navigate_and_wait — navigate to URL and wait for the page to settle
# Usage: navigate_and_wait <url> [wait_ms]
# ---------------------------------------------------------------------------
navigate_and_wait() {
  local url="$1"
  local wait_seconds="${2:-$BCLI_PAGE_LOAD_WAIT}"

  bcli navigate "$url"
  sleep "$wait_seconds"
}

# ---------------------------------------------------------------------------
# wait_for_page_load — wait for current page to finish loading
# Usage: wait_for_page_load [timeout_seconds]
# ---------------------------------------------------------------------------
wait_for_page_load() {
  local timeout="${1:-$BCLI_NAV_TIMEOUT}"
  bcli wait --load --timeout "$((timeout * 1000))" 2>/dev/null || sleep 2
}

# ---------------------------------------------------------------------------
# get_current_url — get the current page URL (trimmed)
# Usage: url=$(get_current_url)
# ---------------------------------------------------------------------------
get_current_url() {
  bcli get url 2>/dev/null | tr -d '[:space:]'
}

# ---------------------------------------------------------------------------
# selector_exists — check if a CSS selector matches any elements on the page
# Usage: selector_exists <selector>
# Returns 0 if elements found, 1 otherwise
# ---------------------------------------------------------------------------
selector_exists() {
  local selector="$1"
  local count
  count=$(bcli get count "$selector" 2>/dev/null | tr -d '[:space:]') || return 1

  if [[ "$count" =~ ^[0-9]+$ ]] && [[ "$count" -gt 0 ]]; then
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# get_element_text — get text content of an element
# Usage: text=$(get_element_text <selector>)
# ---------------------------------------------------------------------------
get_element_text() {
  local selector="$1"
  bcli get text "$selector" 2>/dev/null
}

# ---------------------------------------------------------------------------
# get_element_value — get the value of an input element
# Usage: value=$(get_element_value <selector>)
# ---------------------------------------------------------------------------
get_element_value() {
  local selector="$1"
  bcli get value "$selector" 2>/dev/null
}

# ---------------------------------------------------------------------------
# get_element_attr — get an attribute value from an element
# Usage: attr=$(get_element_attr <selector> <attribute>)
# ---------------------------------------------------------------------------
get_element_attr() {
  local selector="$1"
  local attr="$2"
  bcli get attr "$selector" "$attr" 2>/dev/null
}

# ---------------------------------------------------------------------------
# is_element_visible — check if element is visible
# Usage: is_element_visible <selector>
# Returns 0 if visible, 1 otherwise
# ---------------------------------------------------------------------------
is_element_visible() {
  local selector="$1"
  local result
  result=$(bcli is visible "$selector" 2>/dev/null | tr -d '[:space:]') || return 1

  if [[ "$result" == "true" ]]; then
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# is_element_checked — check if a checkbox/radio is checked
# Usage: is_element_checked <selector>
# Returns 0 if checked, 1 otherwise
# ---------------------------------------------------------------------------
is_element_checked() {
  local selector="$1"
  local result
  result=$(bcli is checked "$selector" 2>/dev/null | tr -d '[:space:]') || return 1

  if [[ "$result" == "true" ]]; then
    return 0
  fi
  return 1
}
