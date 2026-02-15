#!/usr/bin/env bats
# 30-cookies.bats — E2E tests for `cookies` commands
#
# Tests: cookies (list), cookies get, cookies set, cookies clear

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

  # Navigate to test site and clear cookies before each test for isolation
  navigate_and_wait "$URL_HOME"
  bcli cookies clear 2>/dev/null || true
  sleep 0.5
}

# ===========================================================================
# cookies set
# ===========================================================================

@test "cookies set: sets a basic cookie" {
  run bcli cookies set testcookie testvalue --url "$URL_HOME"
  assert_success
  assert_output --partial "Cookie set"
}

@test "cookies set: sets cookie with domain" {
  run bcli cookies set domcookie domvalue \
    --url "$URL_HOME" \
    --domain "the-internet.herokuapp.com"
  assert_success
  assert_output --partial "Cookie set"
}

@test "cookies set: sets cookie with path" {
  run bcli cookies set pathcookie pathvalue \
    --url "$URL_LOGIN" \
    --path "/login"
  assert_success
  assert_output --partial "Cookie set"
}

@test "cookies set: sets cookie with secure flag" {
  run bcli cookies set securecookie securevalue \
    --url "$URL_HOME" \
    --secure
  assert_success
  assert_output --partial "Cookie set"
}

@test "cookies set: sets cookie with httponly flag" {
  run bcli cookies set httponlycookie httponlyvalue \
    --url "$URL_HOME" \
    --httponly
  assert_success
  assert_output --partial "Cookie set"
}

@test "cookies set: sets cookie with samesite" {
  run bcli cookies set samecookie samevalue \
    --url "$URL_HOME" \
    --samesite lax
  assert_success
  assert_output --partial "Cookie set"
}

# ===========================================================================
# cookies get (after setting)
# ===========================================================================

@test "cookies get: retrieves set cookie by name" {
  bcli cookies set mycookie myvalue --url "$URL_HOME"
  sleep 0.5

  run bcli cookies get mycookie
  assert_success
  assert_output --partial "mycookie=myvalue"
}

@test "cookies get: shows all cookies when no name given" {
  bcli cookies set cookie1 value1 --url "$URL_HOME"
  bcli cookies set cookie2 value2 --url "$URL_HOME"
  sleep 0.5

  run bcli cookies get
  assert_success
  assert_output --partial "cookie1=value1"
  assert_output --partial "cookie2=value2"
}

@test "cookies get: filters by --url" {
  bcli cookies set urlcookie urlvalue --url "$URL_HOME"
  sleep 0.5

  run bcli cookies get --url "$URL_HOME"
  assert_success
  assert_output --partial "urlcookie=urlvalue"
}

@test "cookies get: filters by --domain" {
  bcli cookies set domtest domval --url "$URL_HOME"
  sleep 0.5

  run bcli cookies get --domain "the-internet.herokuapp.com"
  assert_success
  assert_output --partial "domtest=domval"
}

@test "cookies get: returns empty when no cookies match name" {
  run bcli cookies get "nonexistent-cookie-name"
  assert_success
  assert_output --partial "(no cookies)"
}

# ===========================================================================
# cookies (list all — bare command)
# ===========================================================================

@test "cookies: lists all cookies (bare command)" {
  bcli cookies set listtest listvalue --url "$URL_HOME"
  sleep 0.5

  run bcli cookies
  assert_success
  assert_output --partial "listtest=listvalue"
  assert_output --partial "Domain:"
}

@test "cookies: shows (no cookies) when empty" {
  run bcli cookies
  assert_success
  assert_output --partial "(no cookies)"
}

@test "cookies: displays cookie flags" {
  bcli cookies set flagtest flagvalue \
    --url "$URL_HOME" \
    --httponly
  sleep 0.5

  run bcli cookies
  assert_success
  assert_output --partial "flagtest=flagvalue"
  assert_output --partial "HttpOnly"
}

# ===========================================================================
# cookies clear
# ===========================================================================

@test "cookies clear: clears all cookies" {
  bcli cookies set clearthis clearval --url "$URL_HOME"
  sleep 0.5

  run bcli cookies clear
  assert_success
  assert_output --partial "Cleared"

  # Verify cookies are gone
  run bcli cookies get
  assert_success
  assert_output --partial "(no cookies)"
}

@test "cookies clear --url: clears cookies for specific URL" {
  bcli cookies set urlclear urlval --url "$URL_HOME"
  sleep 0.5

  run bcli cookies clear --url "$URL_HOME"
  assert_success
  assert_output --partial "Cleared"
}

@test "cookies clear --domain: clears cookies for specific domain" {
  bcli cookies set domclear domval --url "$URL_HOME"
  sleep 0.5

  run bcli cookies clear --domain "the-internet.herokuapp.com"
  assert_success
  assert_output --partial "Cleared"

  # Verify cookies are gone
  run bcli cookies get
  assert_success
  assert_output --partial "(no cookies)"
}

# ===========================================================================
# cookies — round-trip tests
# ===========================================================================

@test "cookies: set then get round-trip preserves value" {
  local cookie_name="roundtrip"
  local cookie_value="testvalue123"

  bcli cookies set "$cookie_name" "$cookie_value" --url "$URL_HOME"
  sleep 0.5

  run bcli cookies get "$cookie_name"
  assert_success
  assert_output --partial "${cookie_name}=${cookie_value}"
}

@test "cookies: set multiple, clear all, verify empty" {
  bcli cookies set first firstval --url "$URL_HOME"
  bcli cookies set second secondval --url "$URL_HOME"
  bcli cookies set third thirdval --url "$URL_HOME"
  sleep 0.5

  # Verify all set
  run bcli cookies get
  assert_success
  assert_output --partial "first=firstval"
  assert_output --partial "second=secondval"
  assert_output --partial "third=thirdval"

  # Clear all
  bcli cookies clear
  sleep 0.5

  # Verify all gone
  run bcli cookies get
  assert_success
  assert_output --partial "(no cookies)"
}

@test "cookies: overwrite existing cookie value" {
  bcli cookies set overwrite original --url "$URL_HOME"
  sleep 0.5

  # Overwrite with new value
  bcli cookies set overwrite updated --url "$URL_HOME"
  sleep 0.5

  run bcli cookies get overwrite
  assert_success
  assert_output --partial "overwrite=updated"
  refute_output --partial "overwrite=original"
}
