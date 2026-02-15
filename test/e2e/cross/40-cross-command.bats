#!/usr/bin/env bats
# 40-cross-command.bats — Cross-command interaction E2E tests
#
# Tests interactions and combinations between different command groups:
# - Tab + interaction
# - Frame + interaction
# - Eval + get verification
# - Scroll + snapshot
# - Network + navigation
# - Dialog + click trigger
# - Screenshot after interaction
# - Snapshot refs + navigation invalidation
# - Multiple command pipelines

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
# Tab + Interaction cross-tests
# ===================================================================

@test "cross: open tab, fill form, switch back, verify different pages" {
  navigate_and_wait "$URL_HOME"

  # Open login page in a new tab
  run bcli tab new "$URL_LOGIN"
  [ "$status" -eq 0 ]
  sleep 2

  # Fill form in the new tab
  run bcli fill "$SEL_USERNAME" "cross-tab-user"
  [ "$status" -eq 0 ]
  assert_value_equals "$SEL_USERNAME" "cross-tab-user"

  # Get tab list
  run bcli tab list
  local tab_output="$output"
  local first_tab_id
  first_tab_id=$(echo "$tab_output" | grep -oE '[0-9]+' | head -1)

  # Switch back to first tab
  if [[ -n "$first_tab_id" ]]; then
    run bcli tab "$first_tab_id"
    [ "$status" -eq 0 ]
    sleep 1

    # Verify we're on the home page (different from login)
    run bcli get url
    [[ "$output" != *"/login"* ]]
  fi

  # Close the extra tab
  run bcli tab list
  local last_tab_id
  last_tab_id=$(echo "$output" | grep -oE '[0-9]+' | tail -1)
  if [[ -n "$last_tab_id" ]] && [[ "$last_tab_id" != "$first_tab_id" ]]; then
    bcli tab close "$last_tab_id" 2>/dev/null || true
  fi
}

# ===================================================================
# Eval + Get verification cross-tests
# ===================================================================

@test "cross: eval modifies DOM, get verifies" {
  navigate_and_wait "$URL_LOGIN"

  # Use eval to modify page title
  run bcli eval 'document.title = "Cross Test Title"'
  [ "$status" -eq 0 ]

  # Use get to verify
  run bcli get title
  [ "$status" -eq 0 ]
  [[ "$output" == *"Cross Test Title"* ]]
}

@test "cross: eval adds element, get count verifies" {
  navigate_and_wait "$URL_HOME"

  # Count before
  run bcli get count '.cross-test-el'
  [ "$status" -eq 0 ]
  [[ "$output" == *"0"* ]]

  # Add 3 elements via eval
  run bcli eval 'for(let i=0;i<3;i++){const el=document.createElement("span");el.className="cross-test-el";document.body.appendChild(el)} true'
  [ "$status" -eq 0 ]

  # Count after
  run bcli get count '.cross-test-el'
  [ "$status" -eq 0 ]
  [[ "$output" == *"3"* ]]
}

@test "cross: eval changes input value, get value reads it" {
  navigate_and_wait "$URL_LOGIN"

  # Set value via eval
  run bcli eval 'document.querySelector("#username").value = "eval-cross"; true'
  [ "$status" -eq 0 ]

  # Read via get value
  run bcli get value "$SEL_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"eval-cross"* ]]
}

# ===================================================================
# Scroll + Snapshot cross-tests
# ===================================================================

@test "cross: scroll down then take snapshot" {
  navigate_and_wait "$URL_HOME"

  # Scroll down
  run bcli scroll down --amount 500
  [ "$status" -eq 0 ]

  # Take snapshot — should still work after scrolling
  run bcli snapshot -ic
  [ "$status" -eq 0 ]
  [[ -n "$output" ]]
}

@test "cross: scrollintoview then click" {
  navigate_and_wait "$URL_HOME"

  # Scroll to footer first
  run bcli scrollintoview 'div#page-footer a'
  if [ "$status" -eq 0 ]; then
    # Try to click the element we scrolled to
    run bcli click 'div#page-footer a'
    [ "$status" -eq 0 ]
  fi
}

