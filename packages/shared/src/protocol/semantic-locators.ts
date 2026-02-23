/**
 * Semantic locator system — AgentBrowser-compatible syntax.
 *
 * Uses `=` delimiter (Playwright/AgentBrowser style):
 *   text=Submit, role=button, label=Email, xpath=//button, etc.
 *
 * Syntax:
 *   text=<value>                        — substring match (default)
 *   text="<value>"                      — exact match (quoted)
 *   text=<value>[exact]                 — exact match (bracket)
 *   text=<value>[exact][hidden]         — exact + include hidden
 *   role=<role>                         — match by ARIA role
 *   role=<role>[name="<name>"]          — role + accessible name
 *   role=<role>[name="<name>"][exact]   — role + exact name match
 *   label=<value>                       — match by label text
 *   placeholder=<value>                 — match by placeholder
 *   alt=<value>                         — match by alt text
 *   title=<value>                       — match by title attribute
 *   testid=<value>                      — match by data-testid (always exact)
 *   xpath=<expression>                  — XPath expression
 *
 * Examples:
 *   role=button
 *   role=button[name="Submit"]
 *   role=button[name="Submit"][exact]
 *   text=Sign In
 *   text="Sign In"
 *   label=Email
 *   placeholder=Search...
 *   testid=login-button
 *   xpath=//button[@type="submit"]
 */

/** Semantic locator types */
export type SemanticLocatorType =
  | 'role'
  | 'text'
  | 'label'
  | 'placeholder'
  | 'alt'
  | 'title'
  | 'testid'
  | 'xpath';

/** Options for semantic locators */
export interface SemanticLocatorOptions {
  /** Exact match (default: false for most, true for testid) */
  exact?: boolean;
  /** Case-insensitive match (default: true, false for testid) */
  ignoreCase?: boolean;
  /** Match hidden elements (default: false) */
  includeHidden?: boolean;
}

/** Base semantic locator */
interface BaseSemanticLocator {
  type: SemanticLocatorType;
  options: SemanticLocatorOptions;
}

/** Role-based locator: role=button, role=button[name="Submit"] */
export interface RoleLocator extends BaseSemanticLocator {
  type: 'role';
  role: string;
  name?: string;
}

/** Text-based locators */
export interface TextLocator extends BaseSemanticLocator {
  type: 'text';
  text: string;
}

export interface LabelLocator extends BaseSemanticLocator {
  type: 'label';
  labelText: string;
}

export interface PlaceholderLocator extends BaseSemanticLocator {
  type: 'placeholder';
  text: string;
}

export interface AltLocator extends BaseSemanticLocator {
  type: 'alt';
  text: string;
}

export interface TitleLocator extends BaseSemanticLocator {
  type: 'title';
  text: string;
}

export interface TestIdLocator extends BaseSemanticLocator {
  type: 'testid';
  value: string;
}

/** XPath locator: xpath=//button[@type="submit"] */
export interface XPathLocator extends BaseSemanticLocator {
  type: 'xpath';
  expression: string;
}

/** Union of all semantic locators */
export type SemanticLocator =
  | RoleLocator
  | TextLocator
  | LabelLocator
  | PlaceholderLocator
  | AltLocator
  | TitleLocator
  | TestIdLocator
  | XPathLocator;

/** Regex: <engine>=<rest> where engine is a known keyword */
const SEMANTIC_PATTERN = /^(role|text|label|placeholder|alt|title|testid|xpath)=(.+)$/;

/** Check if a string is a semantic locator */
export function isSemanticLocator(value: string): boolean {
  return SEMANTIC_PATTERN.test(value);
}

/**
 * Parse a semantic locator string into a structured locator object.
 *
 * @param value Semantic locator string (e.g. "text=Submit", "role=button[name=\"Submit\"]")
 * @returns Parsed locator or null if invalid
 *
 * @example
 * parseSemanticLocator('role=button[name="Submit"]')
 * // => { type: 'role', role: 'button', name: 'Submit', options: { exact: false } }
 *
 * parseSemanticLocator('text=Sign In')
 * // => { type: 'text', text: 'Sign In', options: { exact: false } }
 *
 * parseSemanticLocator('text="Sign In"')
 * // => { type: 'text', text: 'Sign In', options: { exact: true } }
 *
 * parseSemanticLocator('testid=login-button')
 * // => { type: 'testid', value: 'login-button', options: { exact: true } }
 */
