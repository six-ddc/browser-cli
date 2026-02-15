#!/usr/bin/env bats
# 02-interaction.bats — Element interaction E2E tests
#
# Tests: click, dblclick, fill, type, check, uncheck, select, hover, press,
#        clear, focus

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
# click
# ===================================================================

@test "click: clicks an element by CSS selector" {
  navigate_and_wait "$URL_ADD_REMOVE"

  # Click the "Add Element" button
  run bcli click 'button[onclick="addElement()"]'
  assert_success
  assert_output --partial "Clicked"

  # Verify an element was added
  assert_element_exists ".added-manually"
}

@test "click: clicks a login button and navigates" {
  navigate_and_wait "$URL_LOGIN"

  # Fill in the form first
  bcli fill "$SEL_USERNAME" "$TEST_USERNAME"
  bcli fill "$SEL_PASSWORD" "$TEST_PASSWORD"

  # Click login
  run bcli click "$SEL_LOGIN_BTN"
  assert_success
  sleep "$BCLI_PAGE_LOAD_WAIT"

  # Should navigate to /secure
  assert_url_matches "/secure"
}

@test "click: right-click with --button option" {
  navigate_and_wait "$URL_CONTEXT_MENU"

  run bcli click '#hot-spot' --button right
  assert_success
  assert_output --partial "Clicked"
}

# ===================================================================
# dblclick
# ===================================================================

@test "dblclick: double-clicks an element" {
  navigate_and_wait "$URL_ADD_REMOVE"

  run bcli dblclick 'button[onclick="addElement()"]'
  assert_success
  assert_output --partial "Double-clicked"
}

# ===================================================================
# fill
# ===================================================================

@test "fill: fills an input field with a value" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill "$SEL_USERNAME" "testuser"
  assert_success
  assert_output --partial "Filled"

  # Verify the value was set
  assert_value_equals "$SEL_USERNAME" "testuser"
}

@test "fill: replaces existing input value" {
  navigate_and_wait "$URL_LOGIN"

  bcli fill "$SEL_USERNAME" "first"
  assert_value_equals "$SEL_USERNAME" "first"

  bcli fill "$SEL_USERNAME" "second"
  assert_value_equals "$SEL_USERNAME" "second"
}

@test "fill: fills password field" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill "$SEL_PASSWORD" "$TEST_PASSWORD"
  assert_success
  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"
}

# ===================================================================
# type
# ===================================================================

@test "type: types text character-by-character" {
  navigate_and_wait "$URL_INPUTS"

  run bcli type 'input[type="number"]' "12345"
  assert_success
  assert_output --partial "Typed"
}

@test "type: types with --delay option" {
  navigate_and_wait "$URL_INPUTS"

  run bcli type 'input[type="number"]' "42" --delay 50
  assert_success
  assert_output --partial "Typed"
}

# ===================================================================
# check / uncheck
# ===================================================================

@test "check: checks an unchecked checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  # First checkbox is unchecked by default on the-internet
  run bcli check "${SEL_CHECKBOX}:first-of-type"
  assert_success
  assert_output --partial "Checked"

  assert_checked "${SEL_CHECKBOX}:first-of-type"
}

@test "check: checking an already-checked checkbox stays checked" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Second checkbox is checked by default
  run bcli check "${SEL_CHECKBOX}:last-of-type"
  assert_success

  assert_checked "${SEL_CHECKBOX}:last-of-type"
}

@test "uncheck: unchecks a checked checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Second checkbox is checked by default
  run bcli uncheck "${SEL_CHECKBOX}:last-of-type"
  assert_success
  assert_output --partial "Unchecked"

  assert_not_checked "${SEL_CHECKBOX}:last-of-type"
}

@test "uncheck: unchecking an already-unchecked checkbox stays unchecked" {
  navigate_and_wait "$URL_CHECKBOXES"

  # First checkbox is unchecked by default
  run bcli uncheck "${SEL_CHECKBOX}:first-of-type"
  assert_success

  assert_not_checked "${SEL_CHECKBOX}:first-of-type"
}

# ===================================================================
# select
# ===================================================================

@test "select: selects a dropdown option by value" {
  navigate_and_wait "$URL_DROPDOWN"

  run bcli select "$SEL_DROPDOWN" "1"
  assert_success
  assert_output --partial "Selected"

  # Verify the value
  assert_value_equals "$SEL_DROPDOWN" "1"
}

@test "select: selects a dropdown option by visible text" {
  navigate_and_wait "$URL_DROPDOWN"

  run bcli select "$SEL_DROPDOWN" "Option 2"
  assert_success
  assert_output --partial "Selected"

  assert_value_equals "$SEL_DROPDOWN" "2"
}

@test "select: changing selection updates value" {
  navigate_and_wait "$URL_DROPDOWN"

  bcli select "$SEL_DROPDOWN" "1"
  assert_value_equals "$SEL_DROPDOWN" "1"

  bcli select "$SEL_DROPDOWN" "2"
  assert_value_equals "$SEL_DROPDOWN" "2"
}

# ===================================================================
# hover
# ===================================================================

@test "hover: hovers over an element" {
  navigate_and_wait "$URL_HOVERS"

  run bcli hover '.figure:first-of-type'
  assert_success
  assert_output --partial "Hovered"
}

# ===================================================================
# press (page-level key)
# ===================================================================

@test "press: presses a key on the page" {
  navigate_and_wait "$URL_KEY_PRESSES"

  run bcli press "Enter"
  assert_success
  assert_output --partial "Pressed"
}

@test "press: Tab key" {
  navigate_and_wait "$URL_KEY_PRESSES"

  run bcli press "Tab"
  assert_success
  assert_output --partial "Pressed"
}

@test "press: key alias works" {
  navigate_and_wait "$URL_KEY_PRESSES"

  # 'key' is an alias for 'press'
  run bcli key "Escape"
  assert_success
  assert_output --partial "Pressed"
}

# ===================================================================
# clear
# ===================================================================

@test "clear: clears an input field" {
  navigate_and_wait "$URL_LOGIN"

  # Fill first, then clear
  bcli fill "$SEL_USERNAME" "testvalue"
  assert_value_equals "$SEL_USERNAME" "testvalue"

  run bcli clear "$SEL_USERNAME"
  assert_success
  assert_output --partial "Cleared"

  assert_value_equals "$SEL_USERNAME" ""
}

# ===================================================================
# focus
# ===================================================================

@test "focus: focuses an input element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli focus "$SEL_USERNAME"
  assert_success
  assert_output --partial "Focused"
}

# ===================================================================
# Complete login flow (integration)
# ===================================================================

@test "integration: complete login flow with fill + click" {
  navigate_and_wait "$URL_LOGIN"

  # Fill username and password
  bcli fill "$SEL_USERNAME" "$TEST_USERNAME"
  bcli fill "$SEL_PASSWORD" "$TEST_PASSWORD"

  # Click login
  bcli click "$SEL_LOGIN_BTN"
  sleep "$BCLI_PAGE_LOAD_WAIT"

  # Verify we landed on the secure page
  assert_url_matches "/secure"
  assert_text_contains "$SEL_FLASH_MESSAGE" "You logged into a secure area"
}
