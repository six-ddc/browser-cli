# BATS E2E Testing Guide

Automated end-to-end tests for browser-cli using [BATS](https://github.com/bats-core/bats-core) (Bash Automated Testing System). These tests exercise the CLI against a real Chrome browser with the extension loaded.

## Prerequisites

### 1. System Requirements

- **Node.js >= 20** (required by WXT + Vite 7)
- **pnpm** (package manager)
- **Google Chrome** (or Chromium) installed
- **BATS** and helper libraries

### 2. Install BATS

BATS is included as a dev dependency. Install all project dependencies:

```bash
pnpm install
```

This installs:
- `bats` - test runner
- `bats-support` - common test helpers
- `bats-assert` - assertion library

To verify the installation:

```bash
npx bats --version
```

### 3. Build the Project

```bash
pnpm build
```

This builds both the CLI (tsup) and the extension (WXT + Vite).

### 4. Load the Extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `apps/extension/.output/chrome-mv3/` directory
5. Note the extension ID (shown on the extension card)

### 5. Start the Daemon

```bash
browser-cli start
```

Verify the daemon is running and the extension is connected:

```bash
browser-cli status
# Should show:
#   Daemon: running
#   Extension: connected
```

## Test Directory Structure

```
test/e2e/
  setup_suite.bash          # Suite-level setup/teardown (daemon lifecycle)
  helpers/
    daemon.bash             # Daemon utility functions (start, stop, wait)
    assertions.bash         # Custom BATS assertions
    fixtures.bash           # Test URL constants and shared data
  basic/
    01-navigation.bats      # Navigate, back, forward, reload, get url/title
    02-interaction.bats     # Click, fill, type, check, select
    03-selectors.bats       # CSS, semantic locators, element refs
    04-snapshot.bats        # Snapshot command with flags
    05-tab-management.bats  # Tab list, new, close, switch
    06-frame-management.bats # Frame switch, main, list, current
    07-scroll.bats          # Scroll directions, scrollintoview
    08-window-management.bats # Window list, new, close
  advanced/
    10-find-command.bats    # Find role/text/label + actions
    11-semantic-locators.bats  # All semantic engines
    12-element-refs.bats    # @e1, @e2 usage
    13-position-selectors.bats # first, last, nth selectors
    14-screenshot.bats      # Screenshot with format, selector, quality
    15-eval.bats            # JavaScript eval, --base64, --stdin
    16-dialog.bats          # Dialog accept/dismiss
    17-highlight.bats       # Element highlight with color/duration
    18-upload-drag.bats     # File upload and drag-and-drop
    19-mouse-keydown.bats   # Mouse control and keydown/keyup
  data/
    20-get-commands.bats    # get text/html/value/attr/count/box
    21-is-commands.bats     # is visible/enabled/checked
    22-wait-commands.bats   # wait variants
  state/
    30-cookies.bats         # cookies get/set/clear
    31-storage.bats         # storage local/session
    32-network.bats         # network route/unroute/requests/clear
    33-console-errors.bats  # console output and page errors
    34-state-management.bats # state save/load round-trip
    35-browser-config.bats  # set viewport/geo/media/headers
  cross/
    40-cross-command.bats   # Cross-command interaction tests
    41-global-options.bats  # --json and --session flags
```

## Running Tests

### Run All E2E Tests

```bash
pnpm test:e2e
```

This is equivalent to:

```bash
npx bats test/e2e/**/*.bats
```

### Run a Specific Test Suite

```bash
# By category
pnpm test:e2e:basic        # Navigation, interaction, selectors, snapshot, tabs, frames, scroll, windows
pnpm test:e2e:advanced     # Find, semantic locators, refs, screenshot, eval, dialog, highlight, upload, mouse
pnpm test:e2e:data         # get, is, wait commands
pnpm test:e2e:state        # Cookies, storage, network, console, state mgmt, browser config
pnpm test:e2e:cross        # Cross-command interactions, --json flag

# By individual test file
pnpm test:e2e:tabs         # Tab management
pnpm test:e2e:frames       # Frame management
pnpm test:e2e:scroll       # Scroll operations
pnpm test:e2e:screenshot   # Screenshot
pnpm test:e2e:eval         # JavaScript eval
pnpm test:e2e:dialog       # Dialog handling
pnpm test:e2e:network      # Network interception
pnpm test:e2e:console      # Console & errors
pnpm test:e2e:state-mgmt   # State save/load
pnpm test:e2e:config       # Browser config (viewport, geo, media, headers)

# Or using bats directly
npx bats test/e2e/basic/01-navigation.bats
npx bats test/e2e/advanced/
npx bats test/e2e/cross/
```

### Run a Single Test by Name

Use `--filter` to run tests matching a regex pattern:

```bash
# Run only tests with "back" in the name
npx bats test/e2e/basic/01-navigation.bats --filter "back"

# Run tests matching a pattern across all suites
npx bats test/e2e/**/*.bats --filter "click.*semantic"
```

### Verbose Output

Use `--verbose-run` (or `-x`) to see each command as it executes:

```bash
npx bats test/e2e/basic/01-navigation.bats --verbose-run
```

Use `--show-output-of-passing-tests` to see stdout from passing tests (by default only failing test output is shown):

```bash
npx bats test/e2e/basic/01-navigation.bats --show-output-of-passing-tests
```

### TAP Output

For machine-readable output (useful in CI):

```bash
npx bats test/e2e/**/*.bats --formatter tap
```

### Parallel Execution

Run test files in parallel using `--jobs`:

```bash
# Run with 4 parallel jobs
npx bats test/e2e/**/*.bats --jobs 4
```

**Important**: Parallel execution runs test *files* concurrently, not individual tests within a file. Tests within a single `.bats` file always run sequentially. Since all tests share the same browser and daemon, parallelism should be used carefully -- tests that modify global browser state (cookies, storage, navigation) may conflict.

### JUnit Output (for CI)

```bash
npx bats test/e2e/**/*.bats --formatter junit -o test-results/
```

## Writing Tests

### Basic Test Structure

```bash
#!/usr/bin/env bats

# Load test helpers
setup() {
  load '../helpers/daemon'
  load '../helpers/assertions'
  load '../helpers/fixtures'
}

@test "navigate to a URL and verify" {
  run browser-cli navigate "$TEST_URL"
  assert_success

  run browser-cli get url
  assert_success
  assert_output --partial "the-internet.herokuapp.com"
}

@test "click a button by CSS selector" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success

  run browser-cli click 'button[type="submit"]'
  assert_success
}
```

### Setup and Teardown

BATS provides four lifecycle hooks:

| Hook | Scope | Use For |
|------|-------|---------|
| `setup_suite` | Once per file | Start daemon, load extension |
| `setup` | Before each test | Navigate to test page, load helpers |
| `teardown` | After each test | Clean up test-specific state |
| `teardown_suite` | Once per file | Stop daemon |

`setup_suite` and `teardown_suite` are defined in `test/e2e/setup_suite.bash` and are automatically loaded by BATS when present in the test directory or its ancestors.

```bash
# setup_suite.bash - runs once before all tests in a file
setup_suite() {
  # Ensure daemon is running
  ensure_daemon_running
}

teardown_suite() {
  # Daemon stays running across files (managed externally)
  :
}
```

```bash
# Individual test file
setup() {
  load '../helpers/daemon'
  load '../helpers/assertions'
  load '../helpers/fixtures'

  # Navigate to the page needed for this test file
  browser-cli navigate "$CHECKBOXES_URL"
}

teardown() {
  # Clean up any modified state
  browser-cli cookies clear 2>/dev/null || true
}
```

### Using Helpers

#### daemon.bash

Utility functions for daemon lifecycle management:

```bash
# Wait for the daemon to be ready
wait_for_daemon() {
  local timeout=${1:-10}
  local elapsed=0
  while ! browser-cli status &>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "Daemon failed to start within ${timeout}s" >&2
      return 1
    fi
  done
}

# Ensure daemon is running, start if not
ensure_daemon_running() {
  if ! browser-cli status &>/dev/null; then
    browser-cli start
    wait_for_daemon
  fi
}
```

#### assertions.bash

Custom assertions beyond what bats-assert provides:

```bash
# Assert output contains valid JSON
assert_json() {
  echo "$output" | jq . >/dev/null 2>&1 || {
    echo "Expected valid JSON, got: $output" >&2
    return 1
  }
}

# Assert element ref format (@eN) appears in output
assert_has_element_refs() {
  assert_output --regexp '@e[0-9]+'
}

# Assert error output contains a hint
assert_has_hint() {
  assert_output --partial "hint"
}
```

#### fixtures.bash

Constants for test URLs and shared test data:

```bash
# Test site base URLs
TEST_SITE="https://the-internet.herokuapp.com"
TEST_URL="${TEST_SITE}/"
LOGIN_URL="${TEST_SITE}/login"
CHECKBOXES_URL="${TEST_SITE}/checkboxes"
DROPDOWN_URL="${TEST_SITE}/dropdown"
DYNAMIC_LOADING_URL="${TEST_SITE}/dynamic_loading/2"
IFRAME_URL="${TEST_SITE}/iframe"
KEY_PRESSES_URL="${TEST_SITE}/key_presses"
UPLOAD_URL="${TEST_SITE}/upload"
HOVERS_URL="${TEST_SITE}/hovers"
DRAG_DROP_URL="${TEST_SITE}/drag_and_drop"
LARGE_URL="${TEST_SITE}/large"
DYNAMIC_CONTROLS_URL="${TEST_SITE}/dynamic_controls"
CONTEXT_MENU_URL="${TEST_SITE}/context_menu"
JAVASCRIPT_ALERTS_URL="${TEST_SITE}/javascript_alerts"
JAVASCRIPT_ERROR_URL="${TEST_SITE}/javascript_error"
FORGOT_PASSWORD_URL="${TEST_SITE}/forgot_password"
NESTED_FRAMES_URL="${TEST_SITE}/nested_frames"
```

### Best Practices

#### 1. One Assertion Per Concept

Each test should verify one logical behavior. Multiple `assert_*` calls are fine if they validate the same concept:

```bash
# Good: single concept (navigation works)
@test "navigate sets the URL" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success

  run browser-cli get url
  assert_success
  assert_output --partial "/login"
}

# Bad: testing unrelated things together
@test "navigation and cookies work" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success
  run browser-cli cookies
  assert_success
}
```

#### 2. Use Descriptive Test Names

Test names should describe the expected behavior, not the steps:

```bash
# Good
@test "fill sets input value for React controlled components" { ... }
@test "find nth 2 selects the second matching element" { ... }

# Bad
@test "test fill" { ... }
@test "test find" { ... }
```

#### 3. Always Check `assert_success` Before Checking Output

The `run` command captures exit code in `$status` and output in `$output`. Always verify success before inspecting output:

```bash
@test "get title returns the page title" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success  # Check navigation succeeded first

  run browser-cli get title
  assert_success  # Then check the query succeeded
  assert_output --partial "The Internet"
}
```

#### 4. Use Semantic Locators When Possible

Prefer semantic locators over raw CSS selectors for more resilient tests:

```bash
# Preferred: semantic locator
run browser-cli click 'role=button[name="Login"]'

# Also acceptable: CSS selector (when semantic is unavailable)
run browser-cli click '#login button[type="submit"]'
```

#### 5. Handle Timing with Wait Commands

Do not use `sleep` for synchronization. Use browser-cli's built-in wait commands:

```bash
# Good: explicit wait for condition
@test "dynamic content loads after click" {
  run browser-cli navigate "$DYNAMIC_LOADING_URL"
  assert_success

  run browser-cli click '#start button'
  assert_success

  run browser-cli wait '#finish' --timeout 10000
  assert_success

  run browser-cli get text '#finish'
  assert_success
  assert_output --partial "Hello World"
}

# Bad: arbitrary sleep
@test "dynamic content loads after click" {
  browser-cli click '#start button'
  sleep 5  # Fragile! May be too short or too long
  run browser-cli get text '#finish'
  assert_output --partial "Hello World"
}
```

#### 6. Clean Up Side Effects

If a test modifies browser state, clean up in `teardown` so subsequent tests are not affected:

```bash
teardown() {
  # Remove any cookies set during tests
  browser-cli cookies clear 2>/dev/null || true
  # Clear storage
  browser-cli storage local clear 2>/dev/null || true
  browser-cli storage session clear 2>/dev/null || true
}
```

#### 7. Use `--partial` for Flexible Assertions

Output format may include extra whitespace or metadata. Use `--partial` or `--regexp` to match the significant part:

```bash
# Flexible: matches regardless of surrounding text
assert_output --partial "Hello World"

# Exact: brittle, breaks if format changes
assert_output "Hello World!"
```

### Example: Complete Test File

```bash
#!/usr/bin/env bats

# test/e2e/basic/02-interaction.bats
# Tests for element interaction commands

setup() {
  load '../helpers/daemon'
  load '../helpers/assertions'
  load '../helpers/fixtures'
}

# --- Click ---

@test "click checkbox by CSS selector toggles state" {
  run browser-cli navigate "$CHECKBOXES_URL"
  assert_success

  run browser-cli click 'input[type="checkbox"]'
  assert_success
}

@test "click with semantic locator text=" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success

  run browser-cli click 'text=Login'
  assert_success
}

@test "click with role locator" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success

  run browser-cli click 'role=button[name="Login"]'
  assert_success
}

# --- Fill ---

@test "fill input with value" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success

  run browser-cli fill '#username' 'tomsmith'
  assert_success

  run browser-cli get value '#username'
  assert_success
  assert_output --partial "tomsmith"
}

@test "fill with semantic locator label=" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success

  run browser-cli fill 'label=Username' 'testuser'
  assert_success
}

# --- Check/Uncheck ---

@test "check makes checkbox checked" {
  run browser-cli navigate "$CHECKBOXES_URL"
  assert_success

  run browser-cli check 'input[type="checkbox"]:not(:checked)'
  assert_success

  run browser-cli is checked 'input[type="checkbox"]:first-of-type'
  assert_success
  assert_output --partial "true"
}

@test "uncheck makes checkbox unchecked" {
  run browser-cli navigate "$CHECKBOXES_URL"
  assert_success

  run browser-cli uncheck 'input[type="checkbox"]:checked'
  assert_success
}

# --- Select ---

@test "select dropdown option by value" {
  run browser-cli navigate "$DROPDOWN_URL"
  assert_success

  run browser-cli select 'select' '1'
  assert_success
}

@test "select dropdown option by visible text" {
  run browser-cli navigate "$DROPDOWN_URL"
  assert_success

  run browser-cli select 'select' 'Option 2'
  assert_success
}
```

## Debugging

### Run a Single Test in Isolation

```bash
# Filter to one test by name
npx bats test/e2e/basic/02-interaction.bats --filter "fill input with value"
```

### Verbose Execution Trace

Add `--verbose-run` to see every command executed:

```bash
npx bats test/e2e/basic/02-interaction.bats --filter "fill" --verbose-run
```

### Print Debug Info in Tests

Use `echo` to stderr (fd 3 in BATS) for debug output that only shows on failure:

```bash
@test "debugging example" {
  run browser-cli navigate "$LOGIN_URL"
  echo "# Navigate status: $status" >&3
  echo "# Navigate output: $output" >&3
  assert_success

  run browser-cli snapshot -ic
  echo "# Snapshot output:" >&3
  echo "# $output" >&3
  assert_success
}
```

### Manual Inspection Between Steps

When debugging a failing test, insert a `read` or `sleep` to pause:

```bash
@test "debug: pause for manual inspection" {
  run browser-cli navigate "$LOGIN_URL"
  assert_success

  run browser-cli fill '#username' 'tomsmith'
  assert_success

  # Pause to inspect browser state manually
  echo "# Paused. Press Enter to continue..." >&3
  read -r </dev/tty

  run browser-cli get value '#username'
  assert_success
  assert_output --partial "tomsmith"
}
```

**Remember to remove pauses before committing.**

### Check Daemon Logs

If tests fail with connection errors, check the daemon:

```bash
# Check daemon status
browser-cli status

# Restart daemon with fresh state
browser-cli stop && browser-cli start

# Check if extension is connected
browser-cli status
```

### Inspect Browser State

Use browser-cli commands interactively to understand current state:

```bash
# What page are we on?
browser-cli get url

# What does the page look like?
browser-cli snapshot -ic

# Take a screenshot for visual inspection
browser-cli screenshot --path /tmp/debug.png

# Check for JavaScript errors
browser-cli errors
```

## CI/CD Integration

### GitHub Actions Configuration

The CI workflow includes an E2E testing job. Here is the general pattern:

```yaml
e2e-tests:
  runs-on: ubuntu-latest
  needs: ci  # Run after lint/typecheck/test/build

  steps:
    - uses: actions/checkout@v4

    - uses: pnpm/action-setup@v4

    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Build
      run: pnpm build

    - name: Setup Chrome
      uses: browser-actions/setup-chrome@latest

    - name: Install BATS
      run: |
        sudo apt-get update
        sudo apt-get install -y bats

    - name: Run E2E tests
      run: pnpm test:e2e
      continue-on-error: true  # Until extension auto-loading works in CI

    - name: Upload test artifacts
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: e2e-test-results
        path: test-results/
```

### CI Limitations

E2E tests require a running Chrome browser with the extension loaded. In CI environments:

1. **Extension loading**: Chrome must be launched with `--load-extension` flag pointing to the built extension directory, or a separate step must load it.
2. **Display server**: On Linux CI, Chrome needs a virtual display (Xvfb) or must run with `--headless` flag. Note that some extension features may behave differently in headless mode.
3. **Daemon lifecycle**: The daemon and extension must be connected before tests start. The `setup_suite.bash` handles this.
4. **continue-on-error**: The E2E job uses `continue-on-error: true` until reliable CI extension loading is implemented. This prevents E2E flakiness from blocking PRs.

### Running in CI with Xvfb

For Linux CI environments that need a display:

```yaml
    - name: Run E2E tests with Xvfb
      run: xvfb-run --auto-servernum pnpm test:e2e
```

### Test Artifacts

On failure, the CI pipeline uploads:
- Test result files (JUnit XML)
- Screenshots taken during failed tests
- Daemon logs

These can be downloaded from the GitHub Actions run page under **Artifacts**.

## Troubleshooting

### "Daemon not running" or Connection Errors

**Symptoms**: Tests fail with `DAEMON_NOT_RUNNING` or socket connection errors.

**Fix**:
```bash
# Kill any orphaned daemon processes
pkill -f "browser-cli.*daemon" || true

# Remove stale socket files
rm -f ~/.browser-cli/*.sock

# Restart cleanly
browser-cli start
browser-cli status
```

### "Extension not connected"

**Symptoms**: `browser-cli status` shows daemon running but extension not connected.

**Fix**:
1. Check that Chrome is open with the extension loaded
2. Reload the extension at `chrome://extensions`
3. Verify the extension's WebSocket connection in the extension's service worker console:
   - Go to `chrome://extensions`
   - Click **Inspect views: service worker** on the browser-cli extension
   - Check console for connection errors
4. Ensure no firewall is blocking `localhost:9222`

### "Element not found" Errors

**Symptoms**: Tests fail with `ELEMENT_NOT_FOUND` for selectors that should match.

**Fix**:
1. The page may not have finished loading. Add a `wait` before the interaction:
   ```bash
   run browser-cli wait '#my-element' --timeout 5000
   assert_success
   ```
2. The selector may be wrong. Use `snapshot -ic` to inspect available elements:
   ```bash
   browser-cli navigate "$LOGIN_URL"
   browser-cli snapshot -ic
   ```
3. The element may be inside an iframe. Switch frames first:
   ```bash
   run browser-cli frame 'iframe'
   assert_success
   run browser-cli click '#element-inside-frame'
   ```

### Stale Element References

**Symptoms**: Tests fail when using element refs (`@e1`) after page navigation.

**Cause**: Element refs are bound to the current page. Navigation clears the ref map.

**Fix**: Re-run `snapshot -ic` after any navigation to get fresh refs:
```bash
run browser-cli navigate "$NEW_URL"
assert_success

# Refs from before navigation are stale -- get new ones
run browser-cli snapshot -ic
assert_success

# Now use the new refs
run browser-cli click '@e1'
assert_success
```

### Tests Pass Locally but Fail in CI

**Common causes**:
1. **Timing**: CI machines are slower. Increase `--timeout` values.
2. **Display**: Extension popup or visual features may need a display server. Use Xvfb.
3. **Network**: Test site may be unreachable. Check that `https://the-internet.herokuapp.com` is accessible.
4. **Chrome version**: Different Chrome versions may have different behavior. Pin the Chrome version in CI.

### Timeout Errors

**Symptoms**: Tests fail with `TIMEOUT` on wait commands.

**Fix**:
1. Increase the timeout:
   ```bash
   run browser-cli wait '#slow-element' --timeout 15000
   ```
2. Check that the condition will actually be met (element exists, URL matches, etc.)
3. For `wait --text`, be aware that large DOM pages are slower. Consider using a CSS selector wait instead.

### BATS "load" Errors

**Symptoms**: `load: <helper> does not exist` or similar errors.

**Fix**:
1. Verify helper files exist at the expected path relative to the test file:
   ```bash
   ls test/e2e/helpers/
   ```
2. The `load` command uses paths relative to the test file. From `test/e2e/basic/01-navigation.bats`, use:
   ```bash
   load '../helpers/daemon'     # Loads ../helpers/daemon.bash
   ```
3. Ensure helper files have the `.bash` extension (BATS convention).

### Build/Reload Checklist

After making code changes, follow this checklist before re-running tests:

| Changed Package | Rebuild Command | Reload Action |
|----------------|----------------|---------------|
| `apps/cli/` | `pnpm --filter @browser-cli/cli build` | `browser-cli stop && browser-cli start` |
| `apps/extension/` | `pnpm --filter @browser-cli/extension build` | Reload at `chrome://extensions` |
| `packages/shared/` | Rebuild **both** CLI and extension | Restart daemon **and** reload extension |
| Test files only | No rebuild needed | Just re-run tests |
