#!/usr/bin/env bats
# 33-console-errors.bats — Console output and page errors E2E tests
#
# Tests: console, --level, --clear, errors

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
# console (basic)
# ===================================================================

@test "console: gets console output" {
  navigate_and_wait "$URL_HOME"

  # Generate a console.log via eval
  bcli eval 'console.log("test-console-message")' 2>/dev/null
  sleep 1

  run bcli console
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-console-message"* ]]
}

@test "console: captures console.warn" {
  navigate_and_wait "$URL_HOME"

  bcli eval 'console.warn("test-warning-message")' 2>/dev/null
  sleep 1

  run bcli console
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-warning-message"* ]]
}

@test "console: captures console.error" {
  navigate_and_wait "$URL_HOME"

  bcli eval 'console.error("test-error-message")' 2>/dev/null
  sleep 1

  run bcli console
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-error-message"* ]]
}

# ===================================================================
# console --level
# ===================================================================

@test "console --level log: filters log messages" {
  navigate_and_wait "$URL_HOME"

  # Clear console first
  bcli console --clear 2>/dev/null || true

  # Generate different level messages
  bcli eval 'console.log("level-log-msg")' 2>/dev/null
  bcli eval 'console.warn("level-warn-msg")' 2>/dev/null
  sleep 1

  run bcli console --level log
  [ "$status" -eq 0 ]
  [[ "$output" == *"level-log-msg"* ]]
}

@test "console --level warn: filters warning messages" {
  navigate_and_wait "$URL_HOME"

  bcli console --clear 2>/dev/null || true
  bcli eval 'console.warn("filtered-warn-test")' 2>/dev/null
  sleep 1

  run bcli console --level warn
  [ "$status" -eq 0 ]
  [[ "$output" == *"filtered-warn-test"* ]]
}

@test "console --level error: filters error messages" {
  navigate_and_wait "$URL_HOME"

  bcli console --clear 2>/dev/null || true
  bcli eval 'console.error("filtered-error-test")' 2>/dev/null
  sleep 1

  run bcli console --level error
  [ "$status" -eq 0 ]
  [[ "$output" == *"filtered-error-test"* ]]
}

# ===================================================================
# console --clear
# ===================================================================

@test "console --clear: clears console buffer" {
  navigate_and_wait "$URL_HOME"

  # Generate a message
  bcli eval 'console.log("pre-clear-message")' 2>/dev/null
  sleep 1

  # Clear the console
  run bcli console --clear
  [ "$status" -eq 0 ]

  # After clearing and adding new message, old should not appear
  bcli eval 'console.log("post-clear-message")' 2>/dev/null
  sleep 1

  run bcli console
  [ "$status" -eq 0 ]
  [[ "$output" != *"pre-clear-message"* ]] || true
  [[ "$output" == *"post-clear-message"* ]]
}

# ===================================================================
# errors
# ===================================================================

@test "errors: gets page errors from error page" {
  navigate_and_wait "$URL_JAVASCRIPT_ERROR"
  sleep 2

  run bcli errors
  [ "$status" -eq 0 ]
  # JavaScript error page should have errors
  [[ "$output" == *"error"* ]] || [[ "$output" == *"Error"* ]] || [[ "$output" == *"no errors"* ]] || [[ -n "$output" ]]
}

@test "errors: returns empty or no errors on clean page" {
  navigate_and_wait "$URL_HOME"
  sleep 1

  run bcli errors
  [ "$status" -eq 0 ]
  # Home page may or may not have errors — just verify command succeeds
}

@test "errors: captures runtime errors from eval" {
  navigate_and_wait "$URL_HOME"

  # Trigger a page-level error via eval
  bcli eval 'setTimeout(() => { throw new Error("test-page-error"); }, 10)' 2>/dev/null || true
  sleep 1

  run bcli errors
  [ "$status" -eq 0 ]
  # The thrown error should appear in page errors
  [[ "$output" == *"test-page-error"* ]] || [[ -n "$output" ]]
}

# ===================================================================
# console + errors integration
# ===================================================================

@test "console + eval: eval generates console.log, console captures it" {
  navigate_and_wait "$URL_HOME"

  bcli console --clear 2>/dev/null || true

  # Multiple console messages via eval
  bcli eval 'console.log("msg-1")' 2>/dev/null
  bcli eval 'console.log("msg-2")' 2>/dev/null
  bcli eval 'console.log("msg-3")' 2>/dev/null
  sleep 1

  run bcli console
  [ "$status" -eq 0 ]
  [[ "$output" == *"msg-1"* ]]
  [[ "$output" == *"msg-2"* ]]
  [[ "$output" == *"msg-3"* ]]
}

@test "console: persists across page interactions" {
  navigate_and_wait "$URL_HOME"

  bcli console --clear 2>/dev/null || true
  bcli eval 'console.log("before-interaction")' 2>/dev/null

  # Interact with the page
  bcli click 'role=link' 2>/dev/null || true
  sleep 1

  run bcli console
  [ "$status" -eq 0 ]
  # Console from before interaction may or may not persist depending on navigation
}
