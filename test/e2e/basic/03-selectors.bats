#!/usr/bin/env bats
# 03-selectors.bats — Selector engine E2E tests
#
# Tests: CSS selectors, semantic locators (text=, role=, label=, etc.),
#        element references (@e1, @e2), find command with position selectors

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
# CSS Selectors
# ===================================================================

@test "css selector: clicks by ID selector" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click '#username'
  assert_success
}

@test "css selector: clicks by class selector" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click '.radius'
  assert_success
}

@test "css selector: clicks by attribute selector" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'button[type="submit"]'
  assert_success
}

@test "css selector: gets text by tag selector" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get text 'h2'
  assert_success
  assert_output --partial "Login Page"
}

@test "css selector: counts elements" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli get count "$SEL_CHECKBOX"
  assert_success
  # There are 2 checkboxes on the checkboxes page
  assert_output "2"
}

# ===================================================================
# Semantic Locators — text=
# ===================================================================

@test "semantic: click with text= locator" {
  navigate_and_wait "$URL_LOGIN"

  # The login button has text "Login"
  run bcli click 'text=Login'
  assert_success
  assert_output --partial "Clicked"
}

@test "semantic: click with quoted text= for exact match" {
  navigate_and_wait "$URL_ADD_REMOVE"

  run bcli click 'text="Add Element"'
  assert_success
  assert_output --partial "Clicked"

  # Verify the element was added
  assert_element_exists ".added-manually"
}

# ===================================================================
# Semantic Locators — role=
# ===================================================================

@test "semantic: click with role= locator" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'role=button'
  assert_success
  assert_output --partial "Clicked"
}

@test "semantic: click with role= and name filter" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'role=button[name="Login"]'
  assert_success
  assert_output --partial "Clicked"
}

@test "semantic: click role=link" {
  navigate_and_wait "$URL_HOME"

  # The home page has many links
  run bcli click 'role=link'
  assert_success
}

# ===================================================================
# Semantic Locators — label=
# ===================================================================

@test "semantic: fill with label= locator" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'label=Username' "testuser"
  assert_success
  assert_output --partial "Filled"

  assert_value_equals "$SEL_USERNAME" "testuser"
}

@test "semantic: fill with label= on password field" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'label=Password' "secret"
  assert_success

  assert_value_equals "$SEL_PASSWORD" "secret"
}

# ===================================================================
# Element References (@e1, @e2, ...)
# ===================================================================

@test "element refs: snapshot -ic generates @e refs" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -ic
  assert_success
  # Snapshot should contain element references
  assert_output --partial "@e"
}

@test "element refs: click using @e ref from snapshot" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Take snapshot to populate the ref store
  bcli snapshot -ic

  # Click the first interactive element reference
  run bcli click '@e1'
  assert_success
  assert_output --partial "Clicked"
}

@test "element refs: fill using @e ref from snapshot" {
  navigate_and_wait "$URL_LOGIN"

  # Take snapshot to populate the ref store
  bcli snapshot -ic

  # @e2 is the username input (login page has a GitHub link as @e1)
  run bcli fill '@e2' 'reftest'
  assert_success
  assert_output --partial "Filled"
}

# ===================================================================
# Find command — semantic engines
# ===================================================================

@test "find: find by role with default click action" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find role button
  assert_success
  assert_output --partial "Clicked"
}

@test "find: find by role with --name filter" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find role button --name "Login"
  assert_success
  assert_output --partial "Clicked"
}

@test "find: find by text" {
  navigate_and_wait "$URL_ADD_REMOVE"

  run bcli find text "Add Element" click
  assert_success
  assert_output --partial "Clicked"

  assert_element_exists ".added-manually"
}

@test "find: find by label and fill" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label Username fill "$TEST_USERNAME"
  assert_success
  assert_output --partial "Filled"

  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "find: find by label with exact match" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label Username fill "exacttest" --exact
  assert_success
  assert_value_equals "$SEL_USERNAME" "exacttest"
}

@test "find: find by xpath" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find xpath '//button[@type="submit"]' click
  assert_success
  assert_output --partial "Clicked"
}

# ===================================================================
# Find command — position selectors (first, last, nth)
# ===================================================================

@test "find: first position selector" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find first "$SEL_CHECKBOX" check
  assert_success
  assert_output --partial "Checked"

  assert_checked "${SEL_CHECKBOX}:first-of-type"
}

@test "find: last position selector" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find last "$SEL_CHECKBOX" uncheck
  assert_success
  assert_output --partial "Unchecked"

  assert_not_checked "${SEL_CHECKBOX}:last-of-type"
}

@test "find: nth position selector (1-based)" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find nth 1 "$SEL_CHECKBOX" check
  assert_success
  assert_output --partial "Checked"

  assert_checked "${SEL_CHECKBOX}:first-of-type"
}

@test "find: nth 2 position selector" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find nth 2 "$SEL_CHECKBOX" uncheck
  assert_success
  assert_output --partial "Unchecked"

  assert_not_checked "${SEL_CHECKBOX}:last-of-type"
}

# ===================================================================
# Find command — different actions
# ===================================================================

@test "find: find + hover action" {
  navigate_and_wait "$URL_HOVERS"

  run bcli find first '.figure' hover
  assert_success
  assert_output --partial "Hovered"
}

@test "find: find + select action" {
  navigate_and_wait "$URL_DROPDOWN"

  run bcli find role combobox select "Option 1"
  assert_success
  assert_output --partial "Selected"
}

@test "find: find + clear action" {
  navigate_and_wait "$URL_LOGIN"

  bcli fill "$SEL_USERNAME" "clearme"

  run bcli find label Username clear
  assert_success
  assert_output --partial "Cleared"

  assert_value_equals "$SEL_USERNAME" ""
}

@test "find: find + focus action" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label Username focus
  assert_success
  assert_output --partial "Focused"
}

# ===================================================================
# Error cases
# ===================================================================

@test "error: clicking non-existent selector fails" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click '.does-not-exist-at-all'
  assert_failure
}

@test "error: find with unknown engine fails" {
  run bcli find unknownengine value click
  assert_failure
}