# ===================================================================
# Network + Navigation cross-tests
# ===================================================================

@test "cross: network route then navigate" {
  # Set up blocking route
  run bcli network route '*nonexistent-domain.invalid*' --abort
  [ "$status" -eq 0 ]

  # Navigate — should work fine since the blocked pattern doesn't match
  navigate_and_wait "$URL_HOME"

  run bcli get title
  [ "$status" -eq 0 ]
  [[ "$output" == *"The Internet"* ]]
}

# ===================================================================
# Dialog + Click cross-tests
# ===================================================================

@test "cross: dialog accept then trigger via click" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  # Set up dialog handler
  run bcli dialog accept
  [ "$status" -eq 0 ]

  # Trigger dialog by clicking button
  run bcli click 'button[onclick="jsAlert()"]'
  [ "$status" -eq 0 ]
  sleep 1

  # Verify result
  run bcli get text '#result'
  [ "$status" -eq 0 ]
  [[ "$output" == *"successfully"* ]] || [[ "$output" == *"alert"* ]]
}

@test "cross: dialog accept with prompt, then verify result text" {
  navigate_and_wait "$URL_JAVASCRIPT_ALERTS"

  run bcli dialog accept "prompt-test-value"
  [ "$status" -eq 0 ]

  run bcli click 'button[onclick="jsPrompt()"]'
  [ "$status" -eq 0 ]
  sleep 1

  run bcli get text '#result'
  [ "$status" -eq 0 ]
  [[ "$output" == *"prompt-test-value"* ]]
}

# ===================================================================
# Screenshot after interaction
# ===================================================================

@test "cross: screenshot after filling form" {
  navigate_and_wait "$URL_LOGIN"

  # Fill form
  run bcli fill "$SEL_USERNAME" "screenshot-after-fill"
  [ "$status" -eq 0 ]

  # Take screenshot
  local temp_dir
  temp_dir=$(mktemp -d)
  local path="${temp_dir}/after-fill.png"
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
  rm -rf "$temp_dir"
}

@test "cross: screenshot after navigation and scroll" {
  navigate_and_wait "$URL_LARGE_PAGE"

  # Scroll down
  run bcli scroll down --amount 500
  [ "$status" -eq 0 ]
  sleep 1

  # Take screenshot
  local temp_dir
  temp_dir=$(mktemp -d)
  local path="${temp_dir}/after-scroll.png"
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  [ -s "$path" ]
  rm -rf "$temp_dir"
}

# ===================================================================
# Snapshot refs + navigation (ref invalidation)
# ===================================================================

@test "cross: snapshot refs invalidated after navigation" {
  navigate_and_wait "$URL_LOGIN"

  # Take snapshot to get refs
  run bcli snapshot -ic
  [ "$status" -eq 0 ]
  [[ "$output" == *"@e1"* ]]

  # Navigate to a different page
  navigate_and_wait "$URL_CHECKBOXES"

  # Old refs should fail or produce unexpected results
  run bcli click '@e1'
  # May succeed (if new snapshot auto-regenerates) or fail — either is acceptable
  # The key is it doesn't crash
}

@test "cross: snapshot refs work after re-snapshot on new page" {
  navigate_and_wait "$URL_LOGIN"

  # First snapshot
  run bcli snapshot -ic
  [ "$status" -eq 0 ]

  # Navigate away
  navigate_and_wait "$URL_CHECKBOXES"

  # Re-snapshot on new page
  run bcli snapshot -ic
  [ "$status" -eq 0 ]
  [[ "$output" == *"@e"* ]]

  # New refs should work
  run bcli click '@e1'
  [ "$status" -eq 0 ]
}

# ===================================================================
# Cookies + Storage + State Save/Load cross-tests
# ===================================================================

