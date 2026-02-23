# Selector & Find Reference

Comprehensive documentation for element selectors and the `find` command in Browser-CLI.

## Overview

Browser-CLI supports 4 selector types: CSS selectors, semantic locators (AgentBrowser-compatible), element refs from snapshots, and XPath. The `find` command combines locating an element with performing an action in a single step.

## Selector Types

### 1. CSS Selectors

Standard CSS selectors work everywhere:

```bash
browser-cli click '#submit'                    # By ID
browser-cli click '.btn-primary'               # By class
browser-cli click 'button[type="submit"]'      # By attribute
browser-cli click 'div.form > input:first-child'  # Complex selector
browser-cli click 'nav a[href="/about"]'       # Nested selector
```

### 2. Semantic Locators (AgentBrowser-compatible)

Uses `=` delimiter syntax. 8 locator types available:

#### role - ARIA Role

```bash
browser-cli click 'role=button'                        # Any button
browser-cli click 'role=button[name="Submit"]'         # Button with accessible name
browser-cli click 'role=link[name="Home"]'             # Link with name
browser-cli click 'role=textbox'                       # Text input
browser-cli click 'role=checkbox[name="Agree"]'        # Named checkbox
browser-cli fill 'role=combobox' query                 # Combobox
```

Bracket options:

- `[name="..."]` — match accessible name
- `[exact]` — require exact name match
- `[hidden]` — include hidden elements

```bash
browser-cli click 'role=button[name="OK"][exact]'
browser-cli click 'role=dialog[hidden]'
```

#### text - Text Content

```bash
browser-cli click 'text=Submit'                # Partial match (case-insensitive)
browser-cli click 'text="Submit"'              # Exact match (quoted)
browser-cli click 'text=Sign In'               # Partial match
browser-cli click 'text="Sign In"'             # Exact match
```

Bracket options: `[exact]`, `[hidden]`

#### label - Form Label

```bash
browser-cli fill 'label=Email' user@test.com
browser-cli fill 'label="Email Address"' user@test.com
browser-cli click 'label=Remember me'
```

Bracket options: `[exact]`, `[hidden]`

#### placeholder - Input Placeholder

```bash
browser-cli fill 'placeholder=Search...' query
browser-cli fill 'placeholder="Enter your name"' John
```

Bracket options: `[exact]`, `[hidden]`

#### alt - Image Alt Text

```bash
browser-cli click 'alt=Company Logo'
browser-cli click 'alt="Profile Picture"'
```

Bracket options: `[exact]`, `[hidden]`

#### title - Title Attribute

```bash
browser-cli click 'title=Help'
browser-cli click 'title="Close dialog"'
```

Bracket options: `[exact]`, `[hidden]`

#### testid - Test ID

Always exact match, case-sensitive:

```bash
browser-cli click 'testid=login-button'
browser-cli click 'testid=submit-form'
browser-cli fill 'testid=email-input' value
```

#### xpath - XPath Expression

```bash
browser-cli click 'xpath=//button[@type="submit"]'
browser-cli click 'xpath=//a[contains(text(), "Next")]'
browser-cli fill 'xpath=//input[@id="email"]' value
```

### 3. Element References (from snapshot)

After running `snapshot`, elements are assigned refs like `@e1`, `@e2`:

```bash
browser-cli snapshot -ic
# Output:
# link "Home" (url="/") [@e1]
# link "Products" (url="/products") [@e2]
# textbox "Search" [@e3]
# button "Search" [@e4]
# link "Login" (url="/login") [@e5]

browser-cli click @e5              # Click "Login"
browser-cli fill @e3 "laptop"      # Fill search box
browser-cli click @e4              # Click "Search" button
```

Element refs are the most reliable selectors — they're unambiguous and mapped directly to elements.

---

## Find Command

The `find` command combines locating and acting on an element:

```
browser-cli find <engine> <value> [action] [action-value]
```

### Engines

| Engine        | Description      | Example                   |
| ------------- | ---------------- | ------------------------- |
| `role`        | ARIA role        | `find role button`        |
| `text`        | Text content     | `find text "Sign In"`     |
| `label`       | Form label       | `find label Email`        |
| `placeholder` | Placeholder text | `find placeholder Search` |
| `alt`         | Image alt text   | `find alt Logo`           |
| `title`       | Title attribute  | `find title Help`         |
| `testid`      | Test ID          | `find testid login-btn`   |
| `xpath`       | XPath expression | `find xpath "//button"`   |

### Position Selectors

When multiple elements match, use position selectors:

| Selector | Description         | Example                  |
| -------- | ------------------- | ------------------------ |
| `first`  | First match         | `find first .item click` |
| `last`   | Last match          | `find last .item click`  |
| `nth`    | Nth match (1-based) | `find nth 2 .item click` |

### Actions

| Action     | Description                  | Requires value |
| ---------- | ---------------------------- | -------------- |
| `click`    | Click (default when omitted) | No             |
| `dblclick` | Double-click                 | No             |
| `fill`     | Fill input                   | Yes            |
| `type`     | Type characters              | Yes            |
| `hover`    | Hover                        | No             |
| `check`    | Check checkbox               | No             |
| `uncheck`  | Uncheck checkbox             | No             |
| `select`   | Select option                | Yes            |
| `press`    | Press key                    | Yes            |
| `clear`    | Clear input                  | No             |
| `focus`    | Focus element                | No             |

### Options

| Option          | Description                         |
| --------------- | ----------------------------------- |
| `--name <name>` | Accessible name (for `role` engine) |
| `--exact`       | Exact text match                    |

### Examples

```bash
# Role-based
browser-cli find role button click
browser-cli find role button --name "Submit"           # Default action: click
browser-cli find role textbox --name "Email" fill user@test.com
browser-cli find role checkbox --name "Agree" check
browser-cli find role link --name "Home"

# Text-based
browser-cli find text "Sign In"                        # Default: click
browser-cli find text Submit click
browser-cli find text "Learn More" hover

# Label-based
browser-cli find label Email fill user@test.com
browser-cli find label "First Name" fill John
browser-cli find label Password fill secret --exact

# Other engines
browser-cli find placeholder "Search..." fill query
browser-cli find alt "Profile" click
browser-cli find title "Close" click
browser-cli find testid submit-btn click
browser-cli find xpath "//form//button[last()]" click

# Position selectors
browser-cli find first ".product" click
browser-cli find last ".nav-item" click
browser-cli find nth 3 ".list-item" click
browser-cli find nth 1 ".tab" fill "New Value"
```

---

## Selector Priority

When choosing a selector, prefer in this order:

1. **Element refs** (`@e1`) — most reliable, from snapshot
2. **Semantic locators** (`role=`, `label=`, `text=`, `testid=`) — resilient to DOM changes, testid is always exact and case-sensitive
3. **CSS selectors** (`#id`, `.class`) — brittle if DOM changes

---

## Best Practices

1. **Start with `snapshot -ic`**: Get the lay of the land with interactive elements and their refs.

2. **Use `find` for AI workflows**: It's designed for semantic element targeting — `find label Email fill user@test.com` reads naturally.

3. **Prefer `role` and `label`**: These match how users perceive the page, making them resilient to CSS/DOM refactors.

4. **Use `--exact` when needed**: Partial matching is convenient but can be ambiguous. Use `--exact` or quoted values for precision.

5. **Fall back to XPath**: For complex structural queries that can't be expressed with other locators: `xpath=//table//tr[3]//td[2]`.

6. **Combine with `wait`**: For dynamic content, wait for the element first:
   ```bash
   browser-cli wait 'role=button[name="Submit"]'
   browser-cli find role button --name "Submit"
   ```
