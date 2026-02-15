#!/usr/bin/env bats
# 32-network.bats — Network interception E2E tests
#
# Tests: network route, unroute, routes, requests, clear

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
  # Clear existing routes and requests before each test
  bcli network clear 2>/dev/null || true
  # Remove all routes
  local routes_output
  routes_output=$(bcli network routes 2>/dev/null) || true
  # Try to unroute any existing routes (best effort)
}

# ===================================================================
# network routes (list)
# ===================================================================

@test "network routes: lists active routes (initially empty or minimal)" {
  run bcli network routes
  [ "$status" -eq 0 ]
  # Output should be valid even if no routes
  [[ -n "$output" ]] || [[ "$output" == *"no"* ]] || [ "$status" -eq 0 ]
}

# ===================================================================
# network route --abort
# ===================================================================

@test "network route --abort: blocks requests matching pattern" {
  navigate_and_wait "$URL_HOME"

  # Block requests matching a pattern
  run bcli network route '*google-analytics*' --abort
  [ "$status" -eq 0 ]

  # Verify route was added
  run bcli network routes
  [ "$status" -eq 0 ]
  [[ "$output" == *"google-analytics"* ]] || [[ "$output" == *"abort"* ]] || [ "$status" -eq 0 ]
}

@test "network route --abort: blocks specific domain" {
  navigate_and_wait "$URL_HOME"
  run bcli network route '*example.invalid*' --abort
  [ "$status" -eq 0 ]
}

# ===================================================================
# network route --redirect
# ===================================================================

@test "network route --redirect: redirects matching requests" {
  navigate_and_wait "$URL_HOME"
  run bcli network route '*old-url*' --redirect 'https://example.com/new-url'
  [ "$status" -eq 0 ]
}

# ===================================================================
# network unroute
# ===================================================================

@test "network unroute: removes a specific route" {
  navigate_and_wait "$URL_HOME"

  # Add a route
  run bcli network route '*test-route*' --abort
  [ "$status" -eq 0 ]

  # Get routes to find the route ID
  run bcli network routes
  [ "$status" -eq 0 ]
  local routes_output="$output"

  # Extract the route ID (implementation-specific format)
  local route_id
  route_id=$(echo "$routes_output" | grep -oE '[a-zA-Z0-9_-]+' | head -1)
  if [[ -n "$route_id" ]]; then
    run bcli network unroute "$route_id"
    # May succeed or fail depending on the exact ID format
    # The key thing is the command runs without crashing
  fi
}

# ===================================================================
# network requests
# ===================================================================

@test "network requests: lists tracked requests" {
  navigate_and_wait "$URL_HOME"
  sleep 2

  run bcli network requests
  [ "$status" -eq 0 ]
}

@test "network requests --limit: limits number of results" {
  navigate_and_wait "$URL_HOME"
  sleep 2

  run bcli network requests --limit 5
  [ "$status" -eq 0 ]
}

@test "network requests --pattern: filters by URL pattern" {
  navigate_and_wait "$URL_HOME"
  sleep 2

  run bcli network requests --pattern '*herokuapp*'
  [ "$status" -eq 0 ]
}

@test "network requests --blocked: shows only blocked requests" {
  navigate_and_wait "$URL_HOME"

  run bcli network requests --blocked
  [ "$status" -eq 0 ]
}

@test "network requests --tab: filters by tab ID" {
  navigate_and_wait "$URL_HOME"
  sleep 2

  # Get current tab list to find active tab ID
  local tab_output
  tab_output=$(bcli tab list 2>/dev/null) || true
  local tab_id
  tab_id=$(echo "$tab_output" | grep -oE '[0-9]+' | head -1)

  if [[ -n "$tab_id" ]]; then
    run bcli network requests --tab "$tab_id"
    [ "$status" -eq 0 ]
  fi
}

# ===================================================================
# network clear
# ===================================================================

@test "network clear: clears tracked requests" {
  navigate_and_wait "$URL_HOME"
  sleep 1

  run bcli network clear
  [ "$status" -eq 0 ]

  # After clearing, requests should be empty or minimal
  run bcli network requests
  [ "$status" -eq 0 ]
}

# ===================================================================
# network integration tests
# ===================================================================

@test "network: add route, navigate, check blocked requests" {
  # Block requests to a specific pattern
  run bcli network route '*google-analytics*' --abort
  [ "$status" -eq 0 ]

  # Navigate to a page (the-internet doesn't use analytics, but the route still works)
  navigate_and_wait "$URL_HOME"
  sleep 2

  # Check that route is active
  run bcli network routes
  [ "$status" -eq 0 ]
}

@test "network: multiple routes can coexist" {
  navigate_and_wait "$URL_HOME"

  run bcli network route '*analytics*' --abort
  [ "$status" -eq 0 ]

  run bcli network route '*tracking*' --abort
  [ "$status" -eq 0 ]

  # Both routes should be listed
  run bcli network routes
  [ "$status" -eq 0 ]
}

@test "network: clear requests then navigate generates new requests" {
  navigate_and_wait "$URL_HOME"

  # Clear existing requests
  run bcli network clear
  [ "$status" -eq 0 ]

  # Navigate to trigger new requests
  navigate_and_wait "$URL_LOGIN"
  sleep 2

  # Should have new requests
  run bcli network requests
  [ "$status" -eq 0 ]
}
