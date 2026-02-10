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
│   └── semantic-locators.test.ts  # Parser and formatter tests (41 tests)
├── apps/extension/test/
│   └── semantic-locators.test.ts  # DOM resolution tests (31 tests)
└── apps/cli/test/
    └── hello.test.ts              # Basic CLI tests
```

## Semantic Locators Tests

### Parser Tests (packages/shared/test/semantic-locators.test.ts)

Tests the semantic locator parser and formatter without requiring DOM:

**Coverage:**
- ✅ Locator validation (isSemanticLocator)
- ✅ Role locator parsing (with/without name, options)
- ✅ Text locator parsing (exact/contains, case sensitivity)
- ✅ Label locator parsing
- ✅ Placeholder locator parsing
- ✅ Alt locator parsing
- ✅ Title locator parsing
- ✅ TestID locator parsing
- ✅ Options parsing (exact, contains, case, nocase, hidden)
- ✅ Formatter (formatSemanticLocator)
- ✅ Round-trip testing (parse → format → parse)
- ✅ Edge cases (empty strings, unicode, special characters)

**Example test:**
```typescript
it('parses role with name', () => {
  const result = parseSemanticLocator('role:button:Submit') as RoleLocator;
  expect(result).not.toBeNull();
  expect(result.type).toBe('role');
  expect(result.role).toBe('button');
  expect(result.name).toBe('Submit');
  expect(result.options.exact).toBe(true);
  expect(result.options.ignoreCase).toBe(true);
});
```

### DOM Resolution Tests (apps/extension/test/semantic-locators.test.ts)

Tests the actual element finding logic using happy-dom:

**Coverage:**
- ✅ findByRole (buttons, links, textboxes, custom roles)
- ✅ findByText (exact/contains matching)
- ✅ findByLabel (for attribute, wrapping labels)
- ✅ findByPlaceholder (inputs, textareas)
- ✅ findByAlt (images)
- ✅ findByTitle (any elements)
- ✅ findByTestId (data-testid attributes)
- ✅ Visibility filtering
- ✅ Case sensitivity
- ✅ Nested elements
- ✅ Multiple matches
- ✅ Complex scenarios (forms, aria-label)

**Example test:**
```typescript
it('finds button by role and name', () => {
  document.body.innerHTML = `
    <button>Submit</button>
    <button>Cancel</button>
  `;

  const locator = parseSemanticLocator('role:button:Submit:exact');
  expect(locator).not.toBeNull();

  const elements = resolveSemanticLocator(locator!, document.body);
  expect(elements).toHaveLength(1);
  expect(elements[0].textContent).toBe('Submit');
});
```

## Test Environment

### happy-dom

We use [happy-dom](https://github.com/capricorn86/happy-dom) as the DOM environment for tests:

**Advantages:**
- ✅ Lightweight and fast
- ✅ Good HTML parsing
- ✅ Supports basic DOM APIs
- ✅ No browser dependencies

**Limitations:**
- ⚠️ Limited `getComputedStyle` support
- ⚠️ Some ARIA features may not work fully
- ⚠️ visibility:hidden may not be properly detected

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
    const result = parseSemanticLocator('role:button:Submit');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('role');
  });
});
```

### DOM Tests

For DOM resolution tests:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import { resolveSemanticLocator } from '../src/content-lib/semantic-locators';

let window: Window;
let document: Document;

beforeEach(() => {
  window = new Window();
  document = window.document;
  (global as any).document = document;
  (global as any).window = window;
});

describe('my-feature', () => {
  it('finds elements', () => {
    document.body.innerHTML = '<button>Click me</button>';
    const locator = parseSemanticLocator('role:button');
    const elements = resolveSemanticLocator(locator!, document.body);
    expect(elements).toHaveLength(1);
  });
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
browser-cli click "role:button:Submit:exact"
browser-cli fill "label:Email" "test@example.com"
browser-cli highlight "testid:login-button"
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

- **Parser tests:** 41 tests ✅
- **DOM resolution tests:** 31 tests ✅
- **Total semantic locator tests:** 72 tests ✅

## Known Issues

### happy-dom Limitations

Some features that work in real browsers but may have issues in tests:

1. **getComputedStyle** - May not return correct values for `display`, `visibility`
2. **aria-label** - May not be fully supported in role resolution
3. **TreeWalker** - Works but may have subtle differences

**Solution:** Tests are written to be tolerant of these limitations. Real browser testing is done manually.

## Future Improvements

- [ ] Add integration tests with real browser (Playwright)
- [ ] Add visual regression tests
- [ ] Increase test coverage for edge cases
- [ ] Add performance benchmarks
- [ ] Test with various HTML frameworks (React, Vue, Angular)

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
browser-cli click "role:button:Submit"
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [happy-dom Documentation](https://github.com/capricorn86/happy-dom)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about/)
