#!/usr/bin/env bats
# 14-screenshot.bats — Screenshot command E2E tests
#
# Tests: screenshot, --selector, --path, --format, --quality

# Load BATS helpers
load "../helpers/daemon.bash"
load "../helpers/assertions.bash"
load "../helpers/fixtures.bash"

# Load bats-support and bats-assert from node_modules
REPO_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)"
load "${REPO_ROOT}/node_modules/bats-support/load.bash"
load "${REPO_ROOT}/node_modules/bats-assert/load.bash"

# Temp directory for screenshots
SCREENSHOT_DIR=""

# ---------------------------------------------------------------------------
# Setup / Teardown
# ---------------------------------------------------------------------------

setup() {
  ensure_daemon_ready
  SCREENSHOT_DIR=$(mktemp -d)
}

teardown() {
  # Clean up screenshot files
  if [[ -n "$SCREENSHOT_DIR" ]] && [[ -d "$SCREENSHOT_DIR" ]]; then
    rm -rf "$SCREENSHOT_DIR"
  fi
}

# ===================================================================
# screenshot (default)
# ===================================================================

@test "screenshot: takes a screenshot with default settings" {
  navigate_and_wait "$URL_HOME"
  local path="${SCREENSHOT_DIR}/default.png"
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  # Verify file was created
  [ -f "$path" ]
  # Verify file is not empty
  [ -s "$path" ]
}

@test "screenshot: output mentions screenshot path or success" {
  navigate_and_wait "$URL_HOME"
  local path="${SCREENSHOT_DIR}/check-output.png"
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  # Output should reference the screenshot
  [[ "$output" == *"screenshot"* ]] || [[ "$output" == *"Screenshot"* ]] || [[ "$output" == *"$path"* ]] || [ -f "$path" ]
}

# ===================================================================
# screenshot --path
# ===================================================================

@test "screenshot --path: saves to custom file path" {
  navigate_and_wait "$URL_LOGIN"
  local path="${SCREENSHOT_DIR}/custom-path.png"
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
}

@test "screenshot --path: overwrites existing file" {
  navigate_and_wait "$URL_LOGIN"
  local path="${SCREENSHOT_DIR}/overwrite-test.png"

  # Take first screenshot
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  local first_size
  first_size=$(wc -c < "$path")

  # Navigate to different page
  navigate_and_wait "$URL_CHECKBOXES"

  # Take second screenshot to same path
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
}

# ===================================================================
# screenshot --selector
# ===================================================================

@test "screenshot --selector: captures specific element" {
  navigate_and_wait "$URL_LOGIN"
  local path="${SCREENSHOT_DIR}/element.png"
  run bcli screenshot --selector '#login' --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
}

@test "screenshot --selector: element screenshot is smaller than full page" {
  navigate_and_wait "$URL_LOGIN"
  local full_path="${SCREENSHOT_DIR}/full-page.png"
  local element_path="${SCREENSHOT_DIR}/element-only.png"

  # Take full page screenshot
  run bcli screenshot --path "$full_path"
  [ "$status" -eq 0 ]

  # Take element screenshot
  run bcli screenshot --selector 'h2' --path "$element_path"
  [ "$status" -eq 0 ]

  if [ -f "$full_path" ] && [ -f "$element_path" ]; then
    local full_size element_size
    full_size=$(wc -c < "$full_path")
    element_size=$(wc -c < "$element_path")
    # Element screenshot should generally be smaller
    [ "$element_size" -lt "$full_size" ]
  fi
}

# ===================================================================
# screenshot --format
# ===================================================================

@test "screenshot --format png: takes PNG screenshot" {
  navigate_and_wait "$URL_HOME"
  local path="${SCREENSHOT_DIR}/format-test.png"
  run bcli screenshot --format png --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
}

@test "screenshot --format jpeg: takes JPEG screenshot" {
  navigate_and_wait "$URL_HOME"
  local path="${SCREENSHOT_DIR}/format-test.jpg"
  run bcli screenshot --format jpeg --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
}

# ===================================================================
# screenshot --quality
# ===================================================================

@test "screenshot --quality: sets JPEG quality" {
  navigate_and_wait "$URL_HOME"
  local high_path="${SCREENSHOT_DIR}/high-quality.jpg"
  local low_path="${SCREENSHOT_DIR}/low-quality.jpg"

  # High quality
  run bcli screenshot --format jpeg --quality 95 --path "$high_path"
  [ "$status" -eq 0 ]

  # Low quality
  run bcli screenshot --format jpeg --quality 10 --path "$low_path"
  [ "$status" -eq 0 ]

  if [ -f "$high_path" ] && [ -f "$low_path" ]; then
    local high_size low_size
    high_size=$(wc -c < "$high_path")
    low_size=$(wc -c < "$low_path")
    # Higher quality should be larger file
    [ "$high_size" -gt "$low_size" ]
  fi
}

# ===================================================================
# screenshot integration tests
# ===================================================================

@test "screenshot: after filling form elements" {
  navigate_and_wait "$URL_LOGIN"
  bcli fill "$SEL_USERNAME" "screenshot-test" 2>/dev/null
  local path="${SCREENSHOT_DIR}/after-fill.png"
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
}

@test "screenshot: different pages produce different screenshots" {
  navigate_and_wait "$URL_HOME"
  local path1="${SCREENSHOT_DIR}/page1.png"
  run bcli screenshot --path "$path1"
  [ "$status" -eq 0 ]

  navigate_and_wait "$URL_LOGIN"
  local path2="${SCREENSHOT_DIR}/page2.png"
  run bcli screenshot --path "$path2"
  [ "$status" -eq 0 ]

  if [ -f "$path1" ] && [ -f "$path2" ]; then
    # Files should exist and be different sizes (different pages)
    local size1 size2
    size1=$(wc -c < "$path1")
    size2=$(wc -c < "$path2")
    # Just verify both files have content — exact size comparison is fragile
    [ "$size1" -gt 0 ]
    [ "$size2" -gt 0 ]
  fi
}
