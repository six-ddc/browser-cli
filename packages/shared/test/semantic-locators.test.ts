import { describe, it, expect } from 'vitest';
import {
  parseSemanticLocator,
  formatSemanticLocator,
  isSemanticLocator,
  type RoleLocator,
  type TextLocator,
  type LabelLocator,
  type PlaceholderLocator,
  type AltLocator,
  type TitleLocator,
  type TestIdLocator,
  type XPathLocator,
} from '../src/protocol/semantic-locators.js';

// ─── Validation ──────────────────────────────────────────────────────

describe('isSemanticLocator', () => {
  it('recognizes all valid engine prefixes', () => {
    expect(isSemanticLocator('role=button')).toBe(true);
    expect(isSemanticLocator('text=Submit')).toBe(true);
    expect(isSemanticLocator('label=Email')).toBe(true);
    expect(isSemanticLocator('placeholder=Search')).toBe(true);
    expect(isSemanticLocator('alt=Logo')).toBe(true);
    expect(isSemanticLocator('title=Help')).toBe(true);
    expect(isSemanticLocator('testid=login-button')).toBe(true);
    expect(isSemanticLocator('xpath=//button')).toBe(true);
  });

  it('recognizes locators with bracket options', () => {
    expect(isSemanticLocator('role=button[name="Submit"]')).toBe(true);
    expect(isSemanticLocator('text=Submit[exact]')).toBe(true);
    expect(isSemanticLocator('text="Submit"')).toBe(true);
  });

  it('rejects non-locator strings', () => {
    expect(isSemanticLocator('button')).toBe(false);
    expect(isSemanticLocator('#id')).toBe(false);
    expect(isSemanticLocator('.class')).toBe(false);
    expect(isSemanticLocator('@e1')).toBe(false);
    expect(isSemanticLocator('unknown=value')).toBe(false);
    expect(isSemanticLocator('')).toBe(false);
    expect(isSemanticLocator('role')).toBe(false);
    expect(isSemanticLocator('=button')).toBe(false);
  });

  it('rejects old colon-based syntax', () => {
    expect(isSemanticLocator('role:button')).toBe(false);
    expect(isSemanticLocator('text:Submit')).toBe(false);
    expect(isSemanticLocator('label:Email')).toBe(false);
  });

  it('rejects locators with empty value after =', () => {
    // The regex requires at least one char after =
    expect(isSemanticLocator('role=')).toBe(false);
    expect(isSemanticLocator('text=')).toBe(false);
  });
});

// ─── Role parsing ────────────────────────────────────────────────────

describe('parseSemanticLocator — role', () => {
  it('parses bare role', () => {
    const result = parseSemanticLocator('role=button') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('role');
    expect(result.role).toBe('button');
    expect(result.name).toBeUndefined();
    expect(result.options.exact).toBe(false);
    expect(result.options.ignoreCase).toBe(true);
  });

  it('parses role with name bracket', () => {
    const result = parseSemanticLocator('role=button[name="Submit"]') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('role');
    expect(result.role).toBe('button');
    expect(result.name).toBe('Submit');
    expect(result.options.exact).toBe(false);
  });

  it('parses role with name and exact', () => {
    const result = parseSemanticLocator('role=button[name="Submit"][exact]') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.role).toBe('button');
    expect(result.name).toBe('Submit');
    expect(result.options.exact).toBe(true);
  });

  it('parses role with name, exact, and hidden', () => {
    const result = parseSemanticLocator('role=button[name="Submit"][exact][hidden]') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.name).toBe('Submit');
    expect(result.options.exact).toBe(true);
    expect(result.options.includeHidden).toBe(true);
  });

  it('normalizes role to lowercase', () => {
    const result = parseSemanticLocator('role=BUTTON') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.role).toBe('button');
  });

  it('handles various ARIA roles', () => {
    for (const role of ['textbox', 'link', 'heading', 'checkbox', 'radio', 'tab', 'dialog']) {
      const result = parseSemanticLocator(`role=${role}`) as RoleLocator;
      expect(result).not.toBeNull();
      expect(result.role).toBe(role);
    }
  });

  it('handles name with spaces', () => {
    const result = parseSemanticLocator('role=textbox[name="Email Address"]') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.role).toBe('textbox');
    expect(result.name).toBe('Email Address');
  });

  it('handles name with single quotes', () => {
    const result = parseSemanticLocator("role=button[name='Submit']") as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.name).toBe('Submit');
  });

  it('handles name without quotes (bare value)', () => {
    const result = parseSemanticLocator('role=button[name=Submit]') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.name).toBe('Submit');
  });

  it('parses role with hidden only', () => {
    const result = parseSemanticLocator('role=button[hidden]') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.role).toBe('button');
    expect(result.name).toBeUndefined();
    expect(result.options.includeHidden).toBe(true);
  });
});

