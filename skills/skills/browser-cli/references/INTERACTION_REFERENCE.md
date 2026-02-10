# Interaction API Reference

Comprehensive documentation for element interaction commands in Browser-CLI.

## Overview

Browser-CLI provides commands for clicking, typing, filling forms, checking boxes, selecting options, uploading files, dragging elements, and pressing keys. All interaction commands accept CSS selectors, semantic locators, or element refs (`@e1`).

## Operations

### click - Click an Element

```bash
browser-cli click <selector> [--button <button>]
```

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | CSS selector, semantic locator, or element ref |
| `--button` | string | No | `left` | Mouse button: `left`, `right`, `middle` |

**Examples:**
```bash
browser-cli click '#submit-btn'
browser-cli click 'role=button[name="Submit"]'
browser-cli click @e3
browser-cli click '.menu-item' --button right
```

---

### dblclick - Double-Click an Element

```bash
browser-cli dblclick <selector>
```

**Examples:**
```bash
browser-cli dblclick '.editable-cell'
browser-cli dblclick 'text=Edit'
```

---

### hover - Hover Over an Element

```bash
browser-cli hover <selector>
```

Moves the mouse over the element, triggering hover effects, tooltips, or dropdown menus.

**Examples:**
```bash
browser-cli hover '.dropdown-trigger'
browser-cli hover 'text=Menu'
```

---

### fill - Fill an Input Field

```bash
browser-cli fill <selector> <value>
```

Replaces the current content of the input. Works with React/Vue controlled components (uses native value setter).

**Examples:**
```bash
browser-cli fill 'input[name="email"]' user@example.com
browser-cli fill 'label=Password' secret123
browser-cli fill @e5 "Hello World"
```

---

### type - Type Text Character by Character

```bash
browser-cli type <selector> <text> [--delay <ms>]
```

Types each character individually, triggering keydown/keypress/keyup events. Useful for autocomplete or typeahead inputs.

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | Target element |
| `text` | string | Yes | - | Text to type |
| `--delay` | number | No | `0` | Delay between keystrokes in ms |

**Examples:**
```bash
browser-cli type 'input[name="search"]' "hello world" --delay 50
browser-cli type 'label=Search' query
```

---

### press - Press a Key (Page-Level)

```bash
browser-cli press <key>
```

Alias: `key`

Presses a key at the page level (not targeted at a specific element). Supports modifier combinations.

**Key names:** `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `PageUp`, `PageDown`, `F1`-`F12`, `Space`

**Modifier combinations:** `Control+a`, `Control+c`, `Control+v`, `Shift+Tab`, `Alt+F4`, `Control+Shift+k`

**Examples:**
```bash
browser-cli press Enter
browser-cli press Tab
browser-cli press Control+a
browser-cli press Escape
browser-cli key Control+Shift+k
```

---

### clear - Clear an Input Field

```bash
browser-cli clear <selector>
```

**Examples:**
```bash
browser-cli clear 'input[name="search"]'
browser-cli clear @e5
```

---

### focus - Focus an Element

```bash
browser-cli focus <selector>
```

**Examples:**
```bash
browser-cli focus 'input[name="email"]'
browser-cli focus @e2
```

---

### check / uncheck - Toggle Checkbox or Radio

```bash
browser-cli check <selector>
browser-cli uncheck <selector>
```

**Examples:**
```bash
browser-cli check 'input[type="checkbox"]'
browser-cli check 'label=Remember me'
browser-cli uncheck 'label=Subscribe to newsletter'
```

---

### select - Select Dropdown Option

```bash
browser-cli select <selector> <value>
```

Selects an `<option>` by its `value` attribute.

**Examples:**
```bash
browser-cli select 'select[name="country"]' US
browser-cli select '#color-picker' red
```

---

### upload - Upload Files

```bash
browser-cli upload <selector> <files...> [--clear]
```

Uploads files to a file input element. Uses DataTransfer API with data URLs.

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `selector` | string | Yes | - | File input selector |
| `files` | string[] | Yes | - | File paths to upload |
| `--clear` | boolean | No | `false` | Clear existing files first |

**Examples:**
```bash
browser-cli upload 'input[type="file"]' /path/to/image.png
browser-cli upload '#avatar' /path/to/photo.jpg --clear
```

---

### drag - Drag and Drop

```bash
browser-cli drag <source> <target>
```

Drags the source element to the target element.

**Examples:**
```bash
browser-cli drag '#item-1' '#drop-zone'
browser-cli drag '.draggable' '.container'
```

---

### keydown / keyup - Low-Level Key Control

```bash
browser-cli keydown <key>
browser-cli keyup <key>
```

Press or release a key without the full press cycle. Useful for holding modifier keys.

**Examples:**
```bash
browser-cli keydown Shift
browser-cli click '.item-1'
browser-cli click '.item-3'
browser-cli keyup Shift
```

---

## Mouse Control (Low-Level)

### mouse move

```bash
browser-cli mouse move <x> <y>
```

### mouse down / up

```bash
browser-cli mouse down [button]
browser-cli mouse up [button]
```

Button: `left` (default), `right`, `middle`

### mouse wheel

```bash
browser-cli mouse wheel <deltaY> [deltaX]
```

**Examples:**
```bash
browser-cli mouse move 100 200
browser-cli mouse down
browser-cli mouse move 300 400
browser-cli mouse up
browser-cli mouse wheel 500            # Scroll down
browser-cli mouse wheel -500           # Scroll up
```

---

## Scroll Operations

### scroll - Scroll Page or Element

```bash
browser-cli scroll <direction> [--amount <px>] [--selector <sel>]
```

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `direction` | string | Yes | - | `up`, `down`, `left`, `right` |
| `--amount` | number | No | `400` | Scroll amount in pixels |
| `--selector` | string | No | page | Element to scroll |

**Examples:**
```bash
browser-cli scroll down
browser-cli scroll down --amount 1000
browser-cli scroll up --selector '.sidebar'
```

### scrollintoview - Scroll Element Into View

```bash
browser-cli scrollintoview <selector>
```

**Examples:**
```bash
browser-cli scrollintoview '#footer'
browser-cli scrollintoview 'text=Contact Us'
```

---

## Common Patterns

### Fill a login form
```bash
browser-cli fill 'label=Email' user@example.com
browser-cli fill 'label=Password' secret
browser-cli click 'role=button[name="Log In"]'
```

### Navigate a dropdown menu
```bash
browser-cli hover '.nav-dropdown'
browser-cli wait '.dropdown-menu'
browser-cli click '.dropdown-menu a:first-child'
```

### Multi-select with Shift
```bash
browser-cli click '.list-item:first-child'
browser-cli keydown Shift
browser-cli click '.list-item:last-child'
browser-cli keyup Shift
```

---

## Best Practices

1. **Use `fill` for inputs**: It replaces content reliably. Use `type` only when you need character-by-character events (autocomplete, typeahead).

2. **Use `press` for keyboard shortcuts**: `press` is page-level — it doesn't require a target element.

3. **Wait before interacting**: If elements load dynamically, add `wait <selector>` before `click`/`fill`.

4. **Prefer semantic locators**: `label=Email` and `role=button[name="Submit"]` are more resilient than CSS selectors.

5. **Use element refs for speed**: After `snapshot -ic`, use `@e1`/`@e2` refs — they're unambiguous and fast.
