#!/usr/bin/env bats
# 41-global-options.bats — Global options E2E tests
#
# Tests: --json flag, --session flag

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
# --json flag
# ===================================================================

@test "--json: navigate returns JSON format" {
  run bcli --json navigate "$URL_HOME"
  [ "$status" -eq 0 ]
  # Output should be valid JSON with success field
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"true"* ]]
}

@test "--json: get url returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json get url
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"/login"* ]]
}

@test "--json: get title returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json get title
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"The Internet"* ]]
}

@test "--json: get text returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json get text 'h2'
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"Login Page"* ]]
}

@test "--json: click returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json click "$SEL_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

@test "--json: fill returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json fill "$SEL_USERNAME" "json-test"
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

@test "--json: snapshot returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json snapshot -ic
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

@test "--json: error returns JSON error format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json click '.nonexistent-element-12345'
  [ "$status" -ne 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"false"* ]]
  # Should include error info
  [[ "$output" == *"error"* ]] || [[ "$output" == *"Error"* ]]
}

@test "--json: is visible returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json is visible "$SEL_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"true"* ]]
}

@test "--json: get count returns JSON format" {
  navigate_and_wait "$URL_CHECKBOXES"
  run bcli --json get count "$SEL_CHECKBOX"
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"2"* ]]
}

@test "--json: get value returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  bcli fill "$SEL_USERNAME" "json-value-test" 2>/dev/null
  run bcli --json get value "$SEL_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"json-value-test"* ]]
}

@test "--json: cookies returns JSON format" {
  navigate_and_wait "$URL_HOME"
  run bcli --json cookies
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]] || [[ "$output" == *"{"* ]]
}

@test "--json: tab list returns JSON format" {
  navigate_and_wait "$URL_HOME"
  run bcli --json tab list
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]] || [[ "$output" == *"{"* ]]
}

@test "--json: eval returns JSON format" {
  navigate_and_wait "$URL_HOME"
  run bcli --json eval '1 + 2'
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
  [[ "$output" == *"3"* ]]
}

@test "--json: wait returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json wait 'h2'
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

@test "--json: scroll returns JSON format" {
  navigate_and_wait "$URL_HOME"
  run bcli --json scroll down
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

# ===================================================================
# --json JSON validity
# ===================================================================

@test "--json: output is valid JSON (parseable)" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json get url
  [ "$status" -eq 0 ]
  # Use python to validate JSON
  echo "$output" | python3 -c "import sys, json; json.load(sys.stdin)"
  [ "$?" -eq 0 ] || true
}

@test "--json: error output is valid JSON (parseable)" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json click '.does-not-exist-9999'
  # Use python to validate JSON even on error
  echo "$output" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null
}

# ===================================================================
# --session flag
# ===================================================================

@test "--session: default session works" {
  # The test suite already uses a named session via $BROWSER_CLI_SESSION
  # Verify it works by checking status
  run bcli status
  [ "$status" -eq 0 ]
}

@test "--session: explicit session name matches test session" {
  # Verify that explicitly passing the test session name works the same
  run node "$BROWSER_CLI" --session "$BROWSER_CLI_SESSION" status
  [ "$status" -eq 0 ]
}

# ===================================================================
# --json + various commands integration
# ===================================================================

@test "--json: find command returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json find role button
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

@test "--json: highlight returns JSON format" {
  navigate_and_wait "$URL_LOGIN"
  run bcli --json highlight 'h2' --duration 100
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

@test "--json: back returns JSON format" {
  navigate_and_wait "$URL_HOME"
  navigate_and_wait "$URL_LOGIN"
  run bcli --json back
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}

@test "--json: check returns JSON format" {
  navigate_and_wait "$URL_CHECKBOXES"
  run bcli --json check "${SEL_CHECKBOX}:first-of-type"
  [ "$status" -eq 0 ]
  [[ "$output" == *"success"* ]]
}
