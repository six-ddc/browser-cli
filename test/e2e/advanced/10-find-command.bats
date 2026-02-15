#!/usr/bin/env bats
# 10-find-command.bats — Tests for the `find` command (semantic locate + act)
#
# The `find` command combines element location and action in a single step:
#   find <engine> <value> [action] [action-value]
#
# Engines: role, text, label, placeholder, alt, title, testid, xpath
# Actions: click, dblclick, fill, type, hover, check, uncheck, select, press, clear, focus

load "../helpers/daemon.bash"
load "../helpers/assertions.bash"
load "../helpers/fixtures.bash"

# ─── Setup / Teardown ────────────────────────────────────────────────

setup() {
  ensure_daemon_ready
}

# ─── Find by Role ────────────────────────────────────────────────────

@test "find role: default action is click" {
  navigate_and_wait "$URL_LOGIN"

  # find role button should click the first button (Login)
  run bcli find role button
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find role: click button with --name" {
  navigate_and_wait "$URL_LOGIN"

  # Click the Login button by role + name
  run bcli find role button --name "Login"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find role: fill textbox" {
  navigate_and_wait "$URL_LOGIN"

  # Find textbox role and fill it
  run bcli find role textbox fill "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]
}

@test "find role: hover on link" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find role link hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

@test "find role: focus on textbox" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find role textbox focus
  [ "$status" -eq 0 ]
  [[ "$output" == *"Focused"* ]]
}

# ─── Find by Text ────────────────────────────────────────────────────

@test "find text: click by text content" {
  navigate_and_wait "$URL_LOGIN"

  # Click element with "Login" text
  run bcli find text "Login" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find text: default action is click" {
  navigate_and_wait "$URL_LOGIN"

  # Omitting action should default to click
  run bcli find text "Login"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find text: exact match with --exact flag" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find text "Login" click --exact
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find text: partial match finds element" {
  navigate_and_wait "$URL_LOGIN"

  # "Log" should match "Login" in partial/substring mode
  run bcli find text "Log" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

# ─── Find by Label ───────────────────────────────────────────────────

@test "find label: fill input by label text" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label "Username" fill "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  # Verify the input was actually filled
  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "find label: fill password by label" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label "Password" fill "$TEST_PASSWORD"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  # Verify the password input was filled
  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"
}

@test "find label: click input found by label" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label "Username" click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find label: focus input found by label" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label "Username" focus
  [ "$status" -eq 0 ]
  [[ "$output" == *"Focused"* ]]
}

# ─── Find by Placeholder ─────────────────────────────────────────────

@test "find placeholder: fill input by placeholder text" {
  navigate_and_wait "$URL_FORGOT_PASSWORD"

  run bcli find placeholder "E-mail" fill "test@example.com"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]
}

# ─── Find by XPath ───────────────────────────────────────────────────

@test "find xpath: click button by xpath" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find xpath '//button[@type="submit"]' click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "find xpath: fill input by xpath" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find xpath '//input[@id="username"]' fill "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "find xpath: complex xpath expression" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Select checkboxes with xpath
  run bcli find xpath '//input[@type="checkbox"]' click
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

# ─── Find with Different Actions ─────────────────────────────────────

@test "find + fill action" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label "Username" fill "testuser"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_USERNAME" "testuser"
}

@test "find + type action" {
  navigate_and_wait "$URL_INPUTS"

  run bcli find role textbox type "12345"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Typed"* ]]
}

@test "find + hover action" {
  navigate_and_wait "$URL_HOVERS"

  run bcli find first ".figure" hover
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

@test "find + check action" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli find first "$SEL_CHECKBOX" check
  [ "$status" -eq 0 ]
  [[ "$output" == *"Checked"* ]]
}

@test "find + uncheck action" {
  navigate_and_wait "$URL_CHECKBOXES"

  # The second checkbox is checked by default on this page
  run bcli find last "$SEL_CHECKBOX" uncheck
  [ "$status" -eq 0 ]
  [[ "$output" == *"Unchecked"* ]]
}

@test "find + select action" {
  navigate_and_wait "$URL_DROPDOWN"

  run bcli find role combobox select "1"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Selected"* ]]
}

@test "find + clear action" {
  navigate_and_wait "$URL_LOGIN"

  # First fill, then clear using find
  bcli fill "$SEL_USERNAME" "testdata"
  assert_value_equals "$SEL_USERNAME" "testdata"

  run bcli find label "Username" clear
  [ "$status" -eq 0 ]
  [[ "$output" == *"Cleared"* ]]

  assert_value_equals "$SEL_USERNAME" ""
}

@test "find + focus action" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label "Username" focus
  [ "$status" -eq 0 ]
  [[ "$output" == *"Focused"* ]]
}

@test "find + dblclick action" {
  navigate_and_wait "$URL_ADD_REMOVE"

  run bcli find text "Add Element" dblclick
  [ "$status" -eq 0 ]
  [[ "$output" == *"Double-clicked"* ]]
}

@test "find + press action on element" {
  navigate_and_wait "$URL_LOGIN"

  # Focus on the username input, then press Tab
  bcli focus "$SEL_USERNAME"

  run bcli find label "Username" press "Tab"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Pressed"* ]]
}

# ─── Find Error Handling ─────────────────────────────────────────────

@test "find: unknown engine gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find unknown "value" click
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unknown engine"* ]] || [[ "$output" == *"unknown"* ]]
}

@test "find: unknown action gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find text "Login" invalidaction
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unknown action"* ]] || [[ "$output" == *"unknown"* ]]
}

@test "find: fill without value gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli find label "Username" fill
  [ "$status" -ne 0 ]
}

@test "find: select without value gives error" {
  navigate_and_wait "$URL_DROPDOWN"

  run bcli find role combobox select
  [ "$status" -ne 0 ]
}

@test "find: too few arguments gives usage error" {
  run bcli find role
  [ "$status" -ne 0 ]
}

# ─── Complete Workflow with Find ──────────────────────────────────────

@test "find: complete login flow using find commands" {
  navigate_and_wait "$URL_LOGIN"

  # Fill username using find + label
  bcli find label "Username" fill "$TEST_USERNAME"
  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"

  # Fill password using find + label
  bcli find label "Password" fill "$TEST_PASSWORD"
  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"

  # Click login button using find + role
  bcli find role button --name "Login" click

  # Wait for navigation to secure page
  sleep 2

  assert_url_matches "/secure"
}
