import { describe, it, expect } from 'vitest';
import { buildCommand } from '../src/commands/find.js';

type Position = { type: 'first' | 'last' | 'nth'; index?: number } | undefined;

describe('buildCommand', () => {
  // ─── Selector pass-through ─────────────────────────────────────────

  describe('selector is passed through unchanged', () => {
    it('CSS selector', () => {
      const result = buildCommand('#submit', 'click', undefined);
      expect(result.params.selector).toBe('#submit');
    });

    it('semantic locator: role=button', () => {
      const result = buildCommand('role=button', 'click', undefined);
      expect(result.params.selector).toBe('role=button');
    });

    it('semantic locator: role=button[name="Submit"]', () => {
      const result = buildCommand('role=button[name="Submit"]', 'click', undefined);
      expect(result.params.selector).toBe('role=button[name="Submit"]');
    });

    it('semantic locator: text=Sign In', () => {
      const result = buildCommand('text=Sign In', 'click', undefined);
      expect(result.params.selector).toBe('text=Sign In');
    });

    it('semantic locator: text="Sign In" (exact)', () => {
      const result = buildCommand('text="Sign In"', 'click', undefined);
      expect(result.params.selector).toBe('text="Sign In"');
    });

    it('semantic locator: label=Email', () => {
      const result = buildCommand('label=Email', 'fill', 'test@test.com');
      expect(result.params.selector).toBe('label=Email');
    });

    it('semantic locator: placeholder=Search', () => {
      const result = buildCommand('placeholder=Search', 'fill', 'query');
      expect(result.params.selector).toBe('placeholder=Search');
    });

    it('semantic locator: testid=login-btn', () => {
      const result = buildCommand('testid=login-btn', 'click', undefined);
      expect(result.params.selector).toBe('testid=login-btn');
    });

    it('semantic locator: xpath=//button[@type="submit"]', () => {
      const result = buildCommand('xpath=//button[@type="submit"]', 'click', undefined);
      expect(result.params.selector).toBe('xpath=//button[@type="submit"]');
    });

    it('element ref: @e1', () => {
      const result = buildCommand('@e1', 'click', undefined);
      expect(result.params.selector).toBe('@e1');
    });
  });

  // ─── Actions ───────────────────────────────────────────────────────

  describe('action: click', () => {
    it('produces click action with button=left', () => {
      const result = buildCommand('role=button', 'click', undefined);
      expect(result.action).toBe('click');
      expect(result.params.button).toBe('left');
    });
  });

  describe('action: dblclick', () => {
    it('produces dblclick action', () => {
      const result = buildCommand('role=button', 'dblclick', undefined);
      expect(result.action).toBe('dblclick');
    });
  });

  describe('action: fill', () => {
    it('produces fill action with value', () => {
      const result = buildCommand('label=Email', 'fill', 'test@test.com');
      expect(result.action).toBe('fill');
      expect(result.params.value).toBe('test@test.com');
    });

    it('throws when value is missing', () => {
      expect(() => buildCommand('label=Email', 'fill', undefined)).toThrow('fill requires a value');
    });
  });

  describe('action: type', () => {
    it('produces type action with text', () => {
      const result = buildCommand('#input', 'type', 'hello');
      expect(result.action).toBe('type');
      expect(result.params.text).toBe('hello');
      expect(result.params.delay).toBe(0);
    });

    it('throws when text is missing', () => {
      expect(() => buildCommand('#input', 'type', undefined)).toThrow('type requires text');
    });
  });

  describe('action: select', () => {
    it('produces select action with value', () => {
      const result = buildCommand('select', 'select', 'opt1');
      expect(result.action).toBe('select');
      expect(result.params.value).toBe('opt1');
    });

    it('throws when value is missing', () => {
      expect(() => buildCommand('select', 'select', undefined)).toThrow('select requires a value');
    });
  });

  describe('action: press', () => {
    it('produces press action with key', () => {
      const result = buildCommand('#input', 'press', 'Enter');
      expect(result.action).toBe('press');
      expect(result.params.key).toBe('Enter');
    });

    it('throws when key is missing', () => {
      expect(() => buildCommand('#input', 'press', undefined)).toThrow('press requires a key');
    });
  });

  describe('action: hover / check / uncheck / clear / focus', () => {
    for (const action of ['hover', 'check', 'uncheck', 'clear', 'focus']) {
      it(`produces ${action} action`, () => {
        const result = buildCommand('role=button', action, undefined);
        expect(result.action).toBe(action);
        expect(result.params.selector).toBe('role=button');
      });
    }
  });

  // ─── Position ──────────────────────────────────────────────────────

  describe('position option', () => {
    it('--first → position { type: first }', () => {
      const pos: Position = { type: 'first' };
      const result = buildCommand('.item', 'click', undefined, pos);
      expect(result.params.position).toEqual({ type: 'first' });
    });

    it('--last → position { type: last }', () => {
      const pos: Position = { type: 'last' };
      const result = buildCommand('.item', 'click', undefined, pos);
      expect(result.params.position).toEqual({ type: 'last' });
    });

    it('--nth 2 → position { type: nth, index: 2 }', () => {
      const pos: Position = { type: 'nth', index: 2 };
      const result = buildCommand('.item', 'click', undefined, pos);
      expect(result.params.position).toEqual({ type: 'nth', index: 2 });
    });

    it('--nth 1 → position { type: nth, index: 1 }', () => {
      const pos: Position = { type: 'nth', index: 1 };
      const result = buildCommand('input', 'fill', 'hello', pos);
      expect(result.params.position).toEqual({ type: 'nth', index: 1 });
      expect(result.params.value).toBe('hello');
    });

    it('no position option → position is undefined', () => {
      const result = buildCommand('.item', 'click', undefined, undefined);
      expect(result.params.position).toBeUndefined();
    });
  });
});
