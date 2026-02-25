/**
 * Tests for isValidState: validates that a raw value matches
 * the ConnectionState shape expected by state management.
 */

import { describe, it, expect } from 'vitest';
import { isValidState } from '../src/lib/state';

describe('isValidState', () => {
  // ─── Valid states ───────────────────────────────────────────────────

  it('accepts a valid full state with all fields', () => {
    expect(
      isValidState({
        enabled: true,
        connected: true,
        sessionId: 'abc-123',
        port: 9222,
        lastConnected: 1700000000000,
        lastDisconnected: 1699999999000,
        reconnecting: false,
        nextRetryIn: 5000,
      }),
    ).toBe(true);
  });

  it('accepts valid state with null optionals', () => {
    expect(
      isValidState({
        enabled: true,
        connected: false,
        sessionId: null,
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
      }),
    ).toBe(true);
  });

  it('accepts state with extra fields (no strict rejection)', () => {
    expect(
      isValidState({
        enabled: true,
        connected: true,
        sessionId: 'abc',
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
        extraField: 'ignored',
      }),
    ).toBe(true);
  });

  it('accepts state with enabled=false', () => {
    expect(
      isValidState({
        enabled: false,
        connected: false,
        sessionId: null,
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
      }),
    ).toBe(true);
  });

  // ─── Non-object inputs ─────────────────────────────────────────────

  it('rejects null', () => {
    expect(isValidState(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidState(undefined)).toBe(false);
  });

  it('rejects string', () => {
    expect(isValidState('hello')).toBe(false);
  });

  it('rejects number', () => {
    expect(isValidState(42)).toBe(false);
  });

  it('rejects array', () => {
    expect(isValidState([1, 2, 3])).toBe(false);
  });

  it('rejects empty object (missing required fields)', () => {
    expect(isValidState({})).toBe(false);
  });

  // ─── Wrong types ──────────────────────────────────────────────────

  it('rejects when enabled is missing', () => {
    expect(
      isValidState({
        connected: true,
        sessionId: null,
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
      }),
    ).toBe(false);
  });

  it('rejects when enabled is wrong type (string instead of boolean)', () => {
    expect(
      isValidState({
        enabled: 'yes',
        connected: true,
        sessionId: null,
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
      }),
    ).toBe(false);
  });

  it('rejects when connected is wrong type (string instead of boolean)', () => {
    expect(
      isValidState({
        enabled: true,
        connected: 'yes',
        sessionId: null,
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
      }),
    ).toBe(false);
  });

  it('rejects when port is wrong type (string instead of number)', () => {
    expect(
      isValidState({
        enabled: true,
        connected: true,
        sessionId: null,
        port: '9222',
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
      }),
    ).toBe(false);
  });

  it('rejects when sessionId is wrong type (number instead of string|null)', () => {
    expect(
      isValidState({
        enabled: true,
        connected: true,
        sessionId: 123,
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: false,
        nextRetryIn: null,
      }),
    ).toBe(false);
  });

  it('rejects when reconnecting is wrong type (string instead of boolean)', () => {
    expect(
      isValidState({
        enabled: true,
        connected: true,
        sessionId: null,
        port: 9222,
        lastConnected: null,
        lastDisconnected: null,
        reconnecting: 'false',
        nextRetryIn: null,
      }),
    ).toBe(false);
  });
});
