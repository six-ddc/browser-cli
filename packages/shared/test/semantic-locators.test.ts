import { describe, it, expect } from 'vitest';
import {
  parseSemanticLocator,
  formatSemanticLocator,
  isSemanticLocator,
  type SemanticLocator,
  type RoleLocator,
  type TextLocator,
  type LabelLocator,
  type TestIdLocator,
} from '../src/protocol/semantic-locators.js';

describe('semantic-locators - validation', () => {
  it('recognizes valid semantic locators', () => {
    expect(isSemanticLocator('role:button:Submit')).toBe(true);
    expect(isSemanticLocator('text:Sign In')).toBe(true);
    expect(isSemanticLocator('label:Email')).toBe(true);
    expect(isSemanticLocator('placeholder:Search')).toBe(true);
    expect(isSemanticLocator('alt:Logo')).toBe(true);
    expect(isSemanticLocator('title:Help')).toBe(true);
    expect(isSemanticLocator('testid:login-button')).toBe(true);
  });

  it('rejects invalid semantic locators', () => {
    expect(isSemanticLocator('button')).toBe(false);
    expect(isSemanticLocator('#id')).toBe(false);
    expect(isSemanticLocator('.class')).toBe(false);
    expect(isSemanticLocator('@e1')).toBe(false);
    expect(isSemanticLocator('unknown:value')).toBe(false);
    expect(isSemanticLocator('')).toBe(false);
  });
});

describe('semantic-locators - role parsing', () => {
  it('parses role with name', () => {
    const result = parseSemanticLocator('role:button:Submit') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('role');
    expect(result.role).toBe('button');
    expect(result.name).toBe('Submit');
    expect(result.options.exact).toBe(true);
    expect(result.options.ignoreCase).toBe(true);
  });

  it('parses role without name', () => {
    const result = parseSemanticLocator('role:button') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('role');
    expect(result.role).toBe('button');
    expect(result.name).toBeUndefined();
  });

  it('parses role with exact option', () => {
    const result = parseSemanticLocator('role:button:Submit:exact') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.options.exact).toBe(true);
  });

  it('parses role with contains option', () => {
    const result = parseSemanticLocator('role:button:Submit:contains') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.options.exact).toBe(false);
  });

  it('normalizes role to lowercase', () => {
    const result = parseSemanticLocator('role:BUTTON:Submit') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.role).toBe('button');
  });

  it('handles complex role names', () => {
    const result = parseSemanticLocator('role:textbox:Email Address') as RoleLocator;
    expect(result).not.toBeNull();
    expect(result.role).toBe('textbox');
    expect(result.name).toBe('Email Address');
  });
});

describe('semantic-locators - text parsing', () => {
  it('parses simple text', () => {
    const result = parseSemanticLocator('text:Sign In') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('text');
    expect(result.text).toBe('Sign In');
    expect(result.options.exact).toBe(false); // text defaults to contains
    expect(result.options.ignoreCase).toBe(true);
  });

  it('parses text with exact option', () => {
    const result = parseSemanticLocator('text:Welcome:exact') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Welcome');
    expect(result.options.exact).toBe(true);
  });

  it('handles text with colons', () => {
    const result = parseSemanticLocator('text:Time: 10:30 AM') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Time: 10:30 AM');
  });

  it('handles text with colons and options', () => {
    const result = parseSemanticLocator('text:Time: 10:30:exact') as TextLocator;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Time: 10:30');
    expect(result.options.exact).toBe(true);
  });
});

describe('semantic-locators - label parsing', () => {
  it('parses label text', () => {
    const result = parseSemanticLocator('label:Email') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('label');
    expect(result.labelText).toBe('Email');
    expect(result.options.exact).toBe(false);
  });

  it('parses label with exact option', () => {
    const result = parseSemanticLocator('label:Password:exact') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.labelText).toBe('Password');
    expect(result.options.exact).toBe(true);
  });

  it('handles label with multiple words', () => {
    const result = parseSemanticLocator('label:Email Address') as LabelLocator;
    expect(result).not.toBeNull();
    expect(result.labelText).toBe('Email Address');
  });
});

describe('semantic-locators - placeholder parsing', () => {
  it('parses placeholder', () => {
    const result = parseSemanticLocator('placeholder:Search...');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('placeholder');
    expect((result as any).text).toBe('Search...');
  });

  it('parses placeholder with exact', () => {
    const result = parseSemanticLocator('placeholder:Enter text:exact');
    expect(result).not.toBeNull();
    expect(result?.options.exact).toBe(true);
  });
});

describe('semantic-locators - alt parsing', () => {
  it('parses alt text', () => {
    const result = parseSemanticLocator('alt:Company Logo');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('alt');
    expect((result as any).text).toBe('Company Logo');
  });
});

describe('semantic-locators - title parsing', () => {
  it('parses title', () => {
    const result = parseSemanticLocator('title:Help Center');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('title');
    expect((result as any).text).toBe('Help Center');
  });
});

