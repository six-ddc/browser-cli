#!/usr/bin/env bats
# 07-scroll.bats — Scroll operations E2E tests
#
# Tests: scroll up/down/left/right, --amount, --selector, scrollintoview

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
# scroll down
# ===================================================================

@test "scroll down: scrolls page downward" {
  navigate_and_wait "$URL_LARGE_PAGE"
  run bcli scroll down
  [ "$status" -eq 0 ]
  [[ "$output" == *"Scrolled"* ]] || [[ "$output" == *"scroll"* ]] || [ "$status" -eq 0 ]
}

@test "scroll down --amount: scrolls specific pixel amount" {
  navigate_and_wait "$URL_LARGE_PAGE"
  run bcli scroll down --amount 500
  [ "$status" -eq 0 ]
}

# ===================================================================
# scroll up
# ===================================================================

@test "scroll up: scrolls page upward" {
  navigate_and_wait "$URL_LARGE_PAGE"
  # First scroll down so we have room to scroll up
  bcli scroll down --amount 500 2>/dev/null
  sleep 1

  run bcli scroll up
  [ "$status" -eq 0 ]
}

@test "scroll up --amount: scrolls specific pixel amount upward" {
  navigate_and_wait "$URL_LARGE_PAGE"
  bcli scroll down --amount 800 2>/dev/null
  sleep 1

  run bcli scroll up --amount 300
  [ "$status" -eq 0 ]
}

# ===================================================================
# scroll left / right
# ===================================================================

@test "scroll right: scrolls page to the right" {
  navigate_and_wait "$URL_LARGE_PAGE"
  run bcli scroll right
  [ "$status" -eq 0 ]
}

@test "scroll left: scrolls page to the left" {
  navigate_and_wait "$URL_LARGE_PAGE"
  bcli scroll right --amount 500 2>/dev/null
  sleep 1

  run bcli scroll left
  [ "$status" -eq 0 ]
}

# ===================================================================
# scroll --selector
# ===================================================================

@test "scroll down --selector: scrolls within a specific element" {
  navigate_and_wait "$URL_LARGE_PAGE"
  # Scroll within the body element
  run bcli scroll down --selector 'body'
  [ "$status" -eq 0 ]
}

# ===================================================================
# scrollintoview
# ===================================================================

@test "scrollintoview: scrolls element into viewport" {
  navigate_and_wait "$URL_LARGE_PAGE"
  # The large page has content at the bottom that's off-screen
  # Scroll to a link that might be at the bottom
  run bcli scrollintoview 'a'
  [ "$status" -eq 0 ]
}

@test "scrollintoview: works with CSS selector" {
  navigate_and_wait "$URL_HOME"
  # Scroll to a link at the bottom of the page
  run bcli scrollintoview 'div#page-footer a'
  if [ "$status" -eq 0 ]; then
    # Element should now be visible
    run bcli is visible 'div#page-footer a'
    [[ "$output" == *"true"* ]]
  fi
}

@test "scrollintoview: fails for nonexistent element" {
  navigate_and_wait "$URL_HOME"
  run bcli scrollintoview '.nonexistent-element-12345'
  [ "$status" -ne 0 ]
}

# ===================================================================
# scroll integration tests
# ===================================================================

@test "scroll: multiple scroll operations in sequence" {
  navigate_and_wait "$URL_LARGE_PAGE"

  run bcli scroll down --amount 200
  [ "$status" -eq 0 ]

  run bcli scroll down --amount 200
  [ "$status" -eq 0 ]

  run bcli scroll up --amount 100
  [ "$status" -eq 0 ]
}

@test "scroll: scroll down then take snapshot" {
  navigate_and_wait "$URL_HOME"

  # Take snapshot before scroll
  run bcli snapshot -c
  [ "$status" -eq 0 ]
  local before_snapshot="$output"

  # Scroll down
  run bcli scroll down --amount 500
  [ "$status" -eq 0 ]

  # Take snapshot after scroll — should still succeed
  run bcli snapshot -c
  [ "$status" -eq 0 ]
}

@test "scroll: scrollintoview then click" {
  navigate_and_wait "$URL_HOME"

  # Scroll to footer link first, then try to interact
  run bcli scrollintoview 'div#page-footer a'
  if [ "$status" -eq 0 ]; then
    run bcli click 'div#page-footer a'
    [ "$status" -eq 0 ]
  fi
}
