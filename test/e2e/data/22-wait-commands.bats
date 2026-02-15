#!/usr/bin/env bats
# 22-wait-commands.bats — E2E tests for `wait` command variants
#
# Tests: wait <ms>, wait <selector>, wait --url, wait --text, wait --load, wait --fn, wait --hidden

# Load helpers
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

# ===========================================================================
# wait <ms> — Duration wait
# ===========================================================================

@test "wait duration: waits for specified milliseconds" {
  navigate_and_wait "$URL_HOME"

  local start_time end_time elapsed
  start_time=$(date +%s)
  run bcli wait 1000
  end_time=$(date +%s)
  elapsed=$((end_time - start_time))

  assert_success
  assert_output --partial "Waited for 1000ms"
  # Should take at least 1 second
  [[ "$elapsed" -ge 1 ]]
}

@test "wait duration: short wait completes quickly" {
  navigate_and_wait "$URL_HOME"

  run bcli wait 100
  assert_success
  assert_output --partial "Waited for 100ms"
}

# ===========================================================================
# wait <selector> — Selector wait
# ===========================================================================

@test "wait selector: succeeds for existing element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli wait "$SEL_USERNAME"
  assert_success
  assert_output --partial "Found: $SEL_USERNAME"
}

@test "wait selector: succeeds for heading element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli wait "h2"
  assert_success
  assert_output --partial "Found: h2"
}

@test "wait selector: times out for nonexistent element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli wait ".never-going-to-exist" --timeout 2000
  assert_failure
}

@test "wait selector: waits for dynamically loaded element" {
  navigate_and_wait "$URL_DYNAMIC_LOADING_2"
  # Click Start to trigger async loading
  bcli click "#start button"

  # Wait for the dynamically loaded element
  run bcli wait "#finish" --timeout 10000
  assert_success
  assert_output --partial "Found: #finish"
}

@test "wait selector: respects custom timeout" {
  navigate_and_wait "$URL_LOGIN"

  # Short timeout for nonexistent element
  local start_time end_time elapsed
  start_time=$(date +%s)
  run bcli wait ".nonexistent" --timeout 2000
  end_time=$(date +%s)
  elapsed=$((end_time - start_time))

  assert_failure
  # Should timeout around 2 seconds, not the default 10
  [[ "$elapsed" -le 5 ]]
}

# ===========================================================================
# wait --hidden — Wait for element to become hidden
# ===========================================================================

@test "wait --hidden: waits until element is removed" {
  navigate_and_wait "$URL_DYNAMIC_CONTROLS"
  # Click Remove to hide the checkbox
  bcli click "#checkbox-example button"

  # Wait for the checkbox to become hidden
  run bcli wait "#checkbox" --hidden --timeout 10000
  assert_success
}

# ===========================================================================
# wait --url — URL pattern wait
# ===========================================================================

@test "wait --url: succeeds when URL already matches" {
  navigate_and_wait "$URL_LOGIN"

  run bcli wait --url "login" --timeout 5000
  assert_success
  assert_output --partial "/login"
}

@test "wait --url: waits for URL change after login" {
  navigate_and_wait "$URL_LOGIN"
  # Fill credentials and submit to trigger URL change
  bcli fill "$SEL_USERNAME" "$TEST_USERNAME"
  bcli fill "$SEL_PASSWORD" "$TEST_PASSWORD"
  # Click login to trigger navigation
  bcli click "$SEL_LOGIN_BTN" &
  local click_pid=$!

  run bcli wait --url "secure" --timeout 10000
  assert_success
  assert_output --partial "secure"

  wait "$click_pid" 2>/dev/null || true
}

# ===========================================================================
# wait --text — Text content wait
# ===========================================================================

@test "wait --text: succeeds when text is already present" {
  navigate_and_wait "$URL_LOGIN"

  run bcli wait --text "Login Page" --timeout 5000
  assert_success
  assert_output --partial "Found text: Login Page"
}

@test "wait --text: waits for dynamically loaded text" {
  navigate_and_wait "$URL_DYNAMIC_LOADING_2"
  # Click Start to trigger async loading
  bcli click "#start button"

  # Wait for the text to appear
  run bcli wait --text "Hello World!" --timeout 10000
  assert_success
  assert_output --partial "Found text: Hello World!"
}

@test "wait --text: times out when text never appears" {
  navigate_and_wait "$URL_LOGIN"

  run bcli wait --text "This text will never appear on the page" --timeout 2000
  assert_failure
}

# ===========================================================================
# wait --load — Load state wait
# ===========================================================================

@test "wait --load: waits for page load (default)" {
  navigate_and_wait "$URL_HOME"

  run bcli wait --load
  assert_success
  assert_output --partial "Load state: load"
}

@test "wait --load domcontentloaded: waits for DOMContentLoaded" {
  navigate_and_wait "$URL_HOME"

  run bcli wait --load domcontentloaded
  assert_success
  assert_output --partial "Load state: domcontentloaded"
}

@test "wait --load networkidle: waits for network idle" {
  navigate_and_wait "$URL_HOME"

  run bcli wait --load networkidle --timeout 15000
  assert_success
  assert_output --partial "Load state: networkidle"
}

# ===========================================================================
# wait --fn — JavaScript function wait
# ===========================================================================

@test "wait --fn: succeeds when condition is already true" {
  navigate_and_wait "$URL_HOME"

  run bcli wait --fn "document.querySelectorAll('a').length > 0"
  assert_success
  assert_output --partial "Function condition met"
}

@test "wait --fn: checks document.title" {
  navigate_and_wait "$URL_LOGIN"

  run bcli wait --fn "document.title.includes('Internet')"
  assert_success
  assert_output --partial "Function condition met"
}

@test "wait --fn: times out for false condition" {
  navigate_and_wait "$URL_HOME"

  run bcli wait --fn "document.getElementById('does-not-exist') !== null" --timeout 2000
  assert_failure
}

# ===========================================================================
# waitforurl command (alias)
# ===========================================================================

@test "waitforurl: works as alias for wait --url" {
  navigate_and_wait "$URL_LOGIN"

  run bcli waitforurl "login" --timeout 5000
  assert_success
  assert_output --partial "/login"
}
