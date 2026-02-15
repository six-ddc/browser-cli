#!/usr/bin/env bash
# setup_suite.bash — BATS suite-level setup/teardown for browser-cli E2E tests
#
# This file is automatically loaded by bats-core before/after the entire test suite.
# It manages the daemon lifecycle so each test file doesn't need to start/stop it.

# Resolve project root (two levels up from test/e2e/)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# CLI binary path (built output)
export BROWSER_CLI="${REPO_ROOT}/apps/cli/bin/cli.js"

# Timeout for daemon readiness (seconds)
DAEMON_READY_TIMEOUT="${DAEMON_READY_TIMEOUT:-15}"

# Session name for E2E tests (avoid collision with user sessions)
export BROWSER_CLI_SESSION="${BROWSER_CLI_SESSION:-e2e-test}"

setup_suite() {
  # Ensure CLI is built
  if [[ ! -f "$BROWSER_CLI" ]]; then
    echo "ERROR: CLI not built. Run 'pnpm build' first." >&2
    return 1
  fi

  # Stop any existing daemon from a previous run
  node "$BROWSER_CLI" stop --session "$BROWSER_CLI_SESSION" 2>/dev/null || true

  # Start the daemon
  node "$BROWSER_CLI" start --session "$BROWSER_CLI_SESSION" 2>/dev/null
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo "ERROR: Failed to start daemon (exit code $rc)" >&2
    return 1
  fi

  # Wait for the daemon to be ready (socket file exists)
  local socket_dir="${HOME}/.browser-cli"
  local elapsed=0
  while [[ $elapsed -lt $DAEMON_READY_TIMEOUT ]]; do
    if ls "${socket_dir}/${BROWSER_CLI_SESSION}"*.sock 1>/dev/null 2>&1; then
      break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  if [[ $elapsed -ge $DAEMON_READY_TIMEOUT ]]; then
    echo "ERROR: Daemon did not become ready within ${DAEMON_READY_TIMEOUT}s" >&2
    return 1
  fi

  # Wait for extension connection
  elapsed=0
  local ext_timeout=30
  while [[ $elapsed -lt $ext_timeout ]]; do
    local status_output
    status_output=$(node "$BROWSER_CLI" status --session "$BROWSER_CLI_SESSION" 2>&1) || true
    if echo "$status_output" | grep -qi "extension.*connected\|connected.*extension"; then
      export DAEMON_STARTED=1
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "WARNING: Extension not connected after ${ext_timeout}s. Tests requiring extension will fail." >&2
  export DAEMON_STARTED=1
}

teardown_suite() {
  if [[ "${DAEMON_STARTED:-0}" == "1" ]]; then
    node "$BROWSER_CLI" stop --session "$BROWSER_CLI_SESSION" 2>/dev/null || true
  fi
}
