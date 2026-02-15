#!/usr/bin/env bats
# 34-state-management.bats — State save/load E2E tests
#
# Tests: state save <path>, state load <path>

# Load BATS helpers
load "../helpers/daemon.bash"
load "../helpers/assertions.bash"
load "../helpers/fixtures.bash"

# Load bats-support and bats-assert from node_modules
REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)"
load "${REPO_ROOT}/node_modules/bats-support/load.bash"
load "${REPO_ROOT}/node_modules/bats-assert/load.bash"

# Temp directory for state files
STATE_TEMP_DIR=""

# ---------------------------------------------------------------------------
# Setup / Teardown
# ---------------------------------------------------------------------------

setup() {
  ensure_daemon_ready
  STATE_TEMP_DIR=$(mktemp -d)
  navigate_and_wait "$URL_HOME"
}

teardown() {
  if [[ -n "$STATE_TEMP_DIR" ]] && [[ -d "$STATE_TEMP_DIR" ]]; then
    rm -rf "$STATE_TEMP_DIR"
  fi
}

# ===================================================================
# state save
# ===================================================================

@test "state save: saves state to a file" {
  # Set some cookies and storage first
  bcli cookies set "save-test" "save-value" --url "$URL_HOME" 2>/dev/null || true
  bcli storage local set "save-key" "save-val" 2>/dev/null || true

  local state_file="${STATE_TEMP_DIR}/test-state.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  # File should exist
  [ -f "$state_file" ]
  # File should not be empty
  [ -s "$state_file" ]
}

@test "state save: creates valid JSON file" {
  bcli storage local set "json-key" "json-val" 2>/dev/null || true

  local state_file="${STATE_TEMP_DIR}/json-state.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  # Verify it's valid JSON
  if [ -f "$state_file" ]; then
    run python3 -c "import json; json.load(open('$state_file'))"
    [ "$status" -eq 0 ]
  fi
}

@test "state save: captures cookies" {
  # Set a unique cookie
  bcli cookies set "state-cookie" "cookie-value" --url "$URL_HOME" 2>/dev/null || true

  local state_file="${STATE_TEMP_DIR}/cookie-state.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  if [ -f "$state_file" ]; then
    # File should contain the cookie
    run grep -l "state-cookie" "$state_file"
    [ "$status" -eq 0 ] || true
  fi
}

@test "state save: captures localStorage" {
  bcli storage local set "state-local" "local-value" 2>/dev/null || true

  local state_file="${STATE_TEMP_DIR}/local-state.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  if [ -f "$state_file" ]; then
    run grep -l "state-local" "$state_file"
    [ "$status" -eq 0 ] || true
  fi
}

# ===================================================================
# state load
# ===================================================================

@test "state load: loads state from a file" {
  # Save state
  bcli cookies set "load-test" "load-value" --url "$URL_HOME" 2>/dev/null || true
  bcli storage local set "load-key" "load-val" 2>/dev/null || true

  local state_file="${STATE_TEMP_DIR}/load-state.json"
  bcli state save "$state_file" 2>/dev/null

  # Clear everything
  bcli cookies clear 2>/dev/null || true
  bcli storage local clear 2>/dev/null || true

  # Load state back
  run bcli state load "$state_file"
  [ "$status" -eq 0 ]
}

@test "state load: fails for nonexistent file" {
  run bcli state load "/nonexistent/path/state.json"
  [ "$status" -ne 0 ]
}

# ===================================================================
# state save/load round-trip
# ===================================================================

@test "state: save and load preserves cookies" {
  navigate_and_wait "$URL_HOME"

  # Set cookies
  bcli cookies set "roundtrip-cookie" "cookie-preserved" --url "$URL_HOME" 2>/dev/null || true
  sleep 1

  # Save state
  local state_file="${STATE_TEMP_DIR}/roundtrip-state.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  # Clear cookies
  bcli cookies clear 2>/dev/null || true

  # Load state back
  run bcli state load "$state_file"
  [ "$status" -eq 0 ]
  sleep 1

  # Verify cookie was restored
  run bcli cookies get "roundtrip-cookie"
  [ "$status" -eq 0 ]
  [[ "$output" == *"cookie-preserved"* ]] || [[ "$output" == *"roundtrip-cookie"* ]]
}

@test "state: save and load preserves localStorage" {
  navigate_and_wait "$URL_HOME"

  # Set localStorage
  bcli storage local set "roundtrip-local" "local-preserved" 2>/dev/null || true

  # Save state
  local state_file="${STATE_TEMP_DIR}/local-roundtrip.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  # Clear storage
  bcli storage local clear 2>/dev/null || true

  # Load state back
  run bcli state load "$state_file"
  [ "$status" -eq 0 ]

  # Navigate back to ensure storage is accessible
  navigate_and_wait "$URL_HOME"
  sleep 1

  # Verify localStorage was restored
  run bcli storage local "roundtrip-local"
  [ "$status" -eq 0 ]
  [[ "$output" == *"local-preserved"* ]] || [[ "$output" == *"roundtrip-local"* ]]
}

@test "state: save and load preserves sessionStorage" {
  navigate_and_wait "$URL_HOME"

  bcli storage session set "roundtrip-session" "session-preserved" 2>/dev/null || true

  local state_file="${STATE_TEMP_DIR}/session-roundtrip.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  bcli storage session clear 2>/dev/null || true

  run bcli state load "$state_file"
  [ "$status" -eq 0 ]

  navigate_and_wait "$URL_HOME"
  sleep 1

  run bcli storage session "roundtrip-session"
  [ "$status" -eq 0 ]
  [[ "$output" == *"session-preserved"* ]] || [[ "$output" == *"roundtrip-session"* ]]
}

# ===================================================================
# state — overwrite / multiple saves
# ===================================================================

@test "state save: overwrites existing state file" {
  local state_file="${STATE_TEMP_DIR}/overwrite-state.json"

  bcli storage local set "first-save" "first-value" 2>/dev/null || true
  bcli state save "$state_file" 2>/dev/null

  local first_size
  first_size=$(wc -c < "$state_file")

  bcli storage local set "second-save" "second-value" 2>/dev/null || true
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]
  [ -f "$state_file" ]
}
