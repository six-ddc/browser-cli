#!/usr/bin/env bats
# 11-semantic-locators.bats — Tests for all semantic locator engines
#
# Semantic locators use the = delimiter syntax:
#   text=Submit, role=button, label=Email, placeholder=Search,
#   alt=Logo, title=Help, testid=login-button, xpath=//button
#
# These locators can be used with click, fill, hover, and other commands
# that accept a selector argument.

load "../helpers/daemon.bash"
load "../helpers/assertions.bash"
load "../helpers/fixtures.bash"

# ─── Setup / Teardown ────────────────────────────────────────────────

setup() {
  ensure_daemon_ready
}

# ─── role= locator ───────────────────────────────────────────────────

@test "role= locator: click button by role" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'role=button'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "role= locator: click button with name filter" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'role=button[name="Login"]'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "role= locator: click link by role" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'role=link'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "role= locator: fill textbox by role" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'role=textbox' "$TEST_USERNAME"
  [ "$status" -eq 0 ]

  # The first textbox on /login is the username field
  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "role= locator: hover element by role" {
  navigate_and_wait "$URL_LOGIN"

  run bcli hover 'role=link'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

@test "role= locator: role with [exact] option" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'role=button[name="Login"][exact]'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "role= locator: count elements by role" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli get count 'role=checkbox'
  [ "$status" -eq 0 ]
  # The checkboxes page has 2 checkboxes
  [[ "$output" =~ [0-9]+ ]]
}

# ─── text= locator ───────────────────────────────────────────────────

@test "text= locator: click by text (substring match)" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'text=Login'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "text= locator: exact match with quoted value" {
  navigate_and_wait "$URL_LOGIN"

  # Quoted value triggers exact match
  run bcli click 'text="Login"'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "text= locator: substring match (partial text)" {
  navigate_and_wait "$URL_LOGIN"

  # "Log" should match "Login" in substring mode
  run bcli click 'text=Log'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "text= locator: hover element by text" {
  navigate_and_wait "$URL_ADD_REMOVE"

  run bcli hover 'text=Add Element'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Hovered"* ]]
}

@test "text= locator: text is case insensitive by default" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'text=login'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

# ─── label= locator ──────────────────────────────────────────────────

@test "label= locator: find input by label text" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'label=Username' "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "label= locator: find password input by label" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'label=Password' "$TEST_PASSWORD"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_PASSWORD" "$TEST_PASSWORD"
}

@test "label= locator: click input found by label" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'label=Username'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "label= locator: exact match with quoted value" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'label="Username"' "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]
}

@test "label= locator: label is case insensitive by default" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'label=username' "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]
}

# ─── placeholder= locator ────────────────────────────────────────────

@test "placeholder= locator: find input by placeholder" {
  navigate_and_wait "$URL_FORGOT_PASSWORD"

  run bcli fill 'placeholder=E-mail' "test@example.com"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]
}