// ─── Text parsing ────────────────────────────────────────────────────

describe('parseSemanticLocator — text', () => {
  it('parses simple text (substring match by default)', () => {
    const result = parseSemanticLocator('text=Sign In') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('text');
    expect(result.text).toBe('Sign In');
    expect(result.options.exact).toBe(false);
    expect(result.options.ignoreCase).toBe(true);
  });

  it('parses quoted text (exact match)', () => {
    const result = parseSemanticLocator('text="Sign In"') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Sign In');
    expect(result.options.exact).toBe(true);
  });

  it('parses text with [exact] bracket', () => {
    const result = parseSemanticLocator('text=Submit[exact]') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Submit');
    expect(result.options.exact).toBe(true);
  });

  it('parses text with [hidden] bracket', () => {
    const result = parseSemanticLocator('text=Submit[hidden]') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Submit');
    expect(result.options.includeHidden).toBe(true);
  });

  it('parses text with [exact][hidden]', () => {
    const result = parseSemanticLocator('text=Submit[exact][hidden]') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Submit');
    expect(result.options.exact).toBe(true);
    expect(result.options.includeHidden).toBe(true);
  });

  it('parses quoted text with [hidden]', () => {
    const result = parseSemanticLocator('text="Submit"[hidden]') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Submit');
    expect(result.options.exact).toBe(true);
    expect(result.options.includeHidden).toBe(true);
  });

  it('handles single-word text', () => {
    const result = parseSemanticLocator('text=Login') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Login');
  });

  it('handles unicode text', () => {
    const result = parseSemanticLocator('text=登录') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('登录');
  });

  it('handles text with special characters', () => {
    const result = parseSemanticLocator('text=Hello World!') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Hello World!');
  });

  it('handles text with equals sign in value', () => {
    // Only first = is the delimiter
    const result = parseSemanticLocator('text=a=b') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('a=b');
  });
});

// ─── Label parsing ───────────────────────────────────────────────────

describe('parseSemanticLocator — label', () => {
  it('parses simple label (substring by default)', () => {
    const result = parseSemanticLocator('label=Email') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('label');
    expect(result.labelText).toBe('Email');
    expect(result.options.exact).toBe(false);
  });

  it('parses quoted label (exact)', () => {
    const result = parseSemanticLocator('label="Email Address"') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.labelText).toBe('Email Address');
    expect(result.options.exact).toBe(true);
  });

  it('parses label with [exact] bracket', () => {
    const result = parseSemanticLocator('label=Password[exact]') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.labelText).toBe('Password');
    expect(result.options.exact).toBe(true);
  });

  it('handles multi-word label', () => {
    const result = parseSemanticLocator('label=Email Address') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.labelText).toBe('Email Address');
  });

  it('handles label with [hidden]', () => {
    const result = parseSemanticLocator('label=Email[hidden]') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.options.includeHidden).toBe(true);
  });
});

// ─── Placeholder parsing ─────────────────────────────────────────────

describe('parseSemanticLocator — placeholder', () => {
  it('parses simple placeholder', () => {
    const result = parseSemanticLocator('placeholder=Search...') as PlaceholderLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('placeholder');
    expect(result.text).toBe('Search...');
    expect(result.options.exact).toBe(false);
  });

  it('parses quoted placeholder (exact)', () => {
    const result = parseSemanticLocator('placeholder="Enter text"') as PlaceholderLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Enter text');
    expect(result.options.exact).toBe(true);
  });

  it('parses placeholder with [exact]', () => {
    const result = parseSemanticLocator('placeholder=Search[exact]') as PlaceholderLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Search');
    expect(result.options.exact).toBe(true);
  });
});

