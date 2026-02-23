/**
 * Tests for error-classifier: classifyError maps raw browser errors
 * to structured ProtocolErrors with codes and hints.
 */

import { describe, it, expect } from 'vitest';
import { classifyError } from '../src/lib/error-classifier';
import { ErrorCode } from '@browser-cli/shared';

// ─── Pattern matching ───────────────────────────────────────────────

describe('classifyError', () => {
  it('matches "Receiving end does not exist" → CONTENT_SCRIPT_NOT_READY', () => {
    const result = classifyError(
      'Could not establish connection. Receiving end does not exist',
    );
    expect(result.code).toBe(ErrorCode.CONTENT_SCRIPT_NOT_READY);
    expect(result.hint).toBeDefined();
  });

  it('matches "No tab with id: 42" → TAB_NOT_FOUND', () => {
    const result = classifyError('No tab with id: 42');
    expect(result.code).toBe(ErrorCode.TAB_NOT_FOUND);
    expect(result.hint).toBeDefined();
  });

  it('matches "Cannot access a chrome:// URL" → CONTENT_SCRIPT_NOT_READY', () => {
    const result = classifyError('Cannot access a chrome:// URL');
    expect(result.code).toBe(ErrorCode.CONTENT_SCRIPT_NOT_READY);
  });

  it('matches "Cannot access contents of url" → CONTENT_SCRIPT_NOT_READY', () => {
    const result = classifyError('Cannot access contents of url "https://example.com"');
    expect(result.code).toBe(ErrorCode.CONTENT_SCRIPT_NOT_READY);
  });

  it('matches "No active tab found" → NO_ACTIVE_TAB', () => {
    const result = classifyError('No active tab found');
    expect(result.code).toBe(ErrorCode.NO_ACTIVE_TAB);
    expect(result.hint).toContain('tabNew');
  });

  it('matches "No window with id" → TAB_NOT_FOUND', () => {
    const result = classifyError('No window with id: 7');
    expect(result.code).toBe(ErrorCode.TAB_NOT_FOUND);
  });

  it('matches "Cannot find a next page in history" → NAVIGATION_FAILED', () => {
    const result = classifyError('Cannot find a next page in history');
    expect(result.code).toBe(ErrorCode.NAVIGATION_FAILED);
  });

  it('matches "Cannot find a previous page in history" → NAVIGATION_FAILED', () => {
    const result = classifyError('Cannot find a previous page in history');
    expect(result.code).toBe(ErrorCode.NAVIGATION_FAILED);
  });

  // ─── Case insensitivity ────────────────────────────────────────────

  it('matches case-insensitively: "NO ACTIVE TAB FOUND"', () => {
    const result = classifyError('NO ACTIVE TAB FOUND');
    expect(result.code).toBe(ErrorCode.NO_ACTIVE_TAB);
  });

  // ─── Fallback behavior ────────────────────────────────────────────

  it('returns UNKNOWN with raw message for unrecognized error string', () => {
    const result = classifyError('Something completely unexpected happened');
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.message).toBe('Something completely unexpected happened');
  });

  it('uses custom fallback code when provided', () => {
    const result = classifyError('Unrecognized error', ErrorCode.CONTENT_SCRIPT_ERROR);
    expect(result.code).toBe(ErrorCode.CONTENT_SCRIPT_ERROR);
    expect(result.message).toBe('Unrecognized error');
  });

  it('does not include hint in fallback errors', () => {
    const result = classifyError('Some random error');
    expect(result.hint).toBeUndefined();
  });

  // ─── Input types ──────────────────────────────────────────────────

  it('extracts message from Error objects', () => {
    const result = classifyError(new Error('No active tab found'));
    expect(result.code).toBe(ErrorCode.NO_ACTIVE_TAB);
  });

  it('converts non-Error non-string values via String()', () => {
    const result = classifyError(12345);
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.message).toBe('12345');
  });

  // ─── Return structure ─────────────────────────────────────────────

  it('returns {code, message, hint} for matched patterns', () => {
    const result = classifyError('No active tab found');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('hint');
    expect(typeof result.code).toBe('string');
    expect(typeof result.message).toBe('string');
    expect(typeof result.hint).toBe('string');
  });
});
