/**
 * Tests for snapshot serialization: state attributes, value safety,
 * total-output truncation, and semantic compaction.
 */

import { describe, it, expect } from 'vitest';
import {
  serializeSnapshot,
  compactSnapshotTree,
  REDACTED_VALUE,
  TEXT_ROLE,
  type SnapshotNode,
} from '../src/snapshot/types.js';

function node(partial: Partial<SnapshotNode> & { role: string }): SnapshotNode {
  return { name: '', children: [], ...partial };
}

describe('serializeSnapshot — state attributes', () => {
  it('renders disabled, readonly and required as bare flags', () => {
    const out = serializeSnapshot([
      node({ role: 'textbox', name: 'Email', disabled: true, readonly: true, required: true }),
    ]);
    expect(out).toBe('textbox "Email" (disabled, readonly, required)');
  });

  it('renders checked=false and checked=mixed', () => {
    expect(serializeSnapshot([node({ role: 'checkbox', checked: false })])).toBe(
      'checkbox (checked=false)',
    );
    expect(serializeSnapshot([node({ role: 'checkbox', checked: 'mixed' })])).toBe(
      'checkbox (checked=mixed)',
    );
  });

  it('renders selected and focused only when true', () => {
    expect(serializeSnapshot([node({ role: 'option', name: 'A', selected: true })])).toBe(
      'option "A" (selected)',
    );
    expect(serializeSnapshot([node({ role: 'option', name: 'A', selected: false })])).toBe(
      'option "A"',
    );
    expect(serializeSnapshot([node({ role: 'textbox', focused: true })])).toBe('textbox (focused)');
  });

  it('renders expanded=false', () => {
    expect(serializeSnapshot([node({ role: 'button', name: 'Menu', expanded: false })])).toBe(
      'button "Menu" (expanded=false)',
    );
  });
});

describe('serializeSnapshot — value safety', () => {
  it('renders a redacted password value without quotes', () => {
    const out = serializeSnapshot([
      node({ role: 'textbox', name: 'Password', value: REDACTED_VALUE }),
    ]);
    expect(out).toBe('textbox "Password" (value=<redacted>)');
  });

  it('truncates a long value to 200 characters', () => {
    const out = serializeSnapshot([node({ role: 'textbox', value: 'x'.repeat(500) })]);
    const value = /value="([^"]*)"/.exec(out)?.[1] ?? '';
    expect(value).toBe('x'.repeat(200) + '…');
  });

  it('escapes quotes, backslashes and newlines in values', () => {
    const out = serializeSnapshot([node({ role: 'textbox', value: 'a"b\\c\nd\te' })]);
    expect(out).toBe('textbox (value="a\\"b\\\\c d e")');
  });
});

describe('serializeSnapshot — StaticText', () => {
  it('renders body copy from the text field', () => {
    const out = serializeSnapshot([
      node({ role: 'paragraph', children: [node({ role: TEXT_ROLE, text: 'Hello world' })] }),
    ]);
    expect(out).toBe('paragraph\n    text "Hello world"');
  });

  it('truncates text at 200 characters', () => {
    const out = serializeSnapshot([node({ role: TEXT_ROLE, text: 'y'.repeat(400) })]);
    expect(out).toBe(`text "${'y'.repeat(200)}…"`);
  });
});

describe('serializeSnapshot — iframe and shadow markers', () => {
  it('appends a frame hint to iframe nodes', () => {
    const out = serializeSnapshot([
      node({ role: 'iframe', name: 'Payment', frameHint: '#pay-frame' }),
    ]);
    expect(out).toBe('iframe "Payment" [use: frame #pay-frame]');
  });

  it('marks shadow subtree roots', () => {
    const out = serializeSnapshot([node({ role: 'button', name: 'Go', ref: '@e1', shadow: true })]);
    expect(out).toBe('button "Go" [@e1] #shadow');
  });
});

describe('serializeSnapshot — total output cap', () => {
  const many = Array.from({ length: 100 }, (_, i) => node({ role: 'link', name: `link-${i}` }));

  it('truncates on line boundaries and appends a narrowing hint', () => {
    const out = serializeSnapshot(many, { maxChars: 100 });
    const lines = out.split('\n');
    const hint = lines[lines.length - 1];
    expect(hint).toMatch(/^\[truncated: showing \d+ of 100 lines\./);
    expect(hint).toContain('-i / -s <selector> / -d <depth> / --max-chars <n>');
    // Every retained line is a whole line from the input
    for (const line of lines.slice(0, -1)) {
      expect(line).toMatch(/^link "link-\d+"$/);
    }
  });

  it('does not truncate when the output fits', () => {
    const out = serializeSnapshot(many, { maxChars: 100000 });
    expect(out).not.toContain('[truncated');
    expect(out.split('\n')).toHaveLength(100);
  });

  it('always keeps at least one line', () => {
    const out = serializeSnapshot(many, { maxChars: 1 });
    expect(out.split('\n')[0]).toBe('link "link-0"');
  });
});

describe('compactSnapshotTree', () => {
  it('drops generic nodes with no name, ref or state and lifts their children', () => {
    const tree = [
      node({
        role: 'generic',
        children: [
          node({ role: 'generic', children: [node({ role: 'button', name: 'Save', ref: '@e1' })] }),
        ],
      }),
    ];
    expect(compactSnapshotTree(tree)).toEqual([node({ role: 'button', name: 'Save', ref: '@e1' })]);
  });

  it('keeps generic nodes that carry a name, ref or state', () => {
    const tree = [
      node({ role: 'generic', name: 'Sidebar', children: [] }),
      node({ role: 'generic', ref: '@e2', children: [] }),
      node({ role: 'generic', focused: true, children: [] }),
      node({ role: 'generic', children: [node({ role: TEXT_ROLE, text: 'kept' })] }),
    ];
    const out = compactSnapshotTree(tree);
    expect(out.map((n) => n.role)).toEqual(['generic', 'generic', 'generic', TEXT_ROLE]);
  });

  it('drops presentation and none roles', () => {
    const tree = [node({ role: 'presentation', children: [node({ role: 'none', children: [] })] })];
    expect(compactSnapshotTree(tree)).toEqual([]);
  });

  it('compact serialization uses 2-space indent and drops structure nodes', () => {
    const tree = [
      node({
        role: 'page',
        name: 'Title',
        children: [
          node({ role: 'generic', children: [node({ role: 'button', name: 'Save', ref: '@e1' })] }),
        ],
      }),
    ];
    expect(serializeSnapshot(tree, { compact: true })).toBe('page "Title"\n  button "Save" [@e1]');
    expect(serializeSnapshot(tree)).toBe('page "Title"\n    generic\n        button "Save" [@e1]');
  });
});
