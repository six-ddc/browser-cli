#!/usr/bin/env bats
# 21-is-commands.bats — E2E tests for `is` subcommands
#
# Tests: is visible, is enabled, is checked

# Load helpers
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

# ===========================================================================
# is visible
# ===========================================================================

@test "is visible: returns true for visible element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli is visible "$SEL_USERNAME"
  assert_success
  assert_output "true"
}

@test "is visible: returns true for heading" {
  navigate_and_wait "$URL_LOGIN"

  run bcli is visible "h2"
  assert_success
  assert_output "true"
}

@test "is visible: returns false for hidden element" {
  navigate_and_wait "$URL_DYNAMIC_CONTROLS"
  # Click Remove to hide the checkbox
  bcli click "#checkbox-example button"
  sleep 2

  # After removal, the checkbox should not be visible
  run bcli is visible "#checkbox-example #checkbox"
  # Either returns false or fails — both acceptable for removed element
  if [[ "$status" -eq 0 ]]; then
    assert_output "false"
  fi
}

@test "is visible: fails for nonexistent element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli is visible ".nonexistent-element"
  assert_failure
}

# ===========================================================================
# is enabled
# ===========================================================================

@test "is enabled: returns true for enabled input" {
  navigate_and_wait "$URL_LOGIN"

  run bcli is enabled "$SEL_USERNAME"
  assert_success
  assert_output "true"
}

@test "is enabled: returns false for disabled input" {
  navigate_and_wait "$URL_DYNAMIC_CONTROLS"

  run bcli is enabled "#input-example input"
  assert_success
  assert_output "false"
}

@test "is enabled: returns true after enabling a disabled input" {
  navigate_and_wait "$URL_DYNAMIC_CONTROLS"

  # Verify input starts disabled
  run bcli is enabled "#input-example input"
  assert_success
  assert_output "false"

  # Click Enable button
  bcli click "#input-example button"
  sleep 3

  # Now the input should be enabled
  run bcli is enabled "#input-example input"
  assert_success
  assert_output "true"
}

@test "is enabled: returns true for buttons" {
  navigate_and_wait "$URL_LOGIN"

  run bcli is enabled "$SEL_LOGIN_BTN"
  assert_success
  assert_output "true"
}

# ===========================================================================
# is checked
# ===========================================================================

@test "is checked: returns false for unchecked checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  # First checkbox is unchecked by default
  run bcli is checked "${SEL_CHECKBOX}:first-of-type"
  assert_success
  assert_output "false"
}

@test "is checked: returns true for pre-checked checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Second checkbox is checked by default
  run bcli is checked "${SEL_CHECKBOX}:last-of-type"
  assert_success
  assert_output "true"
}

@test "is checked: reflects state after check command" {
  navigate_and_wait "$URL_CHECKBOXES"

  bcli check "${SEL_CHECKBOX}:first-of-type"
  sleep 0.5

  run bcli is checked "${SEL_CHECKBOX}:first-of-type"
  assert_success
  assert_output "true"
}

@test "is checked: reflects state after uncheck command" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Second checkbox is checked by default — uncheck it
  bcli uncheck "${SEL_CHECKBOX}:last-of-type"
  sleep 0.5

  run bcli is checked "${SEL_CHECKBOX}:last-of-type"
  assert_success
  assert_output "false"
}

@test "is checked: fails for non-checkbox element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli is checked "$SEL_USERNAME"
  # Checking a non-checkbox should either fail or return false
  if [[ "$status" -eq 0 ]]; then
    assert_output "false"
  fi
}
