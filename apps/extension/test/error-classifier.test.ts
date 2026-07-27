/**
 * Tests for error-classifier: classifyError maps raw browser errors
 * to structured ProtocolErrors with a code, a message and an actionable hint.
 */

import { describe, it, expect } from 'vitest';
import { BrowserCliError, protocolError } from '@browser-cli/shared';
import { classifyError } from '../src/lib/error-classifier';

// ─── Pattern matching ───────────────────────────────────────────────

describe('classifyError', () => {
  it('matches "Receiving end does not exist"', () => {
    const result = classifyError('Could not establish connection. Receiving end does not exist');
    expect(result.code).toBe('CONTENT_SCRIPT_NOT_READY');
    expect(result.message).toContain('no content script listening');
    expect(result.hint).toContain('tab list');
  });

  it('matches "No tab with id: 42"', () => {
    const result = classifyError('No tab with id: 42');
    expect(result.code).toBe('TAB_NOT_FOUND');
    expect(result.message).toContain('tab no longer exists');
    expect(result.hint).toContain('tab list');
  });

  it('matches "Cannot access a chrome:// URL"', () => {
    const result = classifyError('Cannot access a chrome:// URL');
    expect(result.code).toBe('UNSUPPORTED_PAGE');
    expect(result.message).toContain('privileged browser pages');
  });

  it('matches "Cannot access contents of url"', () => {
    const result = classifyError('Cannot access contents of url "https://example.com"');
    expect(result.code).toBe('UNSUPPORTED_PAGE');
    expect(result.message).toContain('Cannot access this page');
  });

  it('matches "No active tab found"', () => {
    const result = classifyError('No active tab found');
    expect(result.code).toBe('TAB_NOT_FOUND');
    expect(result.message).toContain('No active tab found');
    expect(result.hint).toContain('tab new');
  });

  it('matches "No window with id"', () => {
    const result = classifyError('No window with id: 7');
    expect(result.code).toBe('TAB_NOT_FOUND');
    expect(result.message).toContain('window no longer exists');
  });

  it('matches "Cannot find a next page in history"', () => {
    const result = classifyError('Cannot find a next page in history');
    expect(result.code).toBe('NAVIGATION_ERROR');
    expect(result.message).toContain('No page in browser history');
  });

  it('matches "Cannot find a previous page in history"', () => {
    const result = classifyError('Cannot find a previous page in history');
    expect(result.code).toBe('NAVIGATION_ERROR');
    expect(result.message).toContain('No page in browser history');
  });

  it('maps CSP eval failures to CSP_BLOCKED', () => {
    const result = classifyError("Refused to evaluate: CSP directive 'unsafe-eval'");
    expect(result.code).toBe('CSP_BLOCKED');
    expect(result.hint).toContain('snapshot');
  });

  // ─── Case insensitivity ────────────────────────────────────────────

  it('matches case-insensitively: "NO ACTIVE TAB FOUND"', () => {
    const result = classifyError('NO ACTIVE TAB FOUND');
    expect(result.message).toContain('No active tab found');
  });

  // ─── Fallback behavior ────────────────────────────────────────────

  it('returns raw message with UNKNOWN for unrecognized error string', () => {
    const result = classifyError('Something completely unexpected happened');
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('Something completely unexpected happened');
    expect(result.hint).toBeUndefined();
  });

  it('classifies timeouts as TIMEOUT while keeping the original message', () => {
    const result = classifyError('Timeout waiting for selector "#missing" after 5000ms');
    expect(result.code).toBe('TIMEOUT');
    expect(result.message).toContain('#missing');
    expect(result.hint).toContain('--timeout');
  });

  // ─── Pass-through of already-structured errors ────────────────────

  it('passes a BrowserCliError through with its code and hint intact', () => {
    const result = classifyError(
      new BrowserCliError('ELEMENT_OCCLUDED', 'covered by banner', 'dismiss it'),
    );
    expect(result).toEqual({
      code: 'ELEMENT_OCCLUDED',
      message: 'covered by banner',
      hint: 'dismiss it',
    });
  });

  it('passes a plain ProtocolError object through unchanged', () => {
    const original = protocolError('STALE_REF', 'ref is stale', 'snapshot again');
    expect(classifyError(original)).toEqual(original);
  });

  // ─── Input types ──────────────────────────────────────────────────

  it('extracts message from Error objects', () => {
    const result = classifyError(new Error('No active tab found'));
    expect(result.code).toBe('TAB_NOT_FOUND');
    expect(result.message).toContain('No active tab found');
  });

  it('converts non-Error non-string values via String()', () => {
    const result = classifyError(12345);
    expect(result.code).toBe('UNKNOWN');
    expect(result.message).toBe('12345');
  });

  // ─── Return structure ─────────────────────────────────────────────

  it('always returns a code and a message', () => {
    const result = classifyError('No active tab found');
    expect(typeof result.code).toBe('string');
    expect(typeof result.message).toBe('string');
  });
});
