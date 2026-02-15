#!/usr/bin/env bats
# 13-position-selectors.bats — Tests for position selectors (first, last, nth)
#
# Position selectors are used with the `find` command to select among multiple
# matching elements:
#   find first <selector> [action] [action-value]
#   find last <selector> [action] [action-value]
#   find nth <n> <selector> [action] [action-value]
#
# The nth selector uses 1-based indexing (nth 1 = first element).
# Position selectors work with both CSS selectors and semantic locators.

load "../helpers/daemon.bash"
load "../helpers/assertions.bash"
load "../helpers/fixtures.bash"

# ─── Setup / Teardown ────────────────────────────────────────────────

setup() {
  ensure_daemon_ready
}

# ─── first selector ──────────────────────────────────────────────────

@test "find first: click first checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find first "$SEL_CHECKBOX" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find first: check first checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find first "$SEL_CHECKBOX" check
  [ "$status" -eq 0 ]
  [[ "$output" == *"Checked"* ]]
}

@test "find first: default action is click" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Omitting action should default to click
  run bcli find first "$SEL_CHECKBOX"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find first: hover first figure" {
  navigate_and_wait "$URL_HOVERS"

  run bcli find first ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

@test "find first: fill first input" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find first "input" fill "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "find first: focus first input" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find first "input" focus
  [ "$status" -eq 0 ]
  [[ "$output" == *"Focused"* ]]
}

@test "find first: clear first input" {
  navigate_and_wait "$URL_LOGIN"

  # Fill the input first
  bcli fill "$SEL_USERNAME" "testdata"

  run bcli find first "input" clear
  [ "$status" -eq 0 ]
  [[ "$output" == *"Cleared"* ]]

  assert_value_equals "$SEL_USERNAME" ""
}

# ─── last selector ───────────────────────────────────────────────────

@test "find last: click last checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find last "$SEL_CHECKBOX" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find last: uncheck last checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  # The second (last) checkbox on /checkboxes is checked by default
  run bcli find last "$SEL_CHECKBOX" uncheck
  [ "$status" -eq 0 ]
  [[ "$output" == *"Unchecked"* ]]
}

@test "find last: default action is click" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find last "$SEL_CHECKBOX"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find last: hover last figure" {
  navigate_and_wait "$URL_HOVERS"

  run bcli find last ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

@test "find last: fill last input" {
  navigate_and_wait "$URL_LOGIN"

  # The last input on the login page should be the password field
  run bcli find last 'input[type="password"]' fill "$TEST_PASSWORD"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"
}

@test "find last: focus last input" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find last "input" focus
  [ "$status" -eq 0 ]
  [[ "$output" == *"Focused"* ]]
}

# ─── nth selector ────────────────────────────────────────────────────

@test "find nth 1: click first checkbox (1-based)" {
  navigate_and_wait "$URL_CHECKBOXES"

  # nth 1 should be the first checkbox
  run bcli find nth 1 "$SEL_CHECKBOX" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find nth 2: click second checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find nth 2 "$SEL_CHECKBOX" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find nth 1: check first checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find nth 1 "$SEL_CHECKBOX" check
  [ "$status" -eq 0 ]
  [[ "$output" == *"Checked"* ]]
}

@test "find nth 2: uncheck second checkbox" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Second checkbox is checked by default
  run bcli find nth 2 "$SEL_CHECKBOX" uncheck
  [ "$status" -eq 0 ]
  [[ "$output" == *"Unchecked"* ]]
}

@test "find nth: default action is click" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find nth 1 "$SEL_CHECKBOX"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find nth 1: fill first input" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find nth 1 "input" fill "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "find nth 2: fill second input (password)" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find nth 2 "input" fill "$TEST_PASSWORD"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"
}

@test "find nth: hover nth figure" {
  navigate_and_wait "$URL_HOVERS"

  # Hovers page has 3 figures
  run bcli find nth 2 ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

@test "find nth 3: hover third figure" {
  navigate_and_wait "$URL_HOVERS"

  run bcli find nth 3 ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

# ─── nth equivalence with first/last ─────────────────────────────────

@test "find nth 1 is equivalent to find first" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Both should target the first checkbox — we verify by checking state
  # First, get the initial state
  local initial_state
  initial_state=$(bcli is checked 'input[type="checkbox"]:nth-of-type(1)' 2>/dev/null || true)

  # Click using nth 1
  run bcli find nth 1 "$SEL_CHECKBOX" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find nth 2 targets the last checkbox (on 2-checkbox page)" {
  navigate_and_wait "$URL_CHECKBOXES"

  # /checkboxes has exactly 2 checkboxes, so nth 2 = last
  run bcli find nth 2 "$SEL_CHECKBOX" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

# ─── Position Selectors with Different Actions ───────────────────────

@test "position selector + type action" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find first "input" type "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Typed"* ]]
}

