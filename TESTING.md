# Testing Guide

This document describes the test suite for browser-cli, with a focus on semantic locators.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @browser-cli/shared test
pnpm --filter @browser-cli/extension test
pnpm --filter @browser-cli/cli test

# Watch mode (for development)
pnpm --filter @browser-cli/shared test --watch
```

## Test Structure

```
browser-cli/
├── packages/shared/test/
│   ├── protocol.test.ts           # Protocol types and schemas
│   └── semantic-locators.test.ts  # Parser and formatter tests (83 tests)
├── apps/extension/test/
│   └── semantic-locators.test.ts  # DOM resolution tests (39 tests)
└── apps/cli/test/
    ├── hello.test.ts              # Basic CLI tests
    └── find.test.ts               # Find command parsing tests
```

## Semantic Locators Tests

### Syntax (AgentBrowser-compatible)

Semantic locators use `=` delimiter (Playwright/AgentBrowser style):

```
text=Submit                        # substring match (default)
text="Submit"                      # exact match (quoted)
text=Submit[exact]                 # exact match (bracket)
role=button                        # match by ARIA role
role=button[name="Submit"]         # role + accessible name
role=button[name="Submit"][exact]  # role + exact name match
label=Email                        # match by label text
placeholder=Search                 # match by placeholder
alt=Logo                           # match by alt text
title=Help                         # match by title attribute
testid=login-button                # match by data-testid (always exact)
xpath=//button[@type="submit"]     # XPath expression
```

### Parser Tests (packages/shared/test/semantic-locators.test.ts)

Tests the semantic locator parser and formatter without requiring DOM:

**Coverage:**
- Locator validation (isSemanticLocator)
- Role locator parsing (bare, with name bracket, options)
- Text locator parsing (substring, quoted exact, [exact] bracket)
- Label locator parsing
- Placeholder locator parsing
- Alt locator parsing
- Title locator parsing
- TestID locator parsing
- XPath locator parsing
- Bracket options ([exact], [hidden])
- Quoted value semantics ("value" = exact match)
- Formatter (formatSemanticLocator)
- Round-trip testing (parse -> format -> parse)
- Edge cases (empty strings, unicode, special characters, equals signs)

**Example test:**
```typescript
it('parses role with name bracket', () => {
  const result = parseSemanticLocator('role=button[name="Submit"]') as RoleLocator;
  expect(result).not.toBeNull();
  expect(result.type).toBe('role');
  expect(result.role).toBe('button');
  expect(result.name).toBe('Submit');
  expect(result.options.exact).toBe(false);
});
```

### DOM Resolution Tests (apps/extension/test/semantic-locators.test.ts)

Tests the actual element finding logic using happy-dom:

**Coverage:**
- findByRole (buttons, links, textboxes, name matching)
- findByText (substring/exact matching)
- findByLabel (for attribute, wrapping labels, exact match)
- findByPlaceholder (inputs, textareas, exact match)
- findByAlt (images, exact match)
- findByTitle (any elements, exact match)
- findByTestId (data-testid attributes)
- findByXPath (graceful degradation in happy-dom)
- Visibility filtering
- Complex scenarios (forms, aria-label, nested elements)

**Example test:**
```typescript
it('finds button by role and name', () => {
  document.body.innerHTML = `
    <button>Submit</button>
    <button>Cancel</button>
  `;
  const elements = resolve('role=button[name="Submit"]');
  expect(elements).toHaveLength(1);
  expect(elements[0].textContent).toBe('Submit');
});
```

## Test Environment

### happy-dom

We use [happy-dom](https://github.com/capricorn86/happy-dom) as the DOM environment for tests:

**Advantages:**
- Lightweight and fast
- Good HTML parsing
- Supports basic DOM APIs
- No browser dependencies

**Limitations:**
- Limited `getComputedStyle` support
- Some ARIA features may not work fully
- XPath not supported (tests degrade gracefully)
- visibility:hidden may not be properly detected

**Note:** Some tests are written to be tolerant of happy-dom limitations. In a real browser environment, these features work correctly.

### Configuration

Test configuration is in `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
```

## Writing Tests

### Parser Tests

For parser tests (no DOM required):

```typescript
import { describe, it, expect } from 'vitest';
import { parseSemanticLocator } from '@browser-cli/shared';

describe('my-feature', () => {
  it('parses correctly', () => {
    const result = parseSemanticLocator('role=button[name="Submit"]');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('role');
  });
});
```

### DOM Tests

For DOM resolution tests:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { parseSemanticLocator } from '@browser-cli/shared';
import { resolveSemanticLocator } from '../src/content-lib/semantic-locators';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('my-feature', () => {
  it('finds elements', () => {
    document.body.innerHTML = '<button>Click me</button>';
    const locator = parseSemanticLocator('role=button');
    const elements = resolveSemanticLocator(locator!, document.body);
    expect(elements).toHaveLength(1);
  });
});
```

## Find Command Tests (apps/cli/test/find.test.ts)

Tests the `find` command's argument parsing and semantic locator construction:

**Coverage:**
- All semantic locator engines (role, text, label, placeholder, alt, title, testid, xpath)
- Role with --name and --exact options
- Text exact match (quoted values and --exact flag)
- Position selectors (first, last, nth)
- All supported actions (click, dblclick, fill, type, hover, check, uncheck, select, press, clear, focus)
- Error cases (unknown engine, unknown action, too few args, invalid nth index)

**Example test:**
```typescript
it('builds role locator with --name', () => {
  const result = parseFindArgs(['role', 'button', 'click'], { name: 'Submit' });
  expect(result.selector).toBe('role=button[name="Submit"]');
  expect(result.action).toBe('click');
});
```

## Manual Testing

For comprehensive testing, use the test HTML page:

```bash
# Start daemon
browser-cli start

# Open test page
browser-cli navigate file://$(pwd)/test-semantic-locators.html

# Test locators
browser-cli click 'role=button[name="Submit"][exact]'
browser-cli fill "label=Email" "test@example.com"
browser-cli highlight "testid=login-button"

# Test find command
browser-cli find role button click --name "Submit"
browser-cli find text "Sign In" click
browser-cli find label "Email" fill "test@example.com"
browser-cli find first ".item" click
browser-cli find nth 2 ".item" click
```

See `/test-semantic-locators.html` for a complete test page with all locator types.

## CI Integration

Tests run automatically in CI via turbo:

```yaml
- name: Run tests
  run: pnpm test
```

All tests must pass before merging.

## Test Coverage

Current test coverage:

- **Parser tests:** 83 tests
- **DOM resolution tests:** 39 tests
- **Total semantic locator tests:** 122 tests

## Known Issues

### happy-dom Limitations

Some features that work in real browsers but may have issues in tests:

1. **getComputedStyle** - May not return correct values for `display`, `visibility`
2. **aria-label** - May not be fully supported in role resolution
3. **XPath** - Not supported; tests degrade gracefully
4. **TreeWalker** - Works but may have subtle differences

**Solution:** Tests are written to be tolerant of these limitations. Real browser testing is done manually.

## Troubleshooting

### Tests fail with "Cannot find module"

Make sure dependencies are installed:
```bash
pnpm install
```

### Tests timeout

Increase timeout in test file:
```typescript
it('slow test', { timeout: 10000 }, () => {
  // ...
});
```

### DOM tests fail unexpectedly

Check if the issue is happy-dom-specific by testing manually in a real browser:
```bash
browser-cli navigate file://$(pwd)/test-semantic-locators.html
browser-cli click 'role=button[name="Submit"]'
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [happy-dom Documentation](https://github.com/capricorn86/happy-dom)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about/)
