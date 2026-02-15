#!/usr/bin/env bats
# 31-storage.bats — E2E tests for `storage` commands
#
# Tests: storage local, storage local set, storage local clear,
#        storage session, storage session set, storage session clear

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

  # Navigate and clear storage before each test for isolation
  navigate_and_wait "$URL_HOME"
  bcli storage local clear 2>/dev/null || true
  bcli storage session clear 2>/dev/null || true
  sleep 0.5
}

# ===========================================================================
# localStorage — set
# ===========================================================================

@test "storage local set: sets a key-value pair" {
  run bcli storage local set mykey myvalue
  assert_success
  assert_output --partial "Set"
}

@test "storage local set: sets key with special characters in value" {
  run bcli storage local set specialkey "hello world 123"
  assert_success
  assert_output --partial "Set"
}

# ===========================================================================
# localStorage — get
# ===========================================================================

@test "storage local: gets specific key value" {
  bcli storage local set testkey testvalue
  sleep 0.5

  run bcli storage local testkey
  assert_success
  assert_output --partial "testkey=testvalue"
}

@test "storage local: gets all entries when no key specified" {
  bcli storage local set key1 value1
  bcli storage local set key2 value2
  sleep 0.5

  run bcli storage local
  assert_success
  assert_output --partial "key1=value1"
  assert_output --partial "key2=value2"
}

@test "storage local: shows (empty) when no entries" {
  run bcli storage local
  assert_success
  assert_output --partial "(empty)"
}

@test "storage local: returns only matching key" {
  bcli storage local set alpha one
  bcli storage local set beta two
  sleep 0.5

  run bcli storage local alpha
  assert_success
  assert_output --partial "alpha=one"
  refute_output --partial "beta=two"
}

# ===========================================================================
# localStorage — clear
# ===========================================================================

@test "storage local clear: clears all localStorage" {
  bcli storage local set clearme clearval
  sleep 0.5

  run bcli storage local clear
  assert_success
  assert_output --partial "Cleared"

  # Verify empty
  run bcli storage local
  assert_success
  assert_output --partial "(empty)"
}

# ===========================================================================
# localStorage — round-trip
# ===========================================================================

@test "storage local: set-get round-trip preserves value" {
  local key="roundtrip"
  local value="testvalue123"

  bcli storage local set "$key" "$value"
  sleep 0.5

  run bcli storage local "$key"
  assert_success
  assert_output --partial "${key}=${value}"
}

@test "storage local: overwrite existing value" {
  bcli storage local set overwrite original
  sleep 0.5
  bcli storage local set overwrite updated
  sleep 0.5

  run bcli storage local overwrite
  assert_success
  assert_output --partial "overwrite=updated"
}

@test "storage local: set multiple, clear, verify empty" {
  bcli storage local set first firstval
  bcli storage local set second secondval
  bcli storage local set third thirdval
  sleep 0.5

  # Verify all set
  run bcli storage local
  assert_success
  assert_output --partial "first=firstval"
  assert_output --partial "second=secondval"
  assert_output --partial "third=thirdval"

  # Clear all
  bcli storage local clear
  sleep 0.5

  # Verify empty
  run bcli storage local
  assert_success
  assert_output --partial "(empty)"
}

# ===========================================================================
# sessionStorage — set
# ===========================================================================

@test "storage session set: sets a key-value pair" {
  run bcli storage session set sesskey sessvalue
  assert_success
  assert_output --partial "Set"
}

@test "storage session set: sets key with special characters in value" {
  run bcli storage session set specialsess "hello session 456"
  assert_success
  assert_output --partial "Set"
}

# ===========================================================================
# sessionStorage — get
# ===========================================================================

@test "storage session: gets specific key value" {
  bcli storage session set testkey testvalue
  sleep 0.5

  run bcli storage session testkey
  assert_success
  assert_output --partial "testkey=testvalue"
}

@test "storage session: gets all entries when no key specified" {
  bcli storage session set key1 value1
  bcli storage session set key2 value2
  sleep 0.5

  run bcli storage session
  assert_success
  assert_output --partial "key1=value1"
  assert_output --partial "key2=value2"
}

@test "storage session: shows (empty) when no entries" {
  run bcli storage session
  assert_success
  assert_output --partial "(empty)"
}

@test "storage session: returns only matching key" {
  bcli storage session set gamma three
  bcli storage session set delta four
  sleep 0.5

  run bcli storage session gamma
  assert_success
  assert_output --partial "gamma=three"
  refute_output --partial "delta=four"
}

# ===========================================================================
# sessionStorage — clear
# ===========================================================================

@test "storage session clear: clears all sessionStorage" {
  bcli storage session set clearme clearval
  sleep 0.5

  run bcli storage session clear
  assert_success
  assert_output --partial "Cleared"

  # Verify empty
  run bcli storage session
  assert_success
  assert_output --partial "(empty)"
}

# ===========================================================================
# sessionStorage — round-trip
# ===========================================================================

@test "storage session: set-get round-trip preserves value" {
  local key="sessround"
  local value="sessvalue789"

  bcli storage session set "$key" "$value"
  sleep 0.5

  run bcli storage session "$key"
  assert_success
  assert_output --partial "${key}=${value}"
}

@test "storage session: overwrite existing value" {
  bcli storage session set overwrite original
  sleep 0.5
  bcli storage session set overwrite updated
  sleep 0.5

  run bcli storage session overwrite
  assert_success
  assert_output --partial "overwrite=updated"
}

@test "storage session: set multiple, clear, verify empty" {
  bcli storage session set first firstval
  bcli storage session set second secondval
  bcli storage session set third thirdval
  sleep 0.5

  # Verify all set
  run bcli storage session
  assert_success
  assert_output --partial "first=firstval"
  assert_output --partial "second=secondval"
  assert_output --partial "third=thirdval"

  # Clear all
  bcli storage session clear
  sleep 0.5

  # Verify empty
  run bcli storage session
  assert_success
  assert_output --partial "(empty)"
}

# ===========================================================================
# Cross-area isolation
# ===========================================================================

@test "storage: localStorage and sessionStorage are isolated" {
  bcli storage local set isolated localvalue
  bcli storage session set isolated sessionvalue
  sleep 0.5

  # Local should have localvalue
  run bcli storage local isolated
  assert_success
  assert_output --partial "isolated=localvalue"

  # Session should have sessionvalue
  run bcli storage session isolated
  assert_success
  assert_output --partial "isolated=sessionvalue"
}

@test "storage: clearing local does not affect session" {
  bcli storage local set localonly localval
  bcli storage session set sessiononly sessionval
  sleep 0.5

  # Clear local only
  bcli storage local clear
  sleep 0.5

  # Local should be empty
  run bcli storage local
  assert_success
  assert_output --partial "(empty)"

  # Session should still have its value
  run bcli storage session sessiononly
  assert_success
  assert_output --partial "sessiononly=sessionval"
}

@test "storage: clearing session does not affect local" {
  bcli storage local set localonly localval
  bcli storage session set sessiononly sessionval
  sleep 0.5

  # Clear session only
  bcli storage session clear
  sleep 0.5

  # Session should be empty
  run bcli storage session
  assert_success
  assert_output --partial "(empty)"

  # Local should still have its value
  run bcli storage local localonly
  assert_success
  assert_output --partial "localonly=localval"
}
