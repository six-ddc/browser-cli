/**
 * Structured protocol errors: every error crossing a layer boundary must end
 * up with a known code, and unknown codes must degrade rather than throw.
 */

import { describe, it, expect } from 'vitest';
import {
  BrowserCliError,
  ERROR_CODES,
  EXIT_FAILURE,
  EXIT_INVALID_ARGS,
  EXIT_NOT_CONNECTED,
  EXIT_NOT_FOUND,
  EXIT_OK,
  EXIT_TIMEOUT,
  exitCodeFor,
  isProtocolError,
  normalizeError,
  protocolError,
  schemas,
  socketTimeoutFor,
} from '../src/index.js';

describe('protocolError', () => {
  it('omits hint when not provided', () => {
    expect(protocolError('TIMEOUT', 'too slow')).toEqual({ code: 'TIMEOUT', message: 'too slow' });
  });

  it('keeps the hint when provided', () => {
    expect(protocolError('TIMEOUT', 'too slow', 'raise --timeout')).toEqual({
      code: 'TIMEOUT',
      message: 'too slow',
      hint: 'raise --timeout',
    });
  });
});

describe('normalizeError', () => {
  it('fills in UNKNOWN when the code is missing', () => {
    expect(normalizeError({ message: 'boom' })).toEqual({ code: 'UNKNOWN', message: 'boom' });
  });

  it('fills in UNKNOWN when the code is not a known one', () => {
    expect(normalizeError({ code: 'WAT', message: 'boom' }).code).toBe('UNKNOWN');
  });

  it('preserves a known code and its hint', () => {
    expect(normalizeError({ code: 'STALE_REF', message: 'x', hint: 'y' })).toEqual({
      code: 'STALE_REF',
      message: 'x',
      hint: 'y',
    });
  });
});

describe('BrowserCliError', () => {
  it('is an Error, so existing catch paths keep working', () => {
    const err = new BrowserCliError('ELEMENT_OCCLUDED', 'covered');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('covered');
  });

  it('converts to a plain ProtocolError for the wire', () => {
    const err = new BrowserCliError('ELEMENT_DISABLED', 'disabled', 'enable it');
    expect(err.toProtocolError()).toEqual({
      code: 'ELEMENT_DISABLED',
      message: 'disabled',
      hint: 'enable it',
    });
  });
});

describe('isProtocolError', () => {
  it('accepts an object with a code and a message', () => {
    expect(isProtocolError({ code: 'TIMEOUT', message: 'x' })).toBe(true);
  });

  it('rejects a bare Error-like object without a code', () => {
    expect(isProtocolError({ message: 'x' })).toBe(false);
    expect(isProtocolError(null)).toBe(false);
    expect(isProtocolError('boom')).toBe(false);
  });
});

describe('protocolErrorSchema', () => {
  it('accepts code + message + hint', () => {
    const parsed = schemas.protocolErrorSchema.parse({
      code: 'ELEMENT_NOT_FOUND',
      message: 'nope',
      hint: 'snapshot -i',
    });
    expect(parsed).toEqual({ code: 'ELEMENT_NOT_FOUND', message: 'nope', hint: 'snapshot -i' });
  });

  it('still accepts a bare message so a legacy producer is not dropped on the wire', () => {
    expect(schemas.protocolErrorSchema.parse({ message: 'nope' })).toEqual({ message: 'nope' });
  });

  it('round-trips every declared error code', () => {
    for (const code of ERROR_CODES) {
      expect(normalizeError({ code, message: 'x' }).code).toBe(code);
    }
  });
});

describe('socketTimeoutFor', () => {
  it('falls back to the default when the command has no timeout', () => {
    expect(socketTimeoutFor({ params: {} })).toBe(30_000);
    expect(socketTimeoutFor({})).toBe(30_000);
  });

  it('never goes below the default for short command timeouts', () => {
    expect(socketTimeoutFor({ params: { timeout: 1_000 } })).toBe(30_000);
  });

  it('outlives a long command timeout so the transport does not cut it short', () => {
    expect(socketTimeoutFor({ params: { timeout: 60_000 } })).toBe(65_000);
  });

  it('ignores a non-numeric timeout', () => {
    expect(socketTimeoutFor({ params: { timeout: 'soon' } })).toBe(30_000);
  });
});

describe('exitCodeFor', () => {
  it('gives each failure class its own exit code', () => {
    expect(exitCodeFor('INVALID_ARGS')).toBe(EXIT_INVALID_ARGS);
    expect(exitCodeFor('TIMEOUT')).toBe(EXIT_TIMEOUT);
    expect(exitCodeFor('EXTENSION_NOT_CONNECTED')).toBe(EXIT_NOT_CONNECTED);
    expect(exitCodeFor('CONTENT_SCRIPT_NOT_READY')).toBe(EXIT_NOT_CONNECTED);
  });

  it('maps every "target is missing" code onto the not-found class', () => {
    for (const code of ['ELEMENT_NOT_FOUND', 'STALE_REF', 'TAB_NOT_FOUND', 'SESSION_NOT_FOUND']) {
      expect(exitCodeFor(code)).toBe(EXIT_NOT_FOUND);
    }
  });

  it('falls back to the generic failure code for anything unclassified', () => {
    expect(exitCodeFor('UNKNOWN')).toBe(EXIT_FAILURE);
    expect(exitCodeFor('ELEMENT_OCCLUDED')).toBe(EXIT_FAILURE);
    expect(exitCodeFor('not-a-real-code')).toBe(EXIT_FAILURE);
    expect(exitCodeFor(undefined)).toBe(EXIT_FAILURE);
  });

  it('maps a failed assertion onto the generic failure code, not a target-missing code', () => {
    expect(exitCodeFor('ASSERTION_FAILED')).toBe(EXIT_FAILURE);
  });

  it('never returns the success code for an error', () => {
    for (const code of ERROR_CODES) {
      expect(exitCodeFor(code)).not.toBe(EXIT_OK);
    }
  });
});

describe('page stack passthrough', () => {
  it('carries a page-side stack onto the protocol error', () => {
    const err = new BrowserCliError('UNKNOWN', 'boom', undefined, 'Error: boom\n  at page:1:1');
    expect(err.toProtocolError().stack).toBe('Error: boom\n  at page:1:1');
  });

  it("keeps the stack distinct from the throwable's own stack", () => {
    const err = new BrowserCliError('UNKNOWN', 'boom');
    expect(err.stack).toBeDefined();
    expect(err.toProtocolError().stack).toBeUndefined();
  });

  it('survives normalizeError at a layer boundary', () => {
    expect(normalizeError({ code: 'UNKNOWN', message: 'boom', stack: 'at page:1:1' }).stack).toBe(
      'at page:1:1',
    );
  });

  it('validates on the wire', () => {
    expect(
      schemas.protocolErrorSchema.safeParse({ code: 'UNKNOWN', message: 'boom', stack: 'x' })
        .success,
    ).toBe(true);
  });
});
