#!/usr/bin/env bats
# 19-mouse-keydown.bats — Mouse control and keydown/keyup E2E tests
#
# Tests: mouse move/down/up/wheel, keydown, keyup

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
# mouse move
# ===================================================================

@test "mouse move: moves mouse to coordinates" {
  navigate_and_wait "$URL_HOME"
  run bcli mouse move 100 200
  [ "$status" -eq 0 ]
}

@test "mouse move: moves to different positions" {
  navigate_and_wait "$URL_HOME"
  run bcli mouse move 0 0
  [ "$status" -eq 0 ]

  run bcli mouse move 500 300
  [ "$status" -eq 0 ]
}

# ===================================================================
# mouse down / up
# ===================================================================

@test "mouse down: presses mouse button" {
  navigate_and_wait "$URL_HOME"
  run bcli mouse move 100 100
  [ "$status" -eq 0 ]

  run bcli mouse down
  [ "$status" -eq 0 ]

  # Release to clean up
  run bcli mouse up
  [ "$status" -eq 0 ]
}

@test "mouse down: presses left button explicitly" {
  navigate_and_wait "$URL_HOME"
  run bcli mouse move 100 100
  [ "$status" -eq 0 ]

  run bcli mouse down left
  [ "$status" -eq 0 ]

  run bcli mouse up left
  [ "$status" -eq 0 ]
}

@test "mouse up: releases mouse button" {
  navigate_and_wait "$URL_HOME"
  run bcli mouse move 100 100
  [ "$status" -eq 0 ]

  run bcli mouse down
  [ "$status" -eq 0 ]

  run bcli mouse up
  [ "$status" -eq 0 ]
}

@test "mouse: full click cycle (move + down + up)" {
  navigate_and_wait "$URL_HOME"

  # Move to a position, then click cycle
  run bcli mouse move 200 200
  [ "$status" -eq 0 ]

  run bcli mouse down
  [ "$status" -eq 0 ]

  run bcli mouse up
  [ "$status" -eq 0 ]
}

# ===================================================================
# mouse wheel
# ===================================================================

@test "mouse wheel: scrolls vertically" {
  navigate_and_wait "$URL_LARGE_PAGE"
  run bcli mouse wheel 200
  [ "$status" -eq 0 ]
}

@test "mouse wheel: scrolls with deltaX" {
  navigate_and_wait "$URL_LARGE_PAGE"
  run bcli mouse wheel 0 100
  [ "$status" -eq 0 ]
}

@test "mouse wheel: negative delta scrolls up" {
  navigate_and_wait "$URL_LARGE_PAGE"
  # First scroll down
  bcli mouse wheel 500 2>/dev/null
  sleep 1

  # Then scroll back up
  run bcli mouse wheel -300
  [ "$status" -eq 0 ]
}

# ===================================================================
# keydown
# ===================================================================

@test "keydown: presses key down" {
  navigate_and_wait "$URL_KEY_PRESSES"
  run bcli keydown "Shift"
  [ "$status" -eq 0 ]

  # Release the key
  run bcli keyup "Shift"
  [ "$status" -eq 0 ]
}

@test "keydown: presses Control key" {
  navigate_and_wait "$URL_KEY_PRESSES"
  run bcli keydown "Control"
  [ "$status" -eq 0 ]

  run bcli keyup "Control"
  [ "$status" -eq 0 ]
}

@test "keydown: presses letter key" {
  navigate_and_wait "$URL_KEY_PRESSES"
  run bcli keydown "a"
  [ "$status" -eq 0 ]

  run bcli keyup "a"
  [ "$status" -eq 0 ]
}

# ===================================================================
# keyup
# ===================================================================

@test "keyup: releases key" {
  navigate_and_wait "$URL_KEY_PRESSES"
  run bcli keydown "Shift"
  [ "$status" -eq 0 ]

  run bcli keyup "Shift"
  [ "$status" -eq 0 ]
}

# ===================================================================
# keydown + keyup integration
# ===================================================================

@test "keydown + keyup: modifier key sequence" {
  navigate_and_wait "$URL_KEY_PRESSES"

  # Hold Shift, press 'a', release both
  run bcli keydown "Shift"
  [ "$status" -eq 0 ]

  run bcli press "a"
  [ "$status" -eq 0 ]

  run bcli keyup "Shift"
  [ "$status" -eq 0 ]
}

@test "keydown + keyup: Control+a select all pattern" {
  navigate_and_wait "$URL_LOGIN"
  bcli fill "$SEL_USERNAME" "test-keydown" 2>/dev/null

  # Focus the input
  bcli focus "$SEL_USERNAME" 2>/dev/null

  # Control+A to select all
  run bcli keydown "Control"
  [ "$status" -eq 0 ]

  run bcli press "a"
  [ "$status" -eq 0 ]

  run bcli keyup "Control"
  [ "$status" -eq 0 ]
}

# ===================================================================
# mouse + keydown integration
# ===================================================================

@test "mouse + keydown: Shift+Click pattern" {
  navigate_and_wait "$URL_HOME"

  # Hold Shift
  run bcli keydown "Shift"
  [ "$status" -eq 0 ]

  # Move mouse and click
  run bcli mouse move 200 200
  [ "$status" -eq 0 ]

  run bcli mouse down
  [ "$status" -eq 0 ]

  run bcli mouse up
  [ "$status" -eq 0 ]

  # Release Shift
  run bcli keyup "Shift"
  [ "$status" -eq 0 ]
}