export function parseSemanticLocator(value: string): SemanticLocator | null {
  const match = value.match(SEMANTIC_PATTERN);
  if (!match) return null;

  const engine = match[1];
  const rest = match[2] ?? '';
  if (!engine) return null;

  switch (engine as SemanticLocatorType) {
    case 'role':
      return parseRoleLocator(rest);
    case 'text':
      return parseTextBasedLocator('text', rest, {
        exact: false,
        ignoreCase: true,
        includeHidden: false,
      });
    case 'label':
      return parseLabelLocator(rest);
    case 'placeholder':
      return parseTextBasedLocator('placeholder', rest, {
        exact: false,
        ignoreCase: true,
        includeHidden: false,
      });
    case 'alt':
      return parseTextBasedLocator('alt', rest, {
        exact: false,
        ignoreCase: true,
        includeHidden: false,
      });
    case 'title':
      return parseTextBasedLocator('title', rest, {
        exact: false,
        ignoreCase: true,
        includeHidden: false,
      });
    case 'testid':
      return parseTestIdLocator(rest);
    case 'xpath':
      return parseXPathLocator(rest);
    default:
      return null;
  }
}

/**
 * Parse role locator: button, button[name="Submit"], button[name="Submit"][exact][hidden]
 */
function parseRoleLocator(rest: string): RoleLocator | null {
  const { value: role, brackets } = extractBrackets(rest);
  if (!role) return null;

  let name: string | undefined;
  const options: SemanticLocatorOptions = { exact: false, ignoreCase: true, includeHidden: false };

  for (const bracket of brackets) {
    const lower = bracket.toLowerCase();
    if (lower.startsWith('name=')) {
      name = unquote(bracket.substring(5));
    } else if (lower === 'exact') {
      options.exact = true;
    } else if (lower === 'hidden') {
      options.includeHidden = true;
    }
  }

  return {
    type: 'role',
    role: role.toLowerCase(),
    name,
    options,
  };
}

/**
 * Parse text-based locators (text, placeholder, alt, title).
 * Supports quoted values for exact match: text="Submit"
 * Supports bracket options: text=Submit[exact][hidden]
 */
function parseTextBasedLocator(
  type: 'text' | 'placeholder' | 'alt' | 'title',
  rest: string,
  defaults: SemanticLocatorOptions,
): TextLocator | PlaceholderLocator | AltLocator | TitleLocator | null {
  const { value: rawValue, brackets } = extractBrackets(rest);
  if (!rawValue) return null;

  // Check if the value is quoted (exact match)
  const isQuoted = rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length >= 2;
  const text = isQuoted ? rawValue.slice(1, -1) : rawValue;

  const options = { ...defaults };
  if (isQuoted) {
    options.exact = true;
  }

  // Apply bracket options
  for (const bracket of brackets) {
    applyBracketOption(options, bracket);
  }

  if (type === 'text') {
    return { type: 'text', text, options };
  }
  return { type, text, options };
}

/**
 * Parse label locator: Email, "Email", Email[exact]
 */
function parseLabelLocator(rest: string): LabelLocator | null {
  const { value: rawValue, brackets } = extractBrackets(rest);
  if (!rawValue) return null;

  const isQuoted = rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length >= 2;
  const labelText = isQuoted ? rawValue.slice(1, -1) : rawValue;

  const options: SemanticLocatorOptions = { exact: false, ignoreCase: true, includeHidden: false };
  if (isQuoted) {
    options.exact = true;
  }

  for (const bracket of brackets) {
    applyBracketOption(options, bracket);
  }

  return { type: 'label', labelText, options };
}

/**
 * Parse testid locator: always exact, case-sensitive.
 * testid=login-button, testid=btn.submit.primary
 */
function parseTestIdLocator(rest: string): TestIdLocator | null {
  if (!rest) return null;

  // testid supports [hidden] bracket only
  const { value, brackets } = extractBrackets(rest);
  if (!value) return null;

  const options: SemanticLocatorOptions = { exact: true, ignoreCase: false, includeHidden: false };

  for (const bracket of brackets) {
    const lower = bracket.toLowerCase();
    if (lower === 'hidden') {
      options.includeHidden = true;
    }
  }

  return { type: 'testid', value, options };
}

