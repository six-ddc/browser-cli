import { describe, it, expect } from 'vitest';
import { greet } from '@browser-cli/shared';

describe('hello command', () => {
  it('greets with the provided name', () => {
    expect(greet('Alice')).toBe('Hello, Alice! Welcome to Browser-CLI.');
  });

  it('greets with default name', () => {
    expect(greet('World')).toBe('Hello, World! Welcome to Browser-CLI.');
  });
});
