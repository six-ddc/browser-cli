#!/usr/bin/env bats
# 01-navigation.bats — Navigation command E2E tests
#
# Tests: navigate (goto/open), back, forward, reload, get url, get title

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
  # Verify daemon is running before each test
  ensure_daemon_ready
}

# ===================================================================
# navigate command
# ===================================================================

@test "navigate: loads a page and returns title + URL" {
  run bcli navigate "$URL_HOME"
  assert_success
  # navigate outputs: title\nurl
  assert_output --partial "the-internet.herokuapp.com"
}

@test "navigate: URL is correct after navigation" {
  navigate_and_wait "$URL_LOGIN"
  assert_url_matches "/login"
}

@test "navigate (alias goto): works with goto alias" {
  run bcli goto "$URL_CHECKBOXES"
  assert_success
  sleep "$BCLI_PAGE_LOAD_WAIT"
  assert_url_matches "/checkboxes"
}

@test "navigate (alias open): works with open alias" {
  run bcli open "$URL_DROPDOWN"
  assert_success
  sleep "$BCLI_PAGE_LOAD_WAIT"
  assert_url_matches "/dropdown"
}

# ===================================================================
# get url / get title
# ===================================================================

@test "get url: returns current page URL" {
  navigate_and_wait "$URL_LOGIN"
  run bcli get url
  assert_success
  assert_output --partial "/login"
}

@test "get title: returns current page title" {
  navigate_and_wait "$URL_LOGIN"
  run bcli get title
  assert_success
  # The login page has a title containing "The Internet"
  assert_output --partial "The Internet"
}

# ===================================================================
# back / forward
# ===================================================================

@test "back: navigates back in history" {
  # Navigate to two pages to build history
  navigate_and_wait "$URL_LOGIN"
  navigate_and_wait "$URL_CHECKBOXES"
  assert_url_matches "/checkboxes"

  # Go back
  run bcli back
  assert_success
  sleep "$BCLI_PAGE_LOAD_WAIT"
  assert_url_matches "/login"
}

@test "forward: navigates forward in history" {
  # Navigate to two pages
  navigate_and_wait "$URL_LOGIN"
  navigate_and_wait "$URL_CHECKBOXES"

  # Go back then forward
  bcli back
  sleep "$BCLI_PAGE_LOAD_WAIT"
  assert_url_matches "/login"

  run bcli forward
  assert_success
  sleep "$BCLI_PAGE_LOAD_WAIT"
  assert_url_matches "/checkboxes"
}

@test "back + forward: round-trip preserves URL" {
  navigate_and_wait "$URL_LOGIN"
  navigate_and_wait "$URL_DROPDOWN"

  bcli back
  sleep "$BCLI_PAGE_LOAD_WAIT"
  bcli forward
  sleep "$BCLI_PAGE_LOAD_WAIT"
  assert_url_matches "/dropdown"
}

# ===================================================================
# reload
# ===================================================================

@test "reload: reloads the current page" {
  navigate_and_wait "$URL_LOGIN"

  run bcli reload
  assert_success
  sleep "$BCLI_PAGE_LOAD_WAIT"
  # URL should still be the login page after reload
  assert_url_matches "/login"
}

@test "reload: returns title and URL" {
  navigate_and_wait "$URL_HOME"

  run bcli reload
  assert_success
  # reload outputs title\nurl just like navigate
  assert_output --partial "the-internet.herokuapp.com"
}

# ===================================================================
# Navigation to different page types
# ===================================================================

@test "navigate: handles pages with dynamic content" {
  run bcli navigate "$URL_DYNAMIC_CONTENT"
  assert_success
  sleep "$BCLI_PAGE_LOAD_WAIT"
  assert_url_matches "/dynamic_content"
}

@test "navigate: handles pages with forms" {
  navigate_and_wait "$URL_LOGIN"
  # Verify the page has the expected form elements
  assert_element_exists "$SEL_USERNAME"
  assert_element_exists "$SEL_PASSWORD"
  assert_element_exists "$SEL_LOGIN_BTN"
}