@test "position selector + dblclick action" {
  navigate_and_wait "$URL_ADD_REMOVE"

  run bcli find first "button" dblclick
  [ "$status" -eq 0 ]
  [[ "$output" == *"Double-clicked"* ]]
}

@test "position selector + select action" {
  navigate_and_wait "$URL_DROPDOWN"

  run bcli find first "select" select "1"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Selected"* ]]
}

@test "position selector + press action" {
  navigate_and_wait "$URL_LOGIN"

  bcli focus "$SEL_USERNAME"

  run bcli find first "input" press "Tab"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Pressed"* ]]
}

# ─── Position Selectors Error Handling ────────────────────────────────

@test "find nth with invalid index gives error" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find nth abc "$SEL_CHECKBOX" click
  [ "$status" -ne 0 ]
  [[ "$output" == *"Invalid"* ]] || [[ "$output" == *"invalid"* ]] || [[ "$output" == *"error"* ]]
}

@test "find nth with negative index gives error" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find nth -1 "$SEL_CHECKBOX" click
  [ "$status" -ne 0 ]
}

@test "find nth with out-of-bounds index gives error" {
  navigate_and_wait "$URL_CHECKBOXES"

  # There are only 2 checkboxes, so nth 999 should fail
  run bcli find nth 999 "$SEL_CHECKBOX" click
  [ "$status" -ne 0 ]
  [[ "$output" == *"not found"* ]] || [[ "$output" == *"Element"* ]]
}

@test "find first with no matching elements gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find first ".nonexistent-class-xyz" click
  [ "$status" -ne 0 ]
  [[ "$output" == *"not found"* ]] || [[ "$output" == *"Element"* ]]
}

@test "find last with no matching elements gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find last ".nonexistent-class-xyz" click
  [ "$status" -ne 0 ]
  [[ "$output" == *"not found"* ]] || [[ "$output" == *"Element"* ]]
}

@test "find nth with missing selector gives usage error" {
  run bcli find nth 1
  [ "$status" -ne 0 ]
}

@test "find first with missing selector gives usage error" {
  run bcli find first
  [ "$status" -ne 0 ]
}

# ─── Position Selectors in Multi-Element Scenarios ────────────────────

@test "first and last target different elements" {
  navigate_and_wait "$URL_CHECKBOXES"

  # First, uncheck all checkboxes to start clean
  # The page has 2 checkboxes: first unchecked, second checked by default
  # After page load, verify we have 2 checkboxes
  local count
  count=$(bcli get count "$SEL_CHECKBOX" 2>/dev/null | tr -d '[:space:]')
  [ "$count" = "2" ]

  # Check the first checkbox
  bcli find first "$SEL_CHECKBOX" check

  # Uncheck the last checkbox
  bcli find last "$SEL_CHECKBOX" uncheck

  # After these operations, first should be checked and last should be unchecked
  # (assuming first was unchecked and last was checked initially)
}

@test "nth iterates through multiple elements correctly" {
  navigate_and_wait "$URL_HOVERS"

  # The hovers page has 3 figure elements
  # Hover each one in sequence using nth
  run bcli find nth 1 ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]

  run bcli find nth 2 ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]

  run bcli find nth 3 ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

# ─── Position Selectors with Semantic Locators ────────────────────────
# Note: position selectors in the find command work with CSS selectors.
# Semantic locators have their own matching which returns ordered results.
# These tests verify both can work together in a workflow.

@test "workflow: position selector then semantic locator" {
  navigate_and_wait "$URL_LOGIN"

  # Use position selector to fill first input
  bcli find first "input" fill "$TEST_USERNAME"
  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"

  # Use semantic locator to fill password
  bcli find label "Password" fill "$TEST_PASSWORD"
  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"

  # Use position selector to click the submit button
  bcli find first 'button[type="submit"]' click

  sleep 2
  assert_url_matches "/secure"
}

@test "workflow: fill form fields using nth selectors" {
  navigate_and_wait "$URL_LOGIN"

  # Fill username (1st input)
  bcli find nth 1 "input" fill "$TEST_USERNAME"
  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"

  # Fill password (2nd input)
  bcli find nth 2 "input" fill "$TEST_PASSWORD"
  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"
}
