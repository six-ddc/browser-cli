#!/usr/bin/env bash
# helpers/assertions.bash — Custom BATS assertions for browser-cli E2E tests
#
# These complement bats-assert with browser-specific assertions.
# All assertions print descriptive failure messages suitable for debugging.

# ---------------------------------------------------------------------------
# assert_browser_cli_success — run a browser-cli command and assert exit code 0
# Usage: assert_browser_cli_success <subcommand> [args...]
# ---------------------------------------------------------------------------
assert_browser_cli_success() {
  run bcli "$@"
  if [[ "$status" -ne 0 ]]; then
    echo "browser-cli command failed: bcli $*" >&2
    echo "Exit code: $status" >&2
    echo "Output: $output" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_browser_cli_failure — run a browser-cli command and assert it fails
# Usage: assert_browser_cli_failure <subcommand> [args...]
# ---------------------------------------------------------------------------
assert_browser_cli_failure() {
  run bcli "$@"
  if [[ "$status" -eq 0 ]]; then
    echo "Expected browser-cli command to fail but it succeeded: bcli $*" >&2
    echo "Output: $output" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_url_matches — assert current URL matches a pattern
# Usage: assert_url_matches <pattern>
# Pattern can be a substring or glob-style pattern
# ---------------------------------------------------------------------------
assert_url_matches() {
  local pattern="$1"
  local current_url
  current_url=$(get_current_url)

  # Try exact substring match first
  if [[ "$current_url" == *"$pattern"* ]]; then
    return 0
  fi

  # Try glob-style match
  # shellcheck disable=SC2254
  case "$current_url" in
    $pattern) return 0 ;;
  esac

  echo "URL mismatch:" >&2
  echo "  Expected URL to match: $pattern" >&2
  echo "  Actual URL: $current_url" >&2
  return 1
}

# ---------------------------------------------------------------------------
# assert_url_equals — assert current URL exactly equals expected
# Usage: assert_url_equals <expected_url>
# ---------------------------------------------------------------------------
assert_url_equals() {
  local expected="$1"
  local current_url
  current_url=$(get_current_url)

  if [[ "$current_url" != "$expected" ]]; then
    echo "URL mismatch:" >&2
    echo "  Expected: $expected" >&2
    echo "  Actual:   $current_url" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_visible — assert an element is visible on the page
# Usage: assert_visible <selector>
# ---------------------------------------------------------------------------
assert_visible() {
  local selector="$1"
  if ! is_element_visible "$selector"; then
    echo "Element not visible: $selector" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_not_visible — assert an element is NOT visible
# Usage: assert_not_visible <selector>
# ---------------------------------------------------------------------------
assert_not_visible() {
  local selector="$1"
  if is_element_visible "$selector"; then
    echo "Element unexpectedly visible: $selector" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_checked — assert a checkbox/radio is checked
# Usage: assert_checked <selector>
# ---------------------------------------------------------------------------
assert_checked() {
  local selector="$1"
  if ! is_element_checked "$selector"; then
    echo "Element not checked: $selector" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_not_checked — assert a checkbox/radio is NOT checked
# Usage: assert_not_checked <selector>
# ---------------------------------------------------------------------------
assert_not_checked() {
  local selector="$1"
  if is_element_checked "$selector"; then
    echo "Element unexpectedly checked: $selector" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_count — assert number of elements matching selector
# Usage: assert_count <selector> <expected_count>
# ---------------------------------------------------------------------------
assert_count() {
  local selector="$1"
  local expected="$2"
  local actual
  actual=$(bcli get count "$selector" 2>/dev/null | tr -d '[:space:]')

  if [[ "$actual" != "$expected" ]]; then
    echo "Element count mismatch for '$selector':" >&2
    echo "  Expected: $expected" >&2
    echo "  Actual:   $actual" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_text_equals — assert element text content equals expected
# Usage: assert_text_equals <selector> <expected_text>
# ---------------------------------------------------------------------------
assert_text_equals() {
  local selector="$1"
  local expected="$2"
  local actual
  actual=$(get_element_text "$selector")

  if [[ "$actual" != "$expected" ]]; then
    echo "Text mismatch for '$selector':" >&2
    echo "  Expected: $expected" >&2
    echo "  Actual:   $actual" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_text_contains — assert element text contains substring
# Usage: assert_text_contains <selector> <substring>
# ---------------------------------------------------------------------------
assert_text_contains() {
  local selector="$1"
  local substring="$2"
  local actual
  actual=$(get_element_text "$selector")

  if [[ "$actual" != *"$substring"* ]]; then
    echo "Text does not contain substring for '$selector':" >&2
    echo "  Expected to contain: $substring" >&2
    echo "  Actual text: $actual" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_value_equals — assert input element value equals expected
# Usage: assert_value_equals <selector> <expected_value>
# ---------------------------------------------------------------------------
assert_value_equals() {
  local selector="$1"
  local expected="$2"
  local actual
  actual=$(get_element_value "$selector")

  if [[ "$actual" != "$expected" ]]; then
    echo "Value mismatch for '$selector':" >&2
    echo "  Expected: $expected" >&2
    echo "  Actual:   $actual" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_element_exists — assert at least one element matches the selector
# Usage: assert_element_exists <selector>
# ---------------------------------------------------------------------------
assert_element_exists() {
  local selector="$1"
  if ! selector_exists "$selector"; then
    echo "No elements found matching: $selector" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_element_not_exists — assert no elements match the selector
# Usage: assert_element_not_exists <selector>
# ---------------------------------------------------------------------------
assert_element_not_exists() {
  local selector="$1"
  if selector_exists "$selector"; then
    echo "Elements unexpectedly found matching: $selector" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# assert_snapshot_contains — take a snapshot and assert it contains text
# Usage: assert_snapshot_contains <text> [snapshot_flags...]
# ---------------------------------------------------------------------------
assert_snapshot_contains() {
  local expected_text="$1"
  shift
  local snapshot_output
  snapshot_output=$(bcli snapshot "$@" 2>/dev/null)

  if [[ "$snapshot_output" != *"$expected_text"* ]]; then
    echo "Snapshot does not contain expected text:" >&2
    echo "  Expected to contain: $expected_text" >&2
    echo "  Snapshot (first 500 chars): ${snapshot_output:0:500}" >&2
    return 1
  fi
}
