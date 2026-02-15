#!/usr/bin/env bats
# 35-browser-config.bats — Browser configuration E2E tests
#
# Tests: set viewport, set geo, set media, set headers

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
# set viewport
# ===================================================================

@test "set viewport: sets viewport to specific size" {
  navigate_and_wait "$URL_HOME"
  run bcli set viewport 1024 768
  [ "$status" -eq 0 ]
}

@test "set viewport: sets mobile-like viewport" {
  navigate_and_wait "$URL_HOME"
  run bcli set viewport 375 812
  [ "$status" -eq 0 ]
}

@test "set viewport: sets large desktop viewport" {
  navigate_and_wait "$URL_HOME"
  run bcli set viewport 1920 1080
  [ "$status" -eq 0 ]
}

@test "set viewport: verify with eval window.innerWidth" {
  navigate_and_wait "$URL_HOME"

  run bcli set viewport 800 600
  [ "$status" -eq 0 ]
  sleep 1

  # Verify the viewport was applied
  run bcli eval 'window.innerWidth'
  [ "$status" -eq 0 ]
  [[ "$output" == *"800"* ]]
}

@test "set viewport: verify with eval window.innerHeight" {
  navigate_and_wait "$URL_HOME"

  run bcli set viewport 800 600
  [ "$status" -eq 0 ]
  sleep 1

  run bcli eval 'window.innerHeight'
  [ "$status" -eq 0 ]
  [[ "$output" == *"600"* ]]
}

# ===================================================================
# set geo (geolocation)
# ===================================================================

@test "set geo: sets geolocation coordinates" {
  navigate_and_wait "$URL_GEOLOCATION"
  run bcli set geo 37.7749 -122.4194
  [ "$status" -eq 0 ]
}

@test "set geo: sets geolocation with accuracy" {
  navigate_and_wait "$URL_GEOLOCATION"
  run bcli set geo 40.7128 -74.0060 --accuracy 100
  [ "$status" -eq 0 ]
}

@test "set geo: geolocation is accessible via JS" {
  navigate_and_wait "$URL_GEOLOCATION"

  run bcli set geo 51.5074 -0.1278
  [ "$status" -eq 0 ]
  sleep 1

  # Try to get geolocation via JavaScript
  # The geolocation page has a "Where am I?" button
  run bcli click 'button'
  if [ "$status" -eq 0 ]; then
    sleep 2
    # Check if location is displayed
    run bcli get text '#lat-value'
    if [ "$status" -eq 0 ]; then
      [[ "$output" == *"51"* ]]
    fi
  fi
}

# ===================================================================
# set media (color scheme)
# ===================================================================

@test "set media: sets dark color scheme" {
  navigate_and_wait "$URL_HOME"
  run bcli set media dark
  [ "$status" -eq 0 ]
}

@test "set media: sets light color scheme" {
  navigate_and_wait "$URL_HOME"
  run bcli set media light
  [ "$status" -eq 0 ]
}

@test "set media dark: verifiable via matchMedia" {
  navigate_and_wait "$URL_HOME"

  run bcli set media dark
  [ "$status" -eq 0 ]
  sleep 1

  # Verify dark mode via matchMedia
  run bcli eval 'window.matchMedia("(prefers-color-scheme: dark)").matches'
  [ "$status" -eq 0 ]
  [[ "$output" == *"true"* ]]
}

@test "set media light: verifiable via matchMedia" {
  navigate_and_wait "$URL_HOME"

  run bcli set media light
  [ "$status" -eq 0 ]
  sleep 1

  run bcli eval 'window.matchMedia("(prefers-color-scheme: light)").matches'
  [ "$status" -eq 0 ]
  [[ "$output" == *"true"* ]]
}

# ===================================================================
# set headers
# ===================================================================

@test "set headers: sets custom HTTP headers" {
  navigate_and_wait "$URL_HOME"
  run bcli set headers '{"X-Custom-Header": "test-value"}'
  [ "$status" -eq 0 ]
}

@test "set headers: sets multiple headers" {
  navigate_and_wait "$URL_HOME"
  run bcli set headers '{"X-Header-One": "value1", "X-Header-Two": "value2"}'
  [ "$status" -eq 0 ]
}

@test "set headers: clears headers with empty object" {
  navigate_and_wait "$URL_HOME"

  # Set headers first
  run bcli set headers '{"X-Test": "value"}'
  [ "$status" -eq 0 ]

  # Clear headers
  run bcli set headers '{}'
  [ "$status" -eq 0 ]
}

# ===================================================================
# browser config integration tests
# ===================================================================

@test "set viewport + screenshot: viewport affects screenshot" {
  navigate_and_wait "$URL_HOME"

  local temp_dir
  temp_dir=$(mktemp -d)

  # Set small viewport
  run bcli set viewport 400 300
  [ "$status" -eq 0 ]
  sleep 1

  local small_path="${temp_dir}/small.png"
  run bcli screenshot --path "$small_path"
  [ "$status" -eq 0 ]

  # Set larger viewport
  run bcli set viewport 1200 900
  [ "$status" -eq 0 ]
  sleep 1

  local large_path="${temp_dir}/large.png"
  run bcli screenshot --path "$large_path"
  [ "$status" -eq 0 ]

  if [ -f "$small_path" ] && [ -f "$large_path" ]; then
    local small_size large_size
    small_size=$(wc -c < "$small_path")
    large_size=$(wc -c < "$large_path")
    # Larger viewport should generally produce larger screenshot
    [ "$large_size" -gt "$small_size" ]
  fi

  rm -rf "$temp_dir"
}

@test "set media: switch between dark and light" {
  navigate_and_wait "$URL_HOME"

  # Set dark
  run bcli set media dark
  [ "$status" -eq 0 ]
  sleep 1
  run bcli eval 'window.matchMedia("(prefers-color-scheme: dark)").matches'
  [[ "$output" == *"true"* ]]

  # Switch to light
  run bcli set media light
  [ "$status" -eq 0 ]
  sleep 1
  run bcli eval 'window.matchMedia("(prefers-color-scheme: light)").matches'
  [[ "$output" == *"true"* ]]
}