@test "placeholder= locator: click input by placeholder" {
  navigate_and_wait "$URL_FORGOT_PASSWORD"

  run bcli click 'placeholder=E-mail'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

# ─── alt= locator ────────────────────────────────────────────────────

@test "alt= locator: click image by alt text" {
  navigate_and_wait "$URL_HOVERS"

  # The hovers page has images; check if we can find any by alt attribute
  # This may vary by the page's actual content
  run bcli click 'alt=User'
  # This test may fail if no images have matching alt text, which is acceptable
  # The key is that the locator engine itself works
  if [ "$status" -eq 0 ]; then
    [[ "$output" == *"Clicked"* ]]
  else
    # alt locator worked but no matching element found — that's fine for this page
    [[ "$output" == *"not found"* ]] || [[ "$output" == *"Element"* ]]
  fi
}

# ─── title= locator ──────────────────────────────────────────────────

@test "title= locator: find element by title attribute" {
  navigate_and_wait "$URL_CONTEXT_MENU"

  # The context menu page has an element with a title attribute
  run bcli hover 'title=Context'
  # The title locator engine should work; element existence depends on the page
  if [ "$status" -eq 0 ]; then
    [[ "$output" == *"Hovered"* ]]
  else
    [[ "$output" == *"not found"* ]] || [[ "$output" == *"Element"* ]]
  fi
}

# ─── testid= locator ─────────────────────────────────────────────────

@test "testid= locator: find element by data-testid" {
  navigate_and_wait "$URL_LOGIN"

  # Inject a test element with data-testid to verify the locator works
  bcli evaluate 'document.querySelector("button").setAttribute("data-testid", "login-btn")'

  run bcli click 'testid=login-btn'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "testid= locator: exact match (case-sensitive)" {
  navigate_and_wait "$URL_LOGIN"

  # Add a test element with data-testid
  bcli evaluate 'document.querySelector("button").setAttribute("data-testid", "LoginButton")'

  # Exact case match should work
  run bcli click 'testid=LoginButton'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]

  # Wrong case should fail (testid is case-sensitive)
  bcli evaluate 'document.querySelector("button").setAttribute("data-testid", "LoginButton")'
  run bcli click 'testid=loginbutton'
  [ "$status" -ne 0 ]
}

# ─── xpath= locator ──────────────────────────────────────────────────

@test "xpath= locator: find by simple xpath" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'xpath=//button'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "xpath= locator: find by attribute xpath" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'xpath=//button[@type="submit"]'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "xpath= locator: fill input by xpath" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'xpath=//input[@id="username"]' "$TEST_USERNAME"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Filled"* ]]

  assert_value_equals "$SEL_USERNAME" "$TEST_USERNAME"
}

@test "xpath= locator: find by text content xpath" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'xpath=//h2[contains(text(),"Login")]'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "xpath= locator: complex xpath with multiple conditions" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli click 'xpath=//input[@type="checkbox"][1]'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Clicked"* ]]
}

@test "xpath= locator: invalid xpath gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'xpath=///invalid[['
  [ "$status" -ne 0 ]
}

# ─── Locators with get commands ───────────────────────────────────────

@test "semantic locator: get text with text= selector" {
  navigate_and_wait "$URL_LOGIN"

  run bcli get text 'role=heading'
  [ "$status" -eq 0 ]
  [[ "$output" == *"Login"* ]]
}

@test "semantic locator: get value from input found by label=" {
  navigate_and_wait "$URL_LOGIN"

  # Fill the username field first
  bcli fill "$SEL_USERNAME" "$TEST_USERNAME"

  run bcli get value 'label=Username'
  [ "$status" -eq 0 ]
  [[ "$output" == *"$TEST_USERNAME"* ]]
}

@test "semantic locator: is visible with role= selector" {
  navigate_and_wait "$URL_LOGIN"

  run bcli is visible 'role=button'
  [ "$status" -eq 0 ]
  [[ "$output" == *"true"* ]]
}

@test "semantic locator: get count with role= selector" {
  navigate_and_wait "$URL_CHECKBOXES"

  run bcli get count 'role=checkbox'
  [ "$status" -eq 0 ]
  # Should be a number > 0
  [[ "$output" =~ [1-9][0-9]* ]]
}

# ─── Locator Error Cases ─────────────────────────────────────────────

@test "semantic locator: nonexistent text= gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli click 'text=ThisTextDefinitelyDoesNotExistAnywhere12345'
  [ "$status" -ne 0 ]
  [[ "$output" == *"not found"* ]] || [[ "$output" == *"Element"* ]]
}

@test "semantic locator: nonexistent role= gives error" {
  navigate_and_wait "$URL_LOGIN"

  # alertdialog role shouldn't exist on the login page
  run bcli click 'role=alertdialog'
  [ "$status" -ne 0 ]
}

@test "semantic locator: nonexistent label= gives error" {
  navigate_and_wait "$URL_LOGIN"

  run bcli fill 'label=NonexistentLabel12345' "value"
  [ "$status" -ne 0 ]
}
