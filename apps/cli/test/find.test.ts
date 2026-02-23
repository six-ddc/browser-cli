import { describe, it, expect } from 'vitest';
import { parseFindArgs } from '../src/commands/find.js';

describe('parseFindArgs', () => {
  // ─── Semantic Locator Engines ──────────────────────────────────────

  describe('role engine', () => {
    it('builds role locator: find role button click', () => {
      const result = parseFindArgs(['role', 'button', 'click'], {});
      expect(result.selector).toBe('role=button');
      expect(result.action).toBe('click');
      expect(result.actionValue).toBeUndefined();
    });

    it('builds role locator with --name: find role button click --name "Submit"', () => {
      const result = parseFindArgs(['role', 'button', 'click'], { name: 'Submit' });
      expect(result.selector).toBe('role=button[name="Submit"]');
      expect(result.action).toBe('click');
    });

    it('builds role locator with --exact: find role button click --exact', () => {
      const result = parseFindArgs(['role', 'button', 'click'], { exact: true });
      expect(result.selector).toBe('role=button[exact]');
    });

    it('builds role locator with --name and --exact', () => {
      const result = parseFindArgs(['role', 'button', 'click'], { name: 'Submit', exact: true });
      expect(result.selector).toBe('role=button[name="Submit"][exact]');
    });

    it('handles role with fill action + value', () => {
      const result = parseFindArgs(['role', 'textbox', 'fill', 'hello'], {});
      expect(result.selector).toBe('role=textbox');
      expect(result.action).toBe('fill');
      expect(result.actionValue).toBe('hello');
    });
  });

  describe('text engine', () => {
    it('builds text locator: find text Submit click', () => {
      const result = parseFindArgs(['text', 'Submit', 'click'], {});
      expect(result.selector).toBe('text=Submit');
      expect(result.action).toBe('click');
    });

    it('preserves quoted text value', () => {
      const result = parseFindArgs(['text', '"Sign In"', 'click'], {});
      expect(result.selector).toBe('text="Sign In"');
    });

    it('wraps in quotes when --exact is used', () => {
      const result = parseFindArgs(['text', 'Submit', 'click'], { exact: true });
      expect(result.selector).toBe('text="Submit"');
    });

    it('does not double-quote already quoted value with --exact', () => {
      const result = parseFindArgs(['text', '"Submit"', 'click'], { exact: true });
      expect(result.selector).toBe('text="Submit"');
    });
  });

  describe('label engine', () => {
    it('builds label locator: find label Email fill test@test.com', () => {
      const result = parseFindArgs(['label', 'Email', 'fill', 'test@test.com'], {});
      expect(result.selector).toBe('label=Email');
      expect(result.action).toBe('fill');
      expect(result.actionValue).toBe('test@test.com');
    });

    it('handles quoted label', () => {
      const result = parseFindArgs(['label', '"Email Address"', 'click'], {});
      expect(result.selector).toBe('label="Email Address"');
    });
  });

  describe('placeholder engine', () => {
    it('builds placeholder locator', () => {
      const result = parseFindArgs(['placeholder', 'Enter name', 'fill', 'John'], {});
      expect(result.selector).toBe('placeholder=Enter name');
      expect(result.action).toBe('fill');
      expect(result.actionValue).toBe('John');
    });
  });

  describe('alt engine', () => {
    it('builds alt locator', () => {
      const result = parseFindArgs(['alt', 'Logo', 'click'], {});
      expect(result.selector).toBe('alt=Logo');
    });
  });

  describe('title engine', () => {
    it('builds title locator', () => {
      const result = parseFindArgs(['title', 'Close', 'click'], {});
      expect(result.selector).toBe('title=Close');
    });
  });

  describe('testid engine', () => {
    it('builds testid locator', () => {
      const result = parseFindArgs(['testid', 'login-btn', 'click'], {});
      expect(result.selector).toBe('testid=login-btn');
    });
  });

  describe('xpath engine', () => {
    it('builds xpath locator', () => {
      const result = parseFindArgs(['xpath', '//button[@type="submit"]', 'click'], {});
      expect(result.selector).toBe('xpath=//button[@type="submit"]');
    });

    it('handles complex xpath expression', () => {
      const result = parseFindArgs(['xpath', '//div[@class="container"]//a[1]', 'click'], {});
      expect(result.selector).toBe('xpath=//div[@class="container"]//a[1]');
    });
  });

  // ─── Position Selectors ────────────────────────────────────────────

  describe('first position selector', () => {
    it('parses: find first .item click', () => {
      const result = parseFindArgs(['first', '.item', 'click'], {});
      expect(result.selector).toBe('.item');
      expect(result.action).toBe('click');
      expect(result.position).toEqual({ type: 'first' });
    });

    it('parses with action value: find first input fill hello', () => {
      const result = parseFindArgs(['first', 'input', 'fill', 'hello'], {});
      expect(result.selector).toBe('input');
      expect(result.action).toBe('fill');
      expect(result.actionValue).toBe('hello');
      expect(result.position).toEqual({ type: 'first' });
    });
  });

  describe('last position selector', () => {
    it('parses: find last .item click', () => {
      const result = parseFindArgs(['last', '.item', 'click'], {});
      expect(result.selector).toBe('.item');
      expect(result.action).toBe('click');
      expect(result.position).toEqual({ type: 'last' });
    });
  });

  describe('nth position selector', () => {
    it('parses: find nth 2 .item click', () => {
      const result = parseFindArgs(['nth', '2', '.item', 'click'], {});
      expect(result.selector).toBe('.item');
      expect(result.action).toBe('click');
      expect(result.position).toEqual({ type: 'nth', index: 2 });
    });

    it('rejects zero index (1-based)', () => {
      expect(() => parseFindArgs(['nth', '0', '.item', 'click'], {})).toThrow(
        'positive integer (1-based)',
      );
    });

    it('rejects negative index', () => {
      expect(() => parseFindArgs(['nth', '-1', '.item', 'click'], {})).toThrow(
        'positive integer (1-based)',
      );
    });

    it('rejects non-numeric index', () => {
      expect(() => parseFindArgs(['nth', 'abc', '.item', 'click'], {})).toThrow(
        'positive integer (1-based)',
      );
    });

    it('handles nth with action value', () => {
      const result = parseFindArgs(['nth', '1', 'input', 'fill', 'value'], {});
      expect(result.selector).toBe('input');
      expect(result.action).toBe('fill');
      expect(result.actionValue).toBe('value');
      expect(result.position).toEqual({ type: 'nth', index: 1 });
    });
  });

  // ─── All Actions ───────────────────────────────────────────────────

  describe('all actions', () => {
    it('click', () => {
      const result = parseFindArgs(['text', 'Submit', 'click'], {});
      expect(result.action).toBe('click');
    });

    it('dblclick', () => {
      const result = parseFindArgs(['text', 'Submit', 'dblclick'], {});
      expect(result.action).toBe('dblclick');
    });

    it('fill with value', () => {
      const result = parseFindArgs(['text', 'Submit', 'fill', 'hello'], {});
      expect(result.action).toBe('fill');
      expect(result.actionValue).toBe('hello');
    });

    it('type with text', () => {
      const result = parseFindArgs(['text', 'Submit', 'type', 'hello'], {});
      expect(result.action).toBe('type');
      expect(result.actionValue).toBe('hello');
    });

    it('hover', () => {
      const result = parseFindArgs(['text', 'Submit', 'hover'], {});
      expect(result.action).toBe('hover');
    });

    it('check', () => {
      const result = parseFindArgs(['text', 'Submit', 'check'], {});
      expect(result.action).toBe('check');
    });

    it('uncheck', () => {
      const result = parseFindArgs(['text', 'Submit', 'uncheck'], {});
      expect(result.action).toBe('uncheck');
    });

    it('select with value', () => {
      const result = parseFindArgs(['text', 'Submit', 'select', 'opt1'], {});
      expect(result.action).toBe('select');
      expect(result.actionValue).toBe('opt1');
    });

    it('press with key', () => {
      const result = parseFindArgs(['text', 'Submit', 'press', 'Enter'], {});
      expect(result.action).toBe('press');
      expect(result.actionValue).toBe('Enter');
    });

    it('clear', () => {
      const result = parseFindArgs(['text', 'Submit', 'clear'], {});
      expect(result.action).toBe('clear');
    });

    it('focus', () => {
      const result = parseFindArgs(['text', 'Submit', 'focus'], {});
      expect(result.action).toBe('focus');
    });
  });

  // ─── Error Cases ───────────────────────────────────────────────────

  describe('error cases', () => {
    it('defaults to click when action is omitted', () => {
      const result = parseFindArgs(['role', 'button'], {});
      expect(result.selector).toBe('role=button');
      expect(result.action).toBe('click');
    });

    it('rejects single argument', () => {
      expect(() => parseFindArgs(['role'], {})).toThrow('Usage');
    });

    it('rejects empty args', () => {
      expect(() => parseFindArgs([], {})).toThrow('Usage');
    });

    it('rejects unknown engine', () => {
      expect(() => parseFindArgs(['unknown', 'value', 'click'], {})).toThrow('Unknown engine');
    });

    it('rejects unknown action', () => {
      expect(() => parseFindArgs(['text', 'Submit', 'destroy'], {})).toThrow('Unknown action');
    });

    it('lists valid engines in error message', () => {
      try {
        parseFindArgs(['unknown', 'value', 'click'], {});
      } catch (e) {
        expect((e as Error).message).toContain('role');
        expect((e as Error).message).toContain('text');
        expect((e as Error).message).toContain('first');
        expect((e as Error).message).toContain('nth');
      }
    });

    it('lists valid actions in error message', () => {
      try {
        parseFindArgs(['text', 'Submit', 'destroy'], {});
      } catch (e) {
        expect((e as Error).message).toContain('click');
        expect((e as Error).message).toContain('fill');
      }
    });
  });
});
