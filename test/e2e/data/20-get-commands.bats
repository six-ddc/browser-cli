#!/usr/bin/env bats
# 20-get-commands.bats — E2E tests for `get` subcommands
#
# Tests: get text, get html, get value, get attr, get url, get title, get count, get box

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
# get url
# ===========================================================================

@test "get url: returns current page URL" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get url
  assert_success
  assert_output --partial "/login"
}

@test "get url: updates after navigation" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli get url
  assert_success
  assert_output --partial "/checkboxes"
}

# ===========================================================================
# get title
# ===========================================================================

@test "get title: returns page title" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get title
  assert_success
  assert_output --partial "The Internet"
}

# ===========================================================================
# get text
# ===========================================================================

@test "get text: returns element text content" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get text "h2"
  assert_success
  assert_output --partial "Login Page"
}

@test "get text: returns nested text content" {
  navigate_and_wait "$URL_HOME"

  run bcli get text "h1"
  assert_success
  assert_output --partial "Welcome"
}

@test "get text: fails for nonexistent selector" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get text ".nonexistent-element"
  assert_failure
}

# ===========================================================================
# get html
# ===========================================================================

@test "get html: returns innerHTML of element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get html "#login button"
  assert_success
  assert_output --partial "Login"
}

@test "get html --outer: returns outerHTML including element tag" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get html "#login button" --outer
  assert_success
  assert_output --partial "<button"
  assert_output --partial "Login"
}

@test "get html: returns form innerHTML with nested elements" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get html "#login"
  assert_success
  assert_output --partial "input"
}

# ===========================================================================
# get value
# ===========================================================================

@test "get value: returns empty string for unfilled input" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get value "$SEL_USERNAME"
  assert_success
  assert_output ""
}

@test "get value: returns value after fill" {
  navigate_and_wait "$URL_LOGIN"
  bcli fill "$SEL_USERNAME" "$TEST_USERNAME"
  sleep 0.5

  run bcli get value "$SEL_USERNAME"
  assert_success
  assert_output "$TEST_USERNAME"
}

@test "get value: returns value after clearing and re-filling" {
  navigate_and_wait "$URL_LOGIN"
  bcli fill "$SEL_USERNAME" "first"
  sleep 0.5
  bcli clear "$SEL_USERNAME"
  sleep 0.5
  bcli fill "$SEL_USERNAME" "second"
  sleep 0.5

  run bcli get value "$SEL_USERNAME"
  assert_success
  assert_output "second"
}

# ===========================================================================
# get attr
# ===========================================================================

@test "get attr: returns attribute value" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get attr "$SEL_USERNAME" "name"
  assert_success
  assert_output "username"
}

@test "get attr: returns type attribute of button" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get attr "$SEL_LOGIN_BTN" "type"
  assert_success
  assert_output "submit"
}

@test "get attr: returns id attribute" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get attr "$SEL_USERNAME" "id"
  assert_success
  assert_output "username"
}

@test "get attr: returns null for nonexistent attribute" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get attr "$SEL_USERNAME" "data-nonexistent"
  assert_success
  assert_output "null"
}

# ===========================================================================
# get count
# ===========================================================================

@test "get count: counts matching elements" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli get count "$SEL_CHECKBOX"
  assert_success
  assert_output "2"
}

@test "get count: returns 0 for no matches" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get count ".nonexistent-class"
  assert_success
  assert_output "0"
}

@test "get count: counts list items on homepage" {
  navigate_and_wait "$URL_HOME"

  run bcli get count "ul li a"
  assert_success
  # Homepage has many links — verify it's a positive number
  local count="$output"
  [[ "$count" =~ ^[0-9]+$ ]]
  [[ "$count" -gt 0 ]]
}

# ===========================================================================
# get box
# ===========================================================================

@test "get box: returns bounding box dimensions" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get box "#login"
  assert_success
  # Output format: x=<n> y=<n> w=<n> h=<n>
  assert_output --regexp "x=[0-9]+ y=[0-9]+ w=[0-9]+ h=[0-9]+"
}

@test "get box: returns non-zero dimensions for visible element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get box "h2"
  assert_success
  assert_output --regexp "x=[0-9]+ y=[0-9]+ w=[0-9]+ h=[0-9]+"
  # Width and height should be positive
  refute_output --partial "w=0 "
  refute_output --partial "h=0"
}

@test "get box: fails for nonexistent element" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get box ".nonexistent-element"
  assert_failure
}
