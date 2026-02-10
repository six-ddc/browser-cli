/**
 * Semantic locator system: role:button:Submit:exact, text:Sign In, label:Email, etc.
 *
 * Semantic locators provide a more user-centric way to identify elements,
 * similar to Testing Library's approach. They complement CSS selectors and refs.
 *
 * Syntax:
 *   role:<role>:<name>:<options>
 *   text:<text>:<options>
 *   label:<labelText>:<options>
 *   placeholder:<text>:<options>
 *   alt:<text>:<options>
 *   title:<text>:<options>
 *   testid:<value>
 *
 * Examples:
 *   role:button:Submit:exact
 *   role:textbox:Email
 *   text:Sign In
 *   label:Password
 *   placeholder:Search...
 *   testid:login-button
 */

/** Semantic locator types */
export type SemanticLocatorType =
  | 'role'
  | 'text'
  | 'label'
  | 'placeholder'
  | 'alt'
  | 'title'
  | 'testid';

/** Options for semantic locators */
export interface SemanticLocatorOptions {
  /** Exact match (default: false for text-based, true for others) */
  exact?: boolean;
  /** Case-insensitive match (default: true) */
  ignoreCase?: boolean;
  /** Match hidden elements (default: false) */
  includeHidden?: boolean;
}

/** Base semantic locator */
interface BaseSemanticLocator {
  type: SemanticLocatorType;
  options: SemanticLocatorOptions;
}

/** Role-based locator */
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

/** Union of all semantic locators */
export type SemanticLocator =
  | RoleLocator
  | TextLocator
  | LabelLocator
  | PlaceholderLocator
  | AltLocator
  | TitleLocator
  | TestIdLocator;

/** Regex pattern for semantic locator strings */
const SEMANTIC_PATTERN = /^(role|text|label|placeholder|alt|title|testid):(.+)$/;

/** Check if a string is a semantic locator */
export function isSemanticLocator(value: string): boolean {
  return SEMANTIC_PATTERN.test(value);
}

/**
 * Parse a semantic locator string into a structured locator object.
 *
 * @param value Semantic locator string
 * @returns Parsed locator or null if invalid
 *
 * @example
 * parseSemanticLocator('role:button:Submit:exact')
 * // => { type: 'role', role: 'button', name: 'Submit', options: { exact: true } }
 *
 * parseSemanticLocator('text:Sign In')
 * // => { type: 'text', text: 'Sign In', options: { exact: false, ignoreCase: true } }
 *
 * parseSemanticLocator('testid:login-button')
 * // => { type: 'testid', value: 'login-button', options: { exact: true } }
 */
export function parseSemanticLocator(value: string): SemanticLocator | null {
  const match = value.match(SEMANTIC_PATTERN);
  if (!match) return null;

  const [, type, rest] = match;
  const parts = rest.split(':');

  const locatorType = type as SemanticLocatorType;

  switch (locatorType) {
    case 'role': {
      const [role, name, ...optParts] = parts;
      if (!role) return null;

      const options = parseOptions(optParts, { exact: true, ignoreCase: true, includeHidden: false });
      return {
        type: 'role',
        role: role.toLowerCase(),
        name: name || undefined,
        options,
      };
    }

    case 'text': {
      const lastPart = parts[parts.length - 1];
      const hasOptions = lastPart && isOptionString(lastPart);

      const actualText = hasOptions ? parts.slice(0, -1).join(':') : parts.join(':');
      const options = hasOptions
        ? parseOptions([lastPart], { exact: false, ignoreCase: true, includeHidden: false })
        : { exact: false, ignoreCase: true, includeHidden: false };

      return {
        type: 'text',
        text: actualText,
        options,
      };
    }

    case 'label': {
      const lastPart = parts[parts.length - 1];
      const hasOptions = lastPart && isOptionString(lastPart);

      const actualText = hasOptions ? parts.slice(0, -1).join(':') : parts.join(':');
      const options = hasOptions
        ? parseOptions([lastPart], { exact: true, ignoreCase: true, includeHidden: false })
        : { exact: true, ignoreCase: true, includeHidden: false };

      return {
        type: 'label',
        labelText: actualText,
        options,
      };
    }

    case 'placeholder': {
      const lastPart = parts[parts.length - 1];
      const hasOptions = lastPart && isOptionString(lastPart);

      const actualText = hasOptions ? parts.slice(0, -1).join(':') : parts.join(':');
      const options = hasOptions
        ? parseOptions([lastPart], { exact: true, ignoreCase: true, includeHidden: false })
        : { exact: true, ignoreCase: true, includeHidden: false };

      return {
        type: locatorType,
        text: actualText,
        options,
      };
    }

    case 'alt':
    case 'title': {
      const lastPart = parts[parts.length - 1];
      const hasOptions = lastPart && isOptionString(lastPart);

      const actualText = hasOptions ? parts.slice(0, -1).join(':') : parts.join(':');
      const options = hasOptions
        ? parseOptions([lastPart], { exact: false, ignoreCase: true, includeHidden: false })
        : { exact: false, ignoreCase: true, includeHidden: false };

      return {
        type: locatorType,
        text: actualText,
        options,
      };
    }

    case 'testid': {
      const value = parts.join(':');
      return {
        type: 'testid',
        value,
        options: { exact: true, ignoreCase: false, includeHidden: false },
      };
    }

    default:
      return null;
  }
}

/** Check if a string part represents options (exact, case, etc.) */
function isOptionString(part: string): boolean {
  const lower = part.toLowerCase();
  return ['exact', 'contains', 'case', 'nocase', 'hidden'].includes(lower);
}

/** Parse option strings into SemanticLocatorOptions */
function parseOptions(
  parts: string[],
  defaults: SemanticLocatorOptions,
): SemanticLocatorOptions {
  const options = { ...defaults };

  for (const part of parts) {
    const lower = part.toLowerCase();
    switch (lower) {
      case 'exact':
        options.exact = true;
        break;
      case 'contains':
        options.exact = false;
        break;
      case 'case':
        options.ignoreCase = false;
        break;
      case 'nocase':
        options.ignoreCase = true;
        break;
      case 'hidden':
        options.includeHidden = true;
        break;
    }
  }

  return options;
}

/**
 * Format a semantic locator object back to string format.
 *
 * @param locator Semantic locator object
 * @returns Formatted string
 *
 * @example
 * formatSemanticLocator({ type: 'role', role: 'button', name: 'Submit', options: { exact: true } })
 * // => 'role:button:Submit:exact'
 */
export function formatSemanticLocator(locator: SemanticLocator): string {
  const optionParts: string[] = [];

  if (locator.options.exact !== undefined) {
    optionParts.push(locator.options.exact ? 'exact' : 'contains');
  }
  if (locator.options.ignoreCase === false) {
    optionParts.push('case');
  }
  if (locator.options.includeHidden) {
    optionParts.push('hidden');
  }

  switch (locator.type) {
    case 'role': {
      const parts = ['role', locator.role];
      if (locator.name) parts.push(locator.name);
      parts.push(...optionParts);
      return parts.join(':');
    }

    case 'text':
      return ['text', locator.text, ...optionParts].join(':');

    case 'label':
      return ['label', locator.labelText, ...optionParts].join(':');

    case 'placeholder':
    case 'alt':
    case 'title':
      return [locator.type, locator.text, ...optionParts].join(':');

    case 'testid':
      return `testid:${locator.value}`;
  }
}