// ─── Alt parsing ─────────────────────────────────────────────────────

describe('parseSemanticLocator — alt', () => {
  it('parses alt text', () => {
    const result = parseSemanticLocator('alt=Company Logo') as AltLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('alt');
    expect(result.text).toBe('Company Logo');
    expect(result.options.exact).toBe(false);
  });

  it('parses quoted alt (exact)', () => {
    const result = parseSemanticLocator('alt="Icon"') as AltLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Icon');
    expect(result.options.exact).toBe(true);
  });

  it('parses alt with [exact]', () => {
    const result = parseSemanticLocator('alt=Logo[exact]') as AltLocator;
    expect(result).not.toBeNull();
    expect(result.options.exact).toBe(true);
  });
});

// ─── Title parsing ───────────────────────────────────────────────────

describe('parseSemanticLocator — title', () => {
  it('parses title', () => {
    const result = parseSemanticLocator('title=Help Center') as TitleLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('title');
    expect(result.text).toBe('Help Center');
    expect(result.options.exact).toBe(false);
  });

  it('parses quoted title (exact)', () => {
    const result = parseSemanticLocator('title="Information"') as TitleLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Information');
    expect(result.options.exact).toBe(true);
  });
});

// ─── TestID parsing ──────────────────────────────────────────────────

describe('parseSemanticLocator — testid', () => {
  it('parses testid (always exact, case-sensitive)', () => {
    const result = parseSemanticLocator('testid=login-button') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('testid');
    expect(result.value).toBe('login-button');
    expect(result.options.exact).toBe(true);
    expect(result.options.ignoreCase).toBe(false);
  });

  it('handles testid with special characters', () => {
    const result = parseSemanticLocator('testid=user-profile-123') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.value).toBe('user-profile-123');
  });

  it('handles testid with dots', () => {
    const result = parseSemanticLocator('testid=btn.submit.primary') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.value).toBe('btn.submit.primary');
  });

  it('handles testid with [hidden]', () => {
    const result = parseSemanticLocator('testid=login-btn[hidden]') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.value).toBe('login-btn');
    expect(result.options.includeHidden).toBe(true);
  });
});

// ─── XPath parsing ───────────────────────────────────────────────────

describe('parseSemanticLocator — xpath', () => {
  it('parses simple XPath', () => {
    const result = parseSemanticLocator('xpath=//button') as XPathLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('xpath');
    expect(result.expression).toBe('//button');
  });

  it('parses XPath with attributes', () => {
    const result = parseSemanticLocator('xpath=//button[@type="submit"]') as XPathLocator;
    expect(result).not.toBeNull();
    expect(result.expression).toBe('//button[@type="submit"]');
  });

  it('parses XPath with complex expression', () => {
    const result = parseSemanticLocator(
      'xpath=//div[@class="container"]//a[contains(text(),"Link")]',
    ) as XPathLocator;
    expect(result).not.toBeNull();
    expect(result.expression).toBe('//div[@class="container"]//a[contains(text(),"Link")]');
  });

  it('preserves brackets in XPath (not treated as options)', () => {
    const result = parseSemanticLocator('xpath=//input[@name="email"]') as XPathLocator;
    expect(result).not.toBeNull();
    expect(result.expression).toBe('//input[@name="email"]');
  });

  it('parses relative XPath', () => {
    const result = parseSemanticLocator('xpath=.//span') as XPathLocator;
    expect(result).not.toBeNull();
    expect(result.expression).toBe('.//span');
  });
});

// ─── Bracket option parsing ──────────────────────────────────────────

