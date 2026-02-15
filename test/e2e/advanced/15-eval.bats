#!/usr/bin/env bats
# 15-eval.bats — JavaScript evaluation (eval) E2E tests
#
# Tests: eval <expression>, --base64, --stdin

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
# eval — basic expressions
# ===================================================================

@test "eval: evaluates simple arithmetic" {
  navigate_and_wait "$URL_HOME"
  run bcli eval '1 + 2'
  [ "$status" -eq 0 ]
  [[ "$output" == *"3"* ]]
}

@test "eval: returns string result" {
  navigate_and_wait "$URL_HOME"
  run bcli eval '"hello world"'
  [ "$status" -eq 0 ]
  [[ "$output" == *"hello world"* ]]
}

@test "eval: returns boolean result" {
  navigate_and_wait "$URL_HOME"
  run bcli eval 'true'
  [ "$status" -eq 0 ]
  [[ "$output" == *"true"* ]]
}

@test "eval: returns null" {
  navigate_and_wait "$URL_HOME"
  run bcli eval 'null'
  [ "$status" -eq 0 ]
  [[ "$output" == *"null"* ]]
}

@test "eval: returns array" {
  navigate_and_wait "$URL_HOME"
  run bcli eval '[1, 2, 3]'
  [ "$status" -eq 0 ]
  [[ "$output" == *"1"* ]]
  [[ "$output" == *"2"* ]]
  [[ "$output" == *"3"* ]]
}

@test "eval: returns object" {
  navigate_and_wait "$URL_HOME"
  run bcli eval '({key: "value"})'
  [ "$status" -eq 0 ]
  [[ "$output" == *"key"* ]] || [[ "$output" == *"value"* ]]
}

# ===================================================================
# eval — DOM access
# ===================================================================

@test "eval: accesses document.title" {
  navigate_and_wait "$URL_LOGIN"
  run bcli eval 'document.title'
  [ "$status" -eq 0 ]
  [[ "$output" == *"The Internet"* ]]
}

@test "eval: accesses window.location.href" {
  navigate_and_wait "$URL_LOGIN"
  run bcli eval 'window.location.href'
  [ "$status" -eq 0 ]
  [[ "$output" == *"/login"* ]]
}

@test "eval: queries DOM elements" {
  navigate_and_wait "$URL_LOGIN"
  run bcli eval 'document.querySelectorAll("input").length'
  [ "$status" -eq 0 ]
  # Login page has at least 2 inputs (username, password)
  [[ "$output" =~ [0-9]+ ]]
}

@test "eval: gets element text content" {
  navigate_and_wait "$URL_LOGIN"
  run bcli eval 'document.querySelector("h2").textContent'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Login Page"* ]]
}

# ===================================================================
# eval — DOM modification
# ===================================================================

@test "eval: modifies DOM and verify with get" {
  navigate_and_wait "$URL_LOGIN"

  # Change the page title via eval
  run bcli eval 'document.title = "Modified Title"'
  [ "$status" -eq 0 ]

  # Verify with get title
  run bcli get title
  [ "$status" -eq 0 ]
  [[ "$output" == *"Modified Title"* ]]
}

@test "eval: modifies input value and verify with get value" {
  navigate_and_wait "$URL_LOGIN"

  # Set input value via eval
  run bcli eval 'document.querySelector("#username").value = "eval-user"'
  [ "$status" -eq 0 ]

  # Verify with get value
  run bcli get value "$SEL_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"eval-user"* ]]
}

@test "eval: adds element to page and verify with get count" {
  navigate_and_wait "$URL_HOME"

  # Get initial count of a specific selector
  run bcli eval 'document.querySelectorAll(".eval-test-element").length'
  [ "$status" -eq 0 ]
  [[ "$output" == *"0"* ]]

  # Add an element
  run bcli eval 'const el = document.createElement("div"); el.className = "eval-test-element"; document.body.appendChild(el); true'
  [ "$status" -eq 0 ]

  # Verify element exists
  run bcli get count '.eval-test-element'
  [ "$status" -eq 0 ]
  [[ "$output" == *"1"* ]]
}

# ===================================================================
# eval --base64
# ===================================================================

@test "eval --base64: decodes and evaluates base64 expression" {
  navigate_and_wait "$URL_HOME"
  # Base64 encode "1 + 2"
  local encoded
  encoded=$(echo -n '1 + 2' | base64)
  run bcli eval --base64 "$encoded"
  [ "$status" -eq 0 ]
  [[ "$output" == *"3"* ]]
}

@test "eval --base64: evaluates complex base64-encoded expression" {
  navigate_and_wait "$URL_LOGIN"
  # Base64 encode 'document.title'
  local encoded
  encoded=$(echo -n 'document.title' | base64)
  run bcli eval --base64 "$encoded"
  [ "$status" -eq 0 ]
  [[ "$output" == *"The Internet"* ]]
}

@test "eval -b: short flag works for base64" {
  navigate_and_wait "$URL_HOME"
  local encoded
  encoded=$(echo -n '"hello from base64"' | base64)
  run bcli eval -b "$encoded"
  [ "$status" -eq 0 ]
  [[ "$output" == *"hello from base64"* ]]
}

# ===================================================================
# eval --stdin
# ===================================================================

@test "eval --stdin: reads expression from stdin" {
  navigate_and_wait "$URL_HOME"
  run bash -c "echo '2 + 3' | node \"$BROWSER_CLI\" --session \"$BROWSER_CLI_SESSION\" eval --stdin"
  [ "$status" -eq 0 ]
  [[ "$output" == *"5"* ]]
}

@test "eval --stdin: reads complex expression from stdin" {
  navigate_and_wait "$URL_LOGIN"
  run bash -c "echo 'document.title' | node \"$BROWSER_CLI\" --session \"$BROWSER_CLI_SESSION\" eval --stdin"
  [ "$status" -eq 0 ]
  [[ "$output" == *"The Internet"* ]]
}

# ===================================================================
# eval — error handling
# ===================================================================

@test "eval: invalid JavaScript returns null (errors caught)" {
  navigate_and_wait "$URL_HOME"
  run bcli eval 'this is not valid javascript {{{'
  # eval catches errors and returns null with exit 0
  [ "$status" -eq 0 ]
  [[ "$output" == *"null"* ]]
}

@test "eval: referencing undefined variable returns null" {
  navigate_and_wait "$URL_HOME"
  run bcli eval 'nonExistentVariable12345'
  # Undefined variable ReferenceError is caught, returns null
  [ "$status" -eq 0 ]
  [[ "$output" == *"null"* ]]
}

# ===================================================================
# eval — integration tests
# ===================================================================

@test "eval: top-level await not supported (returns null)" {
  navigate_and_wait "$URL_HOME"
  # Top-level await is not supported by chrome.scripting.executeScript
  # The await keyword causes a syntax error, which is caught and returns null
  run bcli eval 'await new Promise(r => setTimeout(r, 100)); "async done"'
  [ "$status" -eq 0 ]
  [[ "$output" == *"null"* ]]
}

@test "eval: interact with page after eval modification" {
  navigate_and_wait "$URL_LOGIN"

  # Create a custom button via eval
  run bcli eval 'const btn = document.createElement("button"); btn.id = "eval-btn"; btn.textContent = "EvalButton"; document.body.appendChild(btn); true'
  [ "$status" -eq 0 ]

  # Click the button we just created
  run bcli click '#eval-btn'
  [ "$status" -eq 0 ]

  # Get text of the button
  run bcli get text '#eval-btn'
  [ "$status" -eq 0 ]
  [[ "$output" == *"EvalButton"* ]]
}