describe('semantic-locators - testid parsing', () => {
  it('parses testid', () => {
    const result = parseSemanticLocator('testid:login-button') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.type).toBe('testid');
    expect(result.value).toBe('login-button');
    expect(result.options.exact).toBe(true); // testid defaults to exact
    expect(result.options.ignoreCase).toBe(false); // testid is case-sensitive
  });

  it('handles testid with special characters', () => {
    const result = parseSemanticLocator('testid:user-profile-123') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.value).toBe('user-profile-123');
  });

  it('handles testid with dots', () => {
    const result = parseSemanticLocator('testid:btn.submit.primary') as TestIdLocator;
    expect(result).not.toBeNull();
    expect(result.value).toBe('btn.submit.primary');
  });
});

describe('semantic-locators - options parsing', () => {
  it('parses exact option', () => {
    const result = parseSemanticLocator('text:Hello:exact');
    expect(result?.options.exact).toBe(true);
  });

  it('parses contains option', () => {
    const result = parseSemanticLocator('text:Hello:contains');
    expect(result?.options.exact).toBe(false);
  });

  it('parses case option', () => {
    const result = parseSemanticLocator('text:Hello:case');
    expect(result?.options.ignoreCase).toBe(false);
  });

  it('parses nocase option', () => {
    const result = parseSemanticLocator('text:Hello:nocase');
    expect(result?.options.ignoreCase).toBe(true);
  });

  it('parses hidden option', () => {
    const result = parseSemanticLocator('text:Hello:hidden');
    expect(result?.options.includeHidden).toBe(true);
  });

  it('parses multiple options', () => {
    const result = parseSemanticLocator('role:button:Submit:exact:case:hidden');
    expect(result?.options.exact).toBe(true);
    expect(result?.options.ignoreCase).toBe(false);
    expect(result?.options.includeHidden).toBe(true);
  });
});

describe('semantic-locators - formatting', () => {
  it('formats role locator', () => {
    const locator: RoleLocator = {
      type: 'role',
      role: 'button',
      name: 'Submit',
      options: { exact: true, ignoreCase: true },
    };
    const formatted = formatSemanticLocator(locator);
    expect(formatted).toBe('role:button:Submit:exact');
  });

  it('formats role without name', () => {
    const locator: RoleLocator = {
      type: 'role',
      role: 'button',
      options: { exact: true, ignoreCase: true },
    };
    const formatted = formatSemanticLocator(locator);
    expect(formatted).toBe('role:button:exact');
  });

  it('formats text locator', () => {
    const locator: TextLocator = {
      type: 'text',
      text: 'Sign In',
      options: { exact: false, ignoreCase: true },
    };
    const formatted = formatSemanticLocator(locator);
    expect(formatted).toBe('text:Sign In:contains');
  });

  it('formats testid locator', () => {
    const locator: TestIdLocator = {
      type: 'testid',
      value: 'login-button',
      options: { exact: true, ignoreCase: false },
    };
    const formatted = formatSemanticLocator(locator);
    expect(formatted).toBe('testid:login-button');
  });

  it('includes case option when ignoreCase is false', () => {
    const locator: TextLocator = {
      type: 'text',
      text: 'Hello',
      options: { exact: true, ignoreCase: false },
    };
    const formatted = formatSemanticLocator(locator);
    expect(formatted).toContain('case');
  });

  it('includes hidden option when includeHidden is true', () => {
    const locator: TextLocator = {
      type: 'text',
      text: 'Hello',
      options: { exact: false, ignoreCase: true, includeHidden: true },
    };
    const formatted = formatSemanticLocator(locator);
    expect(formatted).toContain('hidden');
  });
});

describe('semantic-locators - round-trip', () => {
  it('parses and formats consistently', () => {
    const inputs = [
      'role:button:Submit:exact',
      'text:Sign In',
      'label:Email:exact',
      'placeholder:Search',
      'alt:Logo',
      'title:Help',
      'testid:login-button',
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
});

describe('semantic-locators - edge cases', () => {
  it('handles empty strings', () => {
    expect(parseSemanticLocator('')).toBeNull();
    expect(parseSemanticLocator('role:')).toBeNull();
  });

  it('handles malformed input', () => {
    expect(parseSemanticLocator('role')).toBeNull();
    expect(parseSemanticLocator(':button')).toBeNull();
    expect(parseSemanticLocator('role::')).toBeNull();
  });

  it('handles unknown locator types', () => {
    expect(parseSemanticLocator('unknown:value')).toBeNull();
  });

  it('handles single-word text', () => {
    const result = parseSemanticLocator('text:Login');
    expect(result).not.toBeNull();
    expect((result as TextLocator).text).toBe('Login');
  });

  it('handles unicode characters', () => {
    const result = parseSemanticLocator('text:登录');
    expect(result).not.toBeNull();
    expect((result as TextLocator).text).toBe('登录');
  });

  it('handles special characters in text', () => {
    const result = parseSemanticLocator('text:Click "here"');
    expect(result).not.toBeNull();
    expect((result as TextLocator).text).toBe('Click "here"');
  });
});