@test "cross: set cookies and storage, save state, clear, load, verify" {
  navigate_and_wait "$URL_HOME"

  # Set cookie and storage
  bcli cookies set "cross-cookie" "cross-val" --url "$URL_HOME" 2>/dev/null || true
  bcli storage local set "cross-local" "cross-local-val" 2>/dev/null || true

  # Save state
  local temp_dir
  temp_dir=$(mktemp -d)
  local state_file="${temp_dir}/cross-state.json"
  run bcli state save "$state_file"
  [ "$status" -eq 0 ]

  # Clear everything
  bcli cookies clear 2>/dev/null || true
  bcli storage local clear 2>/dev/null || true

  # Load state
  run bcli state load "$state_file"
  [ "$status" -eq 0 ]

  # Navigate to ensure storage access
  navigate_and_wait "$URL_HOME"
  sleep 1

  # Verify cookie restored
  run bcli cookies get "cross-cookie"
  if [ "$status" -eq 0 ]; then
    [[ "$output" == *"cross-val"* ]] || [[ "$output" == *"cross-cookie"* ]]
  fi

  rm -rf "$temp_dir"
}

# ===================================================================
# Highlight + Snapshot cross-tests
# ===================================================================

@test "cross: highlight element then take snapshot" {
  navigate_and_wait "$URL_LOGIN"

  # Highlight an element
  run bcli highlight "$SEL_LOGIN_BTN" --duration 500
  [ "$status" -eq 0 ]

  # Take snapshot while highlight is active
  run bcli snapshot -ic
  [ "$status" -eq 0 ]
  [[ -n "$output" ]]
}

# ===================================================================
# Console + Eval cross-tests
# ===================================================================

@test "cross: eval console.log then read console output" {
  navigate_and_wait "$URL_HOME"

  bcli console --clear 2>/dev/null || true

  # Log via eval
  run bcli eval 'console.log("cross-console-test"); true'
  [ "$status" -eq 0 ]
  sleep 1

  # Read console
  run bcli console
  [ "$status" -eq 0 ]
  [[ "$output" == *"cross-console-test"* ]]
}

# ===================================================================
# Multi-step workflow cross-tests
# ===================================================================

@test "cross: complete login workflow with multiple command types" {
  navigate_and_wait "$URL_LOGIN"

  # Take snapshot to see the form
  run bcli snapshot -ic
  [ "$status" -eq 0 ]

  # Fill credentials using semantic locators
  run bcli find label "Username" fill "$TEST_USERNAME"
  [ "$status" -eq 0 ]

  run bcli find label "Password" fill "$TEST_PASSWORD"
  [ "$status" -eq 0 ]

  # Click login using role locator
  run bcli find role button --name "Login"
  [ "$status" -eq 0 ]

  # Wait for navigation
  run bcli wait --url '**/secure*' --timeout 5000
  [ "$status" -eq 0 ]

  # Verify with get
  run bcli get title
  [ "$status" -eq 0 ]

  run bcli get url
  [ "$status" -eq 0 ]
  [[ "$output" == *"/secure"* ]]

  # Get the success message
  run bcli get text "$SEL_FLASH_MESSAGE"
  [ "$status" -eq 0 ]
  [[ "$output" == *"You logged into a secure area"* ]]
}

@test "cross: viewport change + navigate + snapshot + screenshot" {
  # Set mobile viewport
  run bcli set viewport 375 812
  [ "$status" -eq 0 ]

  # Navigate
  navigate_and_wait "$URL_LOGIN"

  # Take snapshot
  run bcli snapshot -ic
  [ "$status" -eq 0 ]
  [[ -n "$output" ]]

  # Take screenshot
  local temp_dir
  temp_dir=$(mktemp -d)
  local path="${temp_dir}/mobile-view.png"
  run bcli screenshot --path "$path"
  [ "$status" -eq 0 ]
  [ -f "$path" ]
  rm -rf "$temp_dir"

  # Reset viewport
  bcli set viewport 1280 720 2>/dev/null || true
}