/**
 * Parse XPath locator: raw XPath expression, no bracket options.
 * xpath=//button[@type="submit"]
 */
function parseXPathLocator(rest: string): XPathLocator | null {
  if (!rest) return null;

  return {
    type: 'xpath',
    expression: rest,
    options: { exact: true, ignoreCase: false, includeHidden: false },
  };
}

/** Known bracket option keywords */
const BRACKET_OPTIONS = new Set(['exact', 'hidden']);

/**
 * Extract trailing [...] brackets from a string.
 * Only extracts brackets whose content is a known option or name=... attribute.
 *
 * "button[name=\"Submit\"][exact]" → { value: "button", brackets: ["name=\"Submit\"", "exact"] }
 * "//button[@type=\"submit\"]"    → { value: "//button[@type=\"submit\"]", brackets: [] }
 */
function extractBrackets(input: string): { value: string; brackets: string[] } {
  const brackets: string[] = [];
  let remaining = input;

  // Extract brackets from the end, right-to-left
  while (remaining.endsWith(']')) {
    // Find matching opening bracket — need to handle nested brackets for XPath etc.
    const closeIdx = remaining.length - 1;
    let openIdx = -1;
    let depth = 0;

    for (let i = closeIdx; i >= 0; i--) {
      if (remaining[i] === ']') {
        depth++;
      } else if (remaining[i] === '[') {
        depth--;
        if (depth === 0) {
          openIdx = i;
          break;
        }
      }
    }

    if (openIdx === -1) break;

    const bracketContent = remaining.substring(openIdx + 1, closeIdx);

    // Only extract if it's a recognized option or name= attribute
    if (isKnownBracket(bracketContent)) {
      brackets.unshift(bracketContent);
      remaining = remaining.substring(0, openIdx);
    } else {
      break;
    }
  }

  return { value: remaining, brackets };
}

/** Check if bracket content is a known option */
function isKnownBracket(content: string): boolean {
  const lower = content.toLowerCase();
  if (BRACKET_OPTIONS.has(lower)) return true;
  if (lower.startsWith('name=')) return true;
  return false;
}

/** Remove surrounding quotes from a string */
function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1);
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
}

/** Apply a bracket option to options object */
function applyBracketOption(options: SemanticLocatorOptions, bracket: string): void {
  const lower = bracket.toLowerCase();
  if (lower === 'exact') {
    options.exact = true;
  } else if (lower === 'hidden') {
    options.includeHidden = true;
  }
}

/**
 * Format a semantic locator object back to string format.
 *
 * @param locator Semantic locator object
 * @returns Formatted string
 *
 * @example
 * formatSemanticLocator({ type: 'role', role: 'button', name: 'Submit', options: {} })
 * // => 'role=button[name="Submit"]'
 *
 * formatSemanticLocator({ type: 'text', text: 'Sign In', options: { exact: true } })
 * // => 'text="Sign In"'
 */
export function formatSemanticLocator(locator: SemanticLocator): string {
  const optionBrackets: string[] = [];

  if (locator.options.exact) {
    // For text-based locators, prefer quoted syntax over [exact] bracket
    // Role locators always use [exact] bracket since they have name brackets
  }
  if (locator.options.includeHidden) {
    optionBrackets.push('[hidden]');
  }

  switch (locator.type) {
    case 'role': {
      let result = `role=${locator.role}`;
      if (locator.name) {
        result += `[name="${locator.name}"]`;
      }
      if (locator.options.exact) {
        result += '[exact]';
      }
      result += optionBrackets.join('');
      return result;
    }

    case 'text': {
      if (locator.options.exact) {
        return `text="${locator.text}"` + optionBrackets.join('');
      }
      return `text=${locator.text}` + optionBrackets.join('');
    }

    case 'label': {
      if (locator.options.exact) {
        return `label="${locator.labelText}"` + optionBrackets.join('');
      }
      return `label=${locator.labelText}` + optionBrackets.join('');
    }

    case 'placeholder':
    case 'alt':
    case 'title': {
      if (locator.options.exact) {
        return `${locator.type}="${locator.text}"` + optionBrackets.join('');
      }
      return `${locator.type}=${locator.text}` + optionBrackets.join('');
    }

    case 'testid':
      return `testid=${locator.value}` + optionBrackets.join('');

    case 'xpath':
      return `xpath=${locator.expression}`;
  }
}