describe('bracket options', () => {
  it('[exact] sets exact=true', () => {
    const result = parseSemanticLocator('text=Hello[exact]');
    expect(result?.options.exact).toBe(true);
  });

  it('[hidden] sets includeHidden=true', () => {
    const result = parseSemanticLocator('text=Hello[hidden]');
    expect(result?.options.includeHidden).toBe(true);
  });

  it('[exact][hidden] sets both', () => {
    const result = parseSemanticLocator('text=Hello[exact][hidden]');
    expect(result?.options.exact).toBe(true);
    expect(result?.options.includeHidden).toBe(true);
  });

  it('bracket options are case-insensitive', () => {
    const result = parseSemanticLocator('text=Hello[EXACT]');
    expect(result?.options.exact).toBe(true);
  });

  it('unknown brackets are not extracted', () => {
    // [foo] is not a known bracket, so it stays in the value
    const result = parseSemanticLocator('text=Hello[foo]') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Hello[foo]');
  });
});

// ─── Quoted value semantics ──────────────────────────────────────────

describe('quoted values', () => {
  it('double-quoted value means exact match for text', () => {
    const result = parseSemanticLocator('text="Submit"') as TextLocator;
    expect(result.text).toBe('Submit');
    expect(result.options.exact).toBe(true);
  });

  it('double-quoted value means exact match for label', () => {
    const result = parseSemanticLocator('label="Email"') as LabelLocator;
    expect(result.labelText).toBe('Email');
    expect(result.options.exact).toBe(true);
  });

  it('double-quoted value means exact match for placeholder', () => {
    const result = parseSemanticLocator('placeholder="Search"') as PlaceholderLocator;
    expect(result.text).toBe('Search');
    expect(result.options.exact).toBe(true);
  });

  it('double-quoted value means exact match for alt', () => {
    const result = parseSemanticLocator('alt="Logo"') as AltLocator;
    expect(result.text).toBe('Logo');
    expect(result.options.exact).toBe(true);
  });

  it('double-quoted value means exact match for title', () => {
    const result = parseSemanticLocator('title="Help"') as TitleLocator;
    expect(result.text).toBe('Help');
    expect(result.options.exact).toBe(true);
  });

  it('quoted value with spaces', () => {
    const result = parseSemanticLocator('text="Click here to continue"') as TextLocator;
    expect(result.text).toBe('Click here to continue');
    expect(result.options.exact).toBe(true);
  });
});

// ─── Formatting ──────────────────────────────────────────────────────

