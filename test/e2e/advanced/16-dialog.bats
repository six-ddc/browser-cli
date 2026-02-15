#!/usr/bin/env bats
# 16-dialog.bats — Dialog handling E2E tests
#
# Tests: dialog accept [text], dialog dismiss
# Uses https://the-internet.herokuapp.com/javascript_alerts

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
# dialog accept
# ===================================================================

@test "dialog accept: sets up auto-accept for alert" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # Set up dialog handler to auto-accept
  run bcli dialog accept
  [ "$status" -eq 0 ]

  # Trigger an alert (first button: "Click for JS Alert")
  run bcli click 'button[onclick="jsAlert()"]'
  [ "$status" -eq 0 ]
  sleep 1

  # The result text should show the alert was accepted
  run bcli get text '#result'
  [ "$status" -eq 0 ]
  [[ "$output" == *"You successfully clicked an alert"* ]] || [[ "$output" == *"successfully"* ]]
}

@test "dialog accept: accepts confirm dialog" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # Set up dialog handler to auto-accept
  run bcli dialog accept
  [ "$status" -eq 0 ]

  # Trigger a confirm dialog (second button: "Click for JS Confirm")
  run bcli click 'button[onclick="jsConfirm()"]'
  [ "$status" -eq 0 ]
  sleep 1

  # Result should show OK was pressed
  run bcli get text '#result'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Ok"* ]]
}

@test "dialog accept with text: provides text for prompt dialog" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # Set up dialog handler to auto-accept with text
  run bcli dialog accept "Hello from test"
  [ "$status" -eq 0 ]

  # Trigger a prompt dialog (third button: "Click for JS Prompt")
  run bcli click 'button[onclick="jsPrompt()"]'
  [ "$status" -eq 0 ]
  sleep 1

  # Result should show the text we entered
  run bcli get text '#result'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hello from test"* ]]
}

# ===================================================================
# dialog dismiss
# ===================================================================

@test "dialog dismiss: dismisses alert" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # Set up dialog handler to dismiss
  run bcli dialog dismiss
  [ "$status" -eq 0 ]

  # Trigger an alert
  run bcli click 'button[onclick="jsAlert()"]'
  [ "$status" -eq 0 ]
  sleep 1

  # Alert should have been dismissed (result may still show success since alert only has OK)
  run bcli get text '#result'
  [ "$status" -eq 0 ]
}

@test "dialog dismiss: dismisses confirm dialog (Cancel)" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # Set up dialog handler to dismiss
  run bcli dialog dismiss
  [ "$status" -eq 0 ]

  # Trigger a confirm dialog
  run bcli click 'button[onclick="jsConfirm()"]'
  [ "$status" -eq 0 ]
  sleep 1

  # Result should show Cancel was pressed
  run bcli get text '#result'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Cancel"* ]]
}

@test "dialog dismiss: dismisses prompt dialog" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # Set up dialog handler to dismiss
  run bcli dialog dismiss
  [ "$status" -eq 0 ]

  # Trigger a prompt dialog
  run bcli click 'button[onclick="jsPrompt()"]'
  [ "$status" -eq 0 ]
  sleep 1

  # Result should show null (prompt was dismissed)
  run bcli get text '#result'
  [ "$status" -eq 0 ]
  [[ "$output" == *"null"* ]] || [[ "$output" == *"Cancel"* ]]
}

# ===================================================================
# dialog integration tests
# ===================================================================

@test "dialog: accept then dismiss in sequence" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # First, accept a confirm
  run bcli dialog accept
  [ "$status" -eq 0 ]
  run bcli click 'button[onclick="jsConfirm()"]'
  [ "$status" -eq 0 ]
  sleep 1
  run bcli get text '#result'
  [[ "$output" == *"Ok"* ]]

  # Then, dismiss a confirm
  run bcli dialog dismiss
  [ "$status" -eq 0 ]
  run bcli click 'button[onclick="jsConfirm()"]'
  [ "$status" -eq 0 ]
  sleep 1
  run bcli get text '#result'
  [[ "$output" == *"Cancel"* ]]
}

@test "dialog: multiple prompt dialogs with different text" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # First prompt with text "First"
  run bcli dialog accept "First"
  [ "$status" -eq 0 ]
  run bcli click 'button[onclick="jsPrompt()"]'
  [ "$status" -eq 0 ]
  sleep 1
  run bcli get text '#result'
  [[ "$output" == *"First"* ]]

  # Second prompt with text "Second"
  run bcli dialog accept "Second"
  [ "$status" -eq 0 ]
  run bcli click 'button[onclick="jsPrompt()"]'
  [ "$status" -eq 0 ]
  sleep 1
  run bcli get text '#result'
  [[ "$output" == *"Second"* ]]
}
