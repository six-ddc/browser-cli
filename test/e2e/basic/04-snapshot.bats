#!/usr/bin/env bats
# 04-snapshot.bats — Snapshot command E2E tests
#
# Tests: snapshot (accessibility tree), flags: -i, -c, -C, -d, -s
#        element reference generation, ref count output

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
# Basic snapshot
# ===================================================================

@test "snapshot: default snapshot returns accessibility tree" {
  navigate_and_wait "$URL_HOME"

  run bcli snapshot
  assert_success
  # Should contain some content from the page
  assert_output --partial "The Internet"
}

@test "snapshot: outputs interactive element count on stderr" {
  navigate_and_wait "$URL_LOGIN"

  # Capture both stdout and stderr
  run bcli snapshot
  assert_success
  # The ref count is output to stderr which `run` captures in $output
  assert_output --partial "interactive elements"
}

# ===================================================================
# -i / --interactive flag
# ===================================================================

@test "snapshot -i: shows only interactive elements" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -i
  assert_success

  # Should contain interactive elements (inputs, buttons)
  assert_output --partial "textbox"

  # The interactive snapshot should be shorter than a full snapshot
  local interactive_lines
  interactive_lines=$(echo "$output" | wc -l)

  run bcli snapshot
  assert_success
  local full_lines
  full_lines=$(echo "$output" | wc -l)

  # Interactive-only should have fewer lines
  [[ "$interactive_lines" -lt "$full_lines" ]]
}

@test "snapshot --interactive: long form flag works" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot --interactive
  assert_success
  assert_output --partial "textbox"
}

# ===================================================================
# -c / --compact flag
# ===================================================================

@test "snapshot -c: compact output format" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -c
  assert_success
  # Compact output should still contain page content
  [[ -n "$output" ]]
}

@test "snapshot --compact: long form flag works" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot --compact
  assert_success
  [[ -n "$output" ]]
}

# ===================================================================
# -ic (interactive + compact combined)
# ===================================================================

@test "snapshot -ic: interactive compact shows @e refs" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -ic
  assert_success
  # Should contain element references
  assert_output --partial "@e"
}

@test "snapshot -ic: contains form elements" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -ic
  assert_success
  # Login page should show textbox or input elements
  assert_output --partial "textbox"
}

@test "snapshot -ic: refs are numbered sequentially" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -ic
  assert_success
  # Should have @e1 at minimum
  assert_output --partial "@e1"
}

# ===================================================================
# -C / --cursor flag
# ===================================================================

@test "snapshot -C: includes cursor-interactive elements" {
  navigate_and_wait "$URL_HOME"

  run bcli snapshot -C
  assert_success
  # Should include elements with cursor:pointer (like links)
  [[ -n "$output" ]]
}

@test "snapshot -iC: interactive + cursor combined" {
  navigate_and_wait "$URL_HOME"

  run bcli snapshot -iC
  assert_success
  # With cursor flag, should potentially show more elements than just -i
  [[ -n "$output" ]]
}

# ===================================================================
# -d / --depth flag
# ===================================================================

@test "snapshot -d 1: limits tree depth to 1 level" {
  navigate_and_wait "$URL_HOME"

  run bcli snapshot -d 1
  assert_success

  local shallow_lines
  shallow_lines=$(echo "$output" | wc -l)

  run bcli snapshot -d 5
  assert_success

  local deep_lines
  deep_lines=$(echo "$output" | wc -l)

  # Shallower depth should produce fewer lines (or at most equal)
  [[ "$shallow_lines" -le "$deep_lines" ]]
}

@test "snapshot -d 2: limits tree depth to 2 levels" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -d 2
  assert_success
  [[ -n "$output" ]]
}

@test "snapshot --depth: long form flag works" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot --depth 3
  assert_success
  [[ -n "$output" ]]
}

# ===================================================================
# -s / --selector flag
# ===================================================================

@test "snapshot -s: scopes to specific element" {
  navigate_and_wait "$URL_LOGIN"

  # Scope to the form element only
  run bcli snapshot -s 'form'
  assert_success
  # Should contain form content (inputs, button)
  assert_output --partial "textbox"
}

@test "snapshot -s: scoped snapshot is smaller than full" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -s 'form'
  assert_success
  local scoped_length=${#output}

  run bcli snapshot
  assert_success
  local full_length=${#output}

  # Scoped snapshot should be shorter
  [[ "$scoped_length" -lt "$full_length" ]]
}

@test "snapshot --selector: long form flag works" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot --selector 'form'
  assert_success
  assert_output --partial "textbox"
}

# ===================================================================
# Combined flags
# ===================================================================

@test "snapshot -ic -s: interactive compact scoped to element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli snapshot -ic -s 'form'
  assert_success
  # Should show interactive elements within the form
  assert_output --partial "@e"
  assert_output --partial "textbox"
}

@test "snapshot -ic -d 2: interactive compact with depth limit" {
  navigate_and_wait "$URL_HOME"

  run bcli snapshot -ic -d 2
  assert_success
  [[ -n "$output" ]]
}

# ===================================================================
# Element refs used in subsequent commands
# ===================================================================

@test "element refs: snapshot -ic then click @e1" {
  navigate_and_wait "$URL_CHECKBOXES"

  # Take snapshot to populate refs
  bcli snapshot -ic

  # Click via element ref
  run bcli click '@e1'
  assert_success
  assert_output --partial "Clicked"
}

@test "element refs: snapshot -ic then fill @e ref" {
  navigate_and_wait "$URL_LOGIN"

  # Take snapshot to populate refs
  bcli snapshot -ic

  # Fill the username input (@e2, since @e1 is the GitHub link)
  run bcli fill '@e2' 'refvalue'
  assert_success
  assert_output --partial "Filled"
}

@test "element refs: snapshot -ic then get text via @e ref" {
  navigate_and_wait "$URL_LOGIN"

  # Take snapshot to populate refs
  bcli snapshot -ic

  # Try getting text from an element ref
  run bcli get text '@e1'
  assert_success
}

# ===================================================================
# Snapshot on different page types
# ===================================================================

@test "snapshot: works on page with checkboxes" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli snapshot
  assert_success
  assert_output --partial "checkbox"
}

@test "snapshot: works on page with dropdown" {
  navigate_and_wait "$URL_DROPDOWN"

  run bcli snapshot -i
  assert_success
  # Should contain a combobox or listbox role
  [[ "$output" == *"combobox"* ]] || [[ "$output" == *"listbox"* ]] || [[ "$output" == *"option"* ]]
}

@test "snapshot: works on page with links" {
  navigate_and_wait "$URL_HOME"

  run bcli snapshot -i
  assert_success
  assert_output --partial "link"
}