describe('formatSemanticLocator', () => {
  it('formats bare role', () => {
    const locator: RoleLocator = {
      type: 'role',
      role: 'button',
      options: { exact: false, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('role=button');
  });

  it('formats role with name', () => {
    const locator: RoleLocator = {
      type: 'role',
      role: 'button',
      name: 'Submit',
      options: { exact: false, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('role=button[name="Submit"]');
  });

  it('formats role with name and exact', () => {
    const locator: RoleLocator = {
      type: 'role',
      role: 'button',
      name: 'Submit',
      options: { exact: true, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('role=button[name="Submit"][exact]');
  });

  it('formats role with hidden', () => {
    const locator: RoleLocator = {
      type: 'role',
      role: 'button',
      options: { exact: false, ignoreCase: true, includeHidden: true },
    };
    expect(formatSemanticLocator(locator)).toBe('role=button[hidden]');
  });

  it('formats text (substring)', () => {
    const locator: TextLocator = {
      type: 'text',
      text: 'Sign In',
      options: { exact: false, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('text=Sign In');
  });

  it('formats text (exact) with quotes', () => {
    const locator: TextLocator = {
      type: 'text',
      text: 'Sign In',
      options: { exact: true, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('text="Sign In"');
  });

  it('formats text with hidden', () => {
    const locator: TextLocator = {
      type: 'text',
      text: 'Hello',
      options: { exact: false, ignoreCase: true, includeHidden: true },
    };
    expect(formatSemanticLocator(locator)).toBe('text=Hello[hidden]');
  });

  it('formats label (exact) with quotes', () => {
    const locator: LabelLocator = {
      type: 'label',
      labelText: 'Email',
      options: { exact: true, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('label="Email"');
  });

  it('formats testid', () => {
    const locator: TestIdLocator = {
      type: 'testid',
      value: 'login-button',
      options: { exact: true, ignoreCase: false },
    };
    expect(formatSemanticLocator(locator)).toBe('testid=login-button');
  });

  it('formats xpath', () => {
    const locator: XPathLocator = {
      type: 'xpath',
      expression: '//button[@type="submit"]',
      options: { exact: true, ignoreCase: false },
    };
    expect(formatSemanticLocator(locator)).toBe('xpath=//button[@type="submit"]');
  });

  it('formats placeholder (exact) with quotes', () => {
    const locator: PlaceholderLocator = {
      type: 'placeholder',
      text: 'Search',
      options: { exact: true, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('placeholder="Search"');
  });

  it('formats alt (substring)', () => {
    const locator: AltLocator = {
      type: 'alt',
      text: 'Logo',
      options: { exact: false, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('alt=Logo');
  });

  it('formats title (exact) with quotes', () => {
    const locator: TitleLocator = {
      type: 'title',
      text: 'Help',
      options: { exact: true, ignoreCase: true },
    };
    expect(formatSemanticLocator(locator)).toBe('title="Help"');
  });
});

// ─── Round-trip consistency ──────────────────────────────────────────

describe('round-trip', () => {
  it('parse → format → parse is consistent', () => {
    const inputs = [
      'role=button',
      'role=button[name="Submit"]',
      'role=button[name="Submit"][exact]',
      'text=Sign In',
      'text="Sign In"',
      'label=Email',
      'label="Email"',
      'placeholder=Search',
      'alt=Logo',
      'title=Help',
      'testid=login-button',
      'xpath=//button',
    ];

    for (const input of inputs) {
      const parsed = parseSemanticLocator(input);
      expect(parsed).not.toBeNull();
      if (parsed) {
        const formatted = formatSemanticLocator(parsed);
        const reparsed = parseSemanticLocator(formatted);
        expect(reparsed).toEqual(parsed);
      }
    }
  });

  it('formats then reparses locators with hidden option', () => {
    const inputs = ['text=Hello[hidden]', 'role=button[hidden]', 'testid=btn[hidden]'];

    for (const input of inputs) {
      const parsed = parseSemanticLocator(input);
      expect(parsed).not.toBeNull();
      if (parsed) {
        const formatted = formatSemanticLocator(parsed);
        const reparsed = parseSemanticLocator(formatted);
        expect(reparsed).toEqual(parsed);
      }
    }
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns null for empty string', () => {
    expect(parseSemanticLocator('')).toBeNull();
  });

  it('returns null for engine with no value', () => {
    expect(parseSemanticLocator('role=')).toBeNull();
    expect(parseSemanticLocator('text=')).toBeNull();
  });

  it('returns null for bare engine name', () => {
    expect(parseSemanticLocator('role')).toBeNull();
    expect(parseSemanticLocator('text')).toBeNull();
  });

  it('returns null for unknown engine', () => {
    expect(parseSemanticLocator('unknown=value')).toBeNull();
    expect(parseSemanticLocator('css=.class')).toBeNull();
  });

  it('returns null for old colon syntax', () => {
    expect(parseSemanticLocator('role:button')).toBeNull();
    expect(parseSemanticLocator('text:Submit')).toBeNull();
  });

  it('handles unicode in text value', () => {
    const result = parseSemanticLocator('text=登录') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('登录');
  });

  it('handles emoji in text value', () => {
    const result = parseSemanticLocator('text=Click 🎯') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Click 🎯');
  });

  it('handles equals sign in text value', () => {
    const result = parseSemanticLocator('text=a=b=c') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('a=b=c');
  });

  it('handles XPath with many brackets (not extracted as options)', () => {
    const expr = '//div[@id="main"]//button[contains(@class,"primary")]';
    const result = parseSemanticLocator(`xpath=${expr}`) as XPathLocator;
    expect(result).not.toBeNull();
    expect(result.expression).toBe(expr);
  });

  it('handles testid with equals sign', () => {
    const result = parseSemanticLocator('testid=data=value') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.value).toBe('data=value');
  });
});
