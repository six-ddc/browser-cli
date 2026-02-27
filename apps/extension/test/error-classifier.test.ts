/**
 * Tests for error-classifier: classifyError maps raw browser errors
 * to structured ProtocolErrors with actionable messages.
 */

import { describe, it, expect } from 'vitest';
import { classifyError } from '../src/lib/error-classifier';

// ─── Pattern matching ───────────────────────────────────────────────

describe('classifyError', () => {
  it('matches "Receiving end does not exist"', () => {
    const result = classifyError('Could not establish connection. Receiving end does not exist');
    expect(result.message).toContain('target tab is not reachable');
    expect(result.message).toContain('tabList');
  });

  it('matches "No tab with id: 42"', () => {
    const result = classifyError('No tab with id: 42');
    expect(result.message).toContain('tab no longer exists');
    expect(result.message).toContain('tabList');
  });

  it('matches "Cannot access a chrome:// URL"', () => {
    const result = classifyError('Cannot access a chrome:// URL');
    expect(result.message).toContain('privileged browser pages');
  });

  it('matches "Cannot access contents of url"', () => {
    const result = classifyError('Cannot access contents of url "https://example.com"');
    expect(result.message).toContain('Cannot access this page');
  });

  it('matches "No active tab found"', () => {
    const result = classifyError('No active tab found');
    expect(result.message).toContain('No active tab found');
    expect(result.message).toContain('tabNew');
  });

  it('matches "No window with id"', () => {
    const result = classifyError('No window with id: 7');
    expect(result.message).toContain('window no longer exists');
  });

  it('matches "Cannot find a next page in history"', () => {
    const result = classifyError('Cannot find a next page in history');
    expect(result.message).toContain('No page in browser history');
  });

  it('matches "Cannot find a previous page in history"', () => {
    const result = classifyError('Cannot find a previous page in history');
    expect(result.message).toContain('No page in browser history');
  });

  // ─── Case insensitivity ────────────────────────────────────────────

  it('matches case-insensitively: "NO ACTIVE TAB FOUND"', () => {
    const result = classifyError('NO ACTIVE TAB FOUND');
    expect(result.message).toContain('No active tab found');
  });

  // ─── Fallback behavior ────────────────────────────────────────────

  it('returns raw message for unrecognized error string', () => {
    const result = classifyError('Something completely unexpected happened');
    expect(result.message).toBe('Something completely unexpected happened');
  });

  // ─── Input types ──────────────────────────────────────────────────

  it('extracts message from Error objects', () => {
    const result = classifyError(new Error('No active tab found'));
    expect(result.message).toContain('No active tab found');
    expect(result.message).toContain('tabNew');
  });

  it('converts non-Error non-string values via String()', () => {
    const result = classifyError(12345);
    expect(result.message).toBe('12345');
  });

  // ─── Return structure ─────────────────────────────────────────────

  it('returns {message} for matched patterns', () => {
    const result = classifyError('No active tab found');
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
  });
});
