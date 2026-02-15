#!/usr/bin/env bats
# 17-highlight.bats — Element highlight E2E tests
#
# Tests: highlight <selector>, --color, --duration

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
# highlight (default)
# ===================================================================

@test "highlight: highlights element by CSS selector" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight "$SEL_LOGIN_BTN"
  [ "$status" -eq 0 ]
}

@test "highlight: highlights input element" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight "$SEL_USERNAME"
  [ "$status" -eq 0 ]
}

@test "highlight: highlights heading element" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight 'h2'
  [ "$status" -eq 0 ]
}

# ===================================================================
# highlight --color
# ===================================================================

@test "highlight --color: uses custom color" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight "$SEL_LOGIN_BTN" --color '#FF0000'
  [ "$status" -eq 0 ]
}

@test "highlight --color: accepts named color" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight "$SEL_USERNAME" --color 'red'
  [ "$status" -eq 0 ]
}

# ===================================================================
# highlight --duration
# ===================================================================

@test "highlight --duration: highlights for custom duration" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight "$SEL_LOGIN_BTN" --duration 500
  [ "$status" -eq 0 ]
}

@test "highlight --duration: short duration completes quickly" {
  navigate_and_wait "$URL_LOGIN"
  local start_time=$SECONDS
  run bcli highlight "$SEL_USERNAME" --duration 100
  [ "$status" -eq 0 ]
}

# ===================================================================
# highlight — combined options
# ===================================================================

@test "highlight: custom color and duration together" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight "$SEL_LOGIN_BTN" --color '#00FF00' --duration 300
  [ "$status" -eq 0 ]
}

# ===================================================================
# highlight — error handling
# ===================================================================

@test "highlight: fails for nonexistent element" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight '.nonexistent-element-12345'
  [ "$status" -ne 0 ]
}

# ===================================================================
# highlight — with semantic locators
# ===================================================================

@test "highlight: works with semantic locator" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight 'role=button'
  [ "$status" -eq 0 ]
}

@test "highlight: works with text= locator" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight 'text=Login'
  [ "$status" -eq 0 ]
}

# ===================================================================
# highlight — integration: multiple highlights
# ===================================================================

@test "highlight: highlights multiple elements sequentially" {
  navigate_and_wait "$URL_LOGIN"
  run bcli highlight "$SEL_USERNAME" --duration 100
  [ "$status" -eq 0 ]

  run bcli highlight "$SEL_PASSWORD" --duration 100
  [ "$status" -eq 0 ]

  run bcli highlight "$SEL_LOGIN_BTN" --duration 100
  [ "$status" -eq 0 ]
}
