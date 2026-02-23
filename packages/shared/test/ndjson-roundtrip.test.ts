import { describe, it, expect } from 'vitest';
import { daemonRequestSchema, daemonResponseSchema } from '../src/protocol/schemas.js';

describe('NDJSON roundtrip - DaemonRequest', () => {
  it('navigate command survives roundtrip', () => {
    const original = {
      id: 'req-1',
      command: { action: 'navigate' as const, params: { url: 'https://example.com' } },
    };
    const roundtripped = daemonRequestSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });

  it('click with tabId survives roundtrip', () => {
    const original = {
      id: 'req-2',
      command: { action: 'click' as const, params: { selector: '#btn' } },
      tabId: 42,
    };
    const roundtripped = daemonRequestSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });

  it('snapshot with options survives roundtrip', () => {
    const original = {
      id: 'req-3',
      command: {
        action: 'snapshot' as const,
        params: { interactive: true, compact: true, depth: 3, selector: '.main' },
      },
    };
    const roundtripped = daemonRequestSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });
});

describe('NDJSON roundtrip - DaemonResponse', () => {
  it('success with data survives roundtrip', () => {
    const original = {
      id: 'res-1',
      success: true,
      data: { url: 'https://example.com', title: 'Example' },
    };
    const roundtripped = daemonResponseSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });

  it('error with code, message, and hint survives roundtrip', () => {
    const original = {
      id: 'res-2',
      success: false,
      error: {
        code: 'ELEMENT_NOT_FOUND',
        message: 'Element not found',
        hint: 'Check the selector is correct',
      },
    };
    const roundtripped = daemonResponseSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });

  it('error with details survives roundtrip', () => {
    const original = {
      id: 'res-3',
      success: false,
      error: {
        code: 'TIMEOUT',
        message: 'Timed out',
        details: { elapsed: 30000, action: 'click' },
      },
    };
    const roundtripped = daemonResponseSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });

  it('complex nested data survives roundtrip', () => {
    const original = {
      id: 'res-4',
      success: true,
      data: {
        tabs: [
          { id: 1, url: 'https://a.com', title: 'A', active: true },
          { id: 2, url: 'https://b.com', title: 'B', active: false },
        ],
      },
    };
    const roundtripped = daemonResponseSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });

  it('empty data fields survive roundtrip', () => {
    const original = {
      id: 'res-5',
      success: true,
      data: {},
    };
    const roundtripped = daemonResponseSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundtripped).toEqual(original);
  });
});
