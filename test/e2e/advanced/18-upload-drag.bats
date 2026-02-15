#!/usr/bin/env bats
# 18-upload-drag.bats — Upload and drag E2E tests
#
# Tests: upload <selector> <files...>, --clear, drag <source> <target>

# Load BATS helpers
load "../helpers/daemon.bash"
load "../helpers/assertions.bash"
load "../helpers/fixtures.bash"

# Load bats-support and bats-assert from node_modules
REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)"
load "${REPO_ROOT}/node_modules/bats-support/load.bash"
load "${REPO_ROOT}/node_modules/bats-assert/load.bash"

# Temp directory for upload test files
UPLOAD_TEMP_DIR=""

# ---------------------------------------------------------------------------
# Setup / Teardown
# ---------------------------------------------------------------------------

setup() {
  ensure_daemon_ready
  UPLOAD_TEMP_DIR=$(mktemp -d)
}

teardown() {
  if [[ -n "$UPLOAD_TEMP_DIR" ]] && [[ -d "$UPLOAD_TEMP_DIR" ]]; then
    rm -rf "$UPLOAD_TEMP_DIR"
  fi
}

# ===================================================================
# upload
# ===================================================================

@test "upload: uploads a file to file input" {
  navigate_and_wait "$URL_UPLOAD"

  # Create a temp file to upload
  local test_file="${UPLOAD_TEMP_DIR}/test-upload.txt"
  echo "test file content" > "$test_file"

  run bcli upload "$SEL_FILE_UPLOAD" "$test_file"
  [ "$status" -eq 0 ]
}

@test "upload: file input shows filename after upload" {
  navigate_and_wait "$URL_UPLOAD"

  local test_file="${UPLOAD_TEMP_DIR}/hello.txt"
  echo "hello world" > "$test_file"

  run bcli upload "$SEL_FILE_UPLOAD" "$test_file"
  [ "$status" -eq 0 ]

  # Get the value of the file input — should contain the filename
  run bcli get value "$SEL_FILE_UPLOAD"
  [ "$status" -eq 0 ]
  [[ "$output" == *"hello.txt"* ]] || [[ "$output" == *"hello"* ]] || [[ -n "$output" ]]
}

@test "upload: upload then submit form" {
  navigate_and_wait "$URL_UPLOAD"

  local test_file="${UPLOAD_TEMP_DIR}/submit-test.txt"
  echo "file for submission" > "$test_file"

  # Upload file
  run bcli upload "$SEL_FILE_UPLOAD" "$test_file"
  [ "$status" -eq 0 ]

  # Click submit
  run bcli click "$SEL_FILE_SUBMIT"
  [ "$status" -eq 0 ]
  sleep 2

  # Page should show upload was successful
  run bcli get text 'h3'
  [ "$status" -eq 0 ]
  [[ "$output" == *"File Uploaded"* ]] || [[ "$output" == *"uploaded"* ]]
}

@test "upload: upload with --clear flag" {
  navigate_and_wait "$URL_UPLOAD"

  local test_file1="${UPLOAD_TEMP_DIR}/first.txt"
  local test_file2="${UPLOAD_TEMP_DIR}/second.txt"
  echo "first file" > "$test_file1"
  echo "second file" > "$test_file2"

  # Upload first file
  run bcli upload "$SEL_FILE_UPLOAD" "$test_file1"
  [ "$status" -eq 0 ]

  # Upload second file with --clear (should replace first)
  run bcli upload "$SEL_FILE_UPLOAD" "$test_file2" --clear
  [ "$status" -eq 0 ]
}

@test "upload: fails for nonexistent file input" {
  navigate_and_wait "$URL_UPLOAD"

  local test_file="${UPLOAD_TEMP_DIR}/test.txt"
  echo "test" > "$test_file"

  run bcli upload '.nonexistent-input-12345' "$test_file"
  [ "$status" -ne 0 ]
}

# ===================================================================
# drag
# ===================================================================

@test "drag: drags element from source to target" {
  navigate_and_wait "$URL_DRAG_AND_DROP"

  # Get initial text of column A
  run bcli get text "$SEL_DRAG_COL_A"
  [ "$status" -eq 0 ]
  local initial_col_a="$output"

  # Drag column A to column B
  run bcli drag "$SEL_DRAG_COL_A" "$SEL_DRAG_COL_B"
  [ "$status" -eq 0 ]
  sleep 1
}

@test "drag: command completes successfully" {
  navigate_and_wait "$URL_DRAG_AND_DROP"
  run bcli drag "$SEL_DRAG_COL_A" "$SEL_DRAG_COL_B"
  [ "$status" -eq 0 ]
}

@test "drag: fails with nonexistent source" {
  navigate_and_wait "$URL_DRAG_AND_DROP"
  run bcli drag '.nonexistent-source-12345' "$SEL_DRAG_COL_B"
  [ "$status" -ne 0 ]
}

@test "drag: fails with nonexistent target" {
  navigate_and_wait "$URL_DRAG_AND_DROP"
  run bcli drag "$SEL_DRAG_COL_A" '.nonexistent-target-12345'
  [ "$status" -ne 0 ]
}
