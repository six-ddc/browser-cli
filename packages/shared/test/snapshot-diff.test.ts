import { describe, it, expect } from 'vitest';
import { stripRefs, myersDiff, formatUnifiedDiff } from '../src/snapshot/diff.js';

// ─── stripRefs ─────────────────────────────────────────────────────

describe('stripRefs', () => {
  it('removes a single ref', () => {
    expect(stripRefs('button "Submit" [@e1]')).toBe('button "Submit"');
  });

  it('removes multiple refs across lines', () => {
    const input = 'button "OK" [@e1]\nlink "Home" [@e2]\nheading "Title"';
    const expected = 'button "OK"\nlink "Home"\nheading "Title"';
    expect(stripRefs(input)).toBe(expected);
  });

  it('returns text unchanged when no refs present', () => {
    const text = 'heading "Hello"\n  paragraph "World"';
    expect(stripRefs(text)).toBe(text);
  });

  it('handles large ref numbers', () => {
    expect(stripRefs('button "X" [@e9999]')).toBe('button "X"');
  });

  it('does not strip ref-like patterns without space prefix', () => {
    // Only ` [@eN]` with a leading space should be stripped
    expect(stripRefs('button[@e1]')).toBe('button[@e1]');
  });
});

// ─── myersDiff ─────────────────────────────────────────────────────

describe('myersDiff', () => {
  it('returns all equal for identical arrays', () => {
    const lines = ['a', 'b', 'c'];
    const ops = myersDiff(lines, lines);
    expect(ops).toHaveLength(3);
    expect(ops.every((op) => op.type === 'equal')).toBe(true);
  });

  it('detects insertion', () => {
    const a = ['a', 'c'];
    const b = ['a', 'b', 'c'];
    const ops = myersDiff(a, b);
    const inserts = ops.filter((op) => op.type === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.newIndex).toBe(1);
  });

  it('detects deletion', () => {
    const a = ['a', 'b', 'c'];
    const b = ['a', 'c'];
    const ops = myersDiff(a, b);
    const deletes = ops.filter((op) => op.type === 'delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.oldIndex).toBe(1);
  });

  it('detects modification (delete + insert)', () => {
    const a = ['a', 'old', 'c'];
    const b = ['a', 'new', 'c'];
    const ops = myersDiff(a, b);
    const deletes = ops.filter((op) => op.type === 'delete');
    const inserts = ops.filter((op) => op.type === 'insert');
    expect(deletes).toHaveLength(1);
    expect(inserts).toHaveLength(1);
  });

  it('handles empty arrays', () => {
    expect(myersDiff([], [])).toHaveLength(0);
  });

  it('handles empty old (all inserts)', () => {
    const ops = myersDiff([], ['a', 'b']);
    expect(ops).toHaveLength(2);
    expect(ops.every((op) => op.type === 'insert')).toBe(true);
  });

  it('handles empty new (all deletes)', () => {
    const ops = myersDiff(['a', 'b'], []);
    expect(ops).toHaveLength(2);
    expect(ops.every((op) => op.type === 'delete')).toBe(true);
  });
});

// ─── formatUnifiedDiff ─────────────────────────────────────────────

describe('formatUnifiedDiff', () => {
  it('returns empty diff for identical snapshots', () => {
    const lines = ['heading "Title"', '  button "OK"'];
    const result = formatUnifiedDiff({
      oldLabel: 'baseline.txt',
      oldLines: lines,
      newLines: lines,
      strippedNewLines: lines,
      refCount: 1,
    });
    expect(result.diff).toBe('');
    expect(result.summary).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it('includes header with labels', () => {
    const result = formatUnifiedDiff({
      oldLabel: '/tmp/baseline.txt',
      oldLines: ['a'],
      newLines: ['b'],
      strippedNewLines: ['b'],
      refCount: 0,
    });
    expect(result.diff).toContain('--- snapshot  /tmp/baseline.txt');
    expect(result.diff).toContain('+++ snapshot  (current)');
  });

  it('shows refs on + lines only', () => {
    const oldLines = ['heading "Title"', '  button "OK"'];
    const newLines = ['heading "Title"', '  button "OK" [@e1]', '  link "New" [@e2]'];
    const strippedNewLines = ['heading "Title"', '  button "OK"', '  link "New"'];
    const result = formatUnifiedDiff({
      oldLabel: 'baseline.txt',
      oldLines,
      newLines,
      strippedNewLines,
      refCount: 2,
    });
    // + lines should have refs
    const plusLines = result.diff
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'));
    expect(plusLines.some((l) => l.includes('[@e2]'))).toBe(true);
    // context lines should NOT have refs
    const contextLines = result.diff.split('\n').filter((l) => l.startsWith(' '));
    expect(contextLines.every((l) => !l.includes('[@e'))).toBe(true);
  });

  it('counts summary correctly', () => {
    const oldLines = ['a', 'b', 'c', 'd'];
    const newLines = ['a', 'B', 'e', 'd'];
    const result = formatUnifiedDiff({
      oldLabel: 'baseline.txt',
      oldLines,
      newLines,
      strippedNewLines: newLines,
      refCount: 0,
    });
    // b→B = changed, c→e could be changed, depends on diff
    // b deleted + B inserted = 1 changed, c deleted + e inserted = 1 changed
    expect(result.summary.changed).toBeGreaterThanOrEqual(1);
    expect(result.summary.added + result.summary.removed + result.summary.changed).toBeGreaterThan(
      0,
    );
  });

  it('produces valid unified diff format with @@ header', () => {
    const oldLines = ['a', 'b'];
    const newLines = ['a', 'c'];
    const result = formatUnifiedDiff({
      oldLabel: 'baseline.txt',
      oldLines,
      newLines,
      strippedNewLines: newLines,
      refCount: 0,
    });
    expect(result.diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
  });

  it('round-trips a realistic snapshot diff', () => {
    const oldSnapshot = [
      'navigation "Main"',
      '  link "Home" [@e1]',
      '  link "About" [@e2]',
      'main',
      '  heading "Welcome" (level=1)',
      '  button "Login" [@e3]',
    ].join('\n');

    const newSnapshot = [
      'navigation "Main"',
      '  link "Home" [@e1]',
      '  link "About" [@e2]',
      '  link "Blog" [@e3]',
      'main',
      '  heading "Welcome" (level=1)',
      '  paragraph "You are logged in"',
      '  button "Logout" [@e4]',
    ].join('\n');

    const oldLines = stripRefs(oldSnapshot).split('\n');
    const newLines = newSnapshot.split('\n');
    const strippedNewLines = stripRefs(newSnapshot).split('\n');

    const result = formatUnifiedDiff({
      oldLabel: 'baseline.txt',
      oldLines,
      newLines,
      strippedNewLines,
      refCount: 4,
    });

    expect(result.diff).toBeTruthy();
    // New interactive link "Blog" should appear with ref
    expect(result.diff).toContain('+  link "Blog" [@e3]');
    // Removed "Login" should appear as deletion (no ref)
    expect(result.diff).toContain('-  button "Login"');
    // New "Logout" should appear with ref
    expect(result.diff).toContain('+  button "Logout" [@e4]');
    expect(result.summary.added).toBeGreaterThan(0);
  });
});
