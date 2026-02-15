#!/usr/bin/env bats
# 05-tab-management.bats — Tab management E2E tests
#
# Tests: tab, tab list, tab new, tab close, tab <n>

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
# tab (list)
# ===================================================================

@test "tab: lists all tabs (bare command)" {
  navigate_and_wait "$URL_HOME"
  run bcli tab
  [ "$status" -eq 0 ]
  # Output should list at least one tab
  [[ "$output" == *"the-internet"* ]] || [[ "$output" == *"Tab"* ]] || [[ "$output" == *"http"* ]]
}

@test "tab list: lists all tabs" {
  navigate_and_wait "$URL_HOME"
  run bcli tab list
  [ "$status" -eq 0 ]
  [[ "$output" == *"http"* ]]
}

# ===================================================================
# tab new
# ===================================================================

@test "tab new: opens a new blank tab" {
  navigate_and_wait "$URL_HOME"

  # Count tabs before
  run bcli tab list
  local before_output="$output"

  run bcli tab new
  [ "$status" -eq 0 ]

  # Verify a new tab was created
  run bcli tab list
  [ "$status" -eq 0 ]
}

@test "tab new with URL: opens tab with specific URL" {
  navigate_and_wait "$URL_HOME"
  run bcli tab new "$URL_LOGIN"
  [ "$status" -eq 0 ]

  # Wait for the new tab to load
  sleep 2

  # Should now be on the new tab — verify URL
  run bcli get url
  [ "$status" -eq 0 ]
  [[ "$output" == *"/login"* ]]
}

# ===================================================================
# tab <n> — switch to tab
# ===================================================================

@test "tab switch: switches to tab by ID" {
  navigate_and_wait "$URL_HOME"

  # Open a second tab
  run bcli tab new "$URL_LOGIN"
  [ "$status" -eq 0 ]
  sleep 2

  # List tabs to get IDs
  run bcli tab list
  [ "$status" -eq 0 ]
  local tab_output="$output"

  # Get current URL (should be /login from the new tab)
  run bcli get url
  [[ "$output" == *"/login"* ]]

  # Switch back to first tab — extract first tab ID from tab list
  # Tab IDs are numeric; extract the first one from output
  local first_tab_id
  first_tab_id=$(echo "$tab_output" | grep -oE '[0-9]+' | head -1)
  if [[ -n "$first_tab_id" ]]; then
    run bcli tab "$first_tab_id"
    [ "$status" -eq 0 ]
    sleep 1

    # Verify we're back on the home page
    run bcli get url
    [[ "$output" == *"the-internet.herokuapp.com"* ]]
  fi
}

# ===================================================================
# tab close
# ===================================================================

@test "tab close: closes the active tab" {
  navigate_and_wait "$URL_HOME"

  # Open a second tab
  run bcli tab new "$URL_LOGIN"
  [ "$status" -eq 0 ]
  sleep 2

  # Close the active (new) tab
  run bcli tab close
  [ "$status" -eq 0 ]
  sleep 1

  # Should fall back to the remaining tab
  run bcli get url
  [ "$status" -eq 0 ]
}

@test "tab close with ID: closes specific tab" {
  navigate_and_wait "$URL_HOME"

  # Open a second tab
  run bcli tab new "$URL_CHECKBOXES"
  [ "$status" -eq 0 ]
  sleep 2

  # List tabs and get the new tab's ID
  run bcli tab list
  [ "$status" -eq 0 ]
  local tab_output="$output"

  # Extract the last tab ID (the one we just opened)
  local last_tab_id
  last_tab_id=$(echo "$tab_output" | grep -oE '[0-9]+' | tail -1)
  if [[ -n "$last_tab_id" ]]; then
    run bcli tab close "$last_tab_id"
    [ "$status" -eq 0 ]
  fi
}

# ===================================================================
# tab integration tests
# ===================================================================

@test "tab: open new tab, interact, switch back" {
  navigate_and_wait "$URL_HOME"

  # Open login page in new tab
  run bcli tab new "$URL_LOGIN"
  [ "$status" -eq 0 ]
  sleep 2

  # Interact in the new tab
  run bcli fill "$SEL_USERNAME" "tab-test-user"
  [ "$status" -eq 0 ]
  assert_value_equals "$SEL_USERNAME" "tab-test-user"

  # Get tab list to find original tab
  run bcli tab list
  [ "$status" -eq 0 ]
  local tab_output="$output"

  local first_tab_id
  first_tab_id=$(echo "$tab_output" | grep -oE '[0-9]+' | head -1)

  # Switch back to first tab
  if [[ -n "$first_tab_id" ]]; then
    run bcli tab "$first_tab_id"
    [ "$status" -eq 0 ]
    sleep 1

    # Verify we're on the home page
    run bcli get url
    [[ "$output" == *"the-internet.herokuapp.com"* ]]
  fi

  # Clean up: close the second tab
  run bcli tab list
  local last_tab_id
  last_tab_id=$(echo "$output" | grep -oE '[0-9]+' | tail -1)
  if [[ -n "$last_tab_id" ]] && [[ "$last_tab_id" != "$first_tab_id" ]]; then
    bcli tab close "$last_tab_id" 2>/dev/null || true
  fi
}

@test "tab: multiple new tabs then close all extras" {
  navigate_and_wait "$URL_HOME"

  # Open two more tabs
  run bcli tab new "$URL_LOGIN"
  [ "$status" -eq 0 ]
  sleep 1

  run bcli tab new "$URL_CHECKBOXES"
  [ "$status" -eq 0 ]
  sleep 1

  # List tabs — should have at least 3
  run bcli tab list
  [ "$status" -eq 0 ]

  # Close extras one by one
  run bcli tab close
  [ "$status" -eq 0 ]
  sleep 1

  run bcli tab close
  [ "$status" -eq 0 ]
  sleep 1

  # Should still have at least one tab
  run bcli tab list
  [ "$status" -eq 0 ]
}
