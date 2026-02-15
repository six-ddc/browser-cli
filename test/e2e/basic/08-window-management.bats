#!/usr/bin/env bats
# 08-window-management.bats — Window management E2E tests
#
# Tests: window, window list, window new, window close

# Load BATS helpers
load "../helpers/daemon.bash"
load "../helpers/assertions.bash"
load "../helpers/fixtures.bash"

# Load bats-support and bats-assert from node_modules
REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)"
load "${REPO_ROOT}/node_modules/bats-support/load.bash"
load "${REPO_ROOT}/node_modules/bats-assert/load.bash"

# ---------------------------------------------------------------------------
# Setup / Teardown
# ---------------------------------------------------------------------------

setup() {
  ensure_daemon_ready
}

# ===================================================================
# window (list)
# ===================================================================

@test "window: lists all windows (bare command)" {
  navigate_and_wait "$URL_HOME"
  run bcli window
  [ "$status" -eq 0 ]
  [[ -n "$output" ]]
}

@test "window list: lists all windows" {
  navigate_and_wait "$URL_HOME"
  run bcli window list
  [ "$status" -eq 0 ]
  [[ -n "$output" ]]
}

# ===================================================================
# window new
# ===================================================================

@test "window new: opens a new window" {
  navigate_and_wait "$URL_HOME"
  run bcli window new
  [ "$status" -eq 0 ]
  sleep 2

  # Clean up: close the new window
  run bcli window list
  local window_output="$output"
  local last_window_id
  last_window_id=$(echo "$window_output" | grep -oE '[0-9]+' | tail -1)
  if [[ -n "$last_window_id" ]]; then
    bcli window close "$last_window_id" 2>/dev/null || true
  fi
}

@test "window new with URL: opens window with specific URL" {
  navigate_and_wait "$URL_HOME"
  run bcli window new "$URL_LOGIN"
  [ "$status" -eq 0 ]
  sleep 2

  # Should be on the new window with /login URL
  run bcli get url
  [ "$status" -eq 0 ]
  [[ "$output" == *"/login"* ]]

  # Clean up: close the new window
  run bcli window list
  local last_window_id
  last_window_id=$(echo "$output" | grep -oE '[0-9]+' | tail -1)
  if [[ -n "$last_window_id" ]]; then
    bcli window close "$last_window_id" 2>/dev/null || true
    sleep 1
  fi
}

# ===================================================================
# window close
# ===================================================================

@test "window close: closes a window" {
  navigate_and_wait "$URL_HOME"

  # Open a new window first
  run bcli window new "$URL_CHECKBOXES"
  [ "$status" -eq 0 ]
  sleep 2

  # Close the current (new) window
  run bcli window close
  [ "$status" -eq 0 ]
  sleep 1

  # Should still have the original window
  run bcli window list
  [ "$status" -eq 0 ]
}

# ===================================================================
# window integration tests
# ===================================================================

@test "window: open new window, interact, close" {
  navigate_and_wait "$URL_HOME"

  # Open login page in a new window
  run bcli window new "$URL_LOGIN"
  [ "$status" -eq 0 ]
  sleep 2

  # Interact in the new window
  run bcli fill "$SEL_USERNAME" "window-test"
  [ "$status" -eq 0 ]
  assert_value_equals "$SEL_USERNAME" "window-test"

  # Close the window
  run bcli window close
  [ "$status" -eq 0 ]
  sleep 1

  # Original window should still work
  run bcli get url
  [ "$status" -eq 0 ]
}
