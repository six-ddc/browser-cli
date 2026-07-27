/**
 * Tests for the snapshot DOM walk: StaticText extraction, widget state
 * reporting, password redaction, depth limits and iframe annotation.
 *
 * jsdom has no layout engine, so getBoundingClientRect() is all zeros and no
 * @eN refs are assigned — these tests exercise structure and state only.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleSnapshot } from '../src/content-lib/snapshot';

beforeEach(() => {
  document.body.innerHTML = '';
});

async function snap(params: Parameters<typeof handleSnapshot>[0] = {}) {
  const { snapshot } = await handleSnapshot(params);
  return snapshot;
}

describe('StaticText nodes', () => {
  it('emits body copy as text nodes', async () => {
    document.body.innerHTML = '<p>Hello world</p>';
    expect(await snap()).toContain('text "Hello world"');
  });

  it('collapses whitespace in text nodes', async () => {
    document.body.innerHTML = '<p>Hello\n\n   world</p>';
    expect(await snap()).toContain('text "Hello world"');
  });

  it('skips text identical to the parent accessible name', async () => {
    document.body.innerHTML = '<button>Submit</button>';
    const out = await snap();
    expect(out).toContain('"Submit"');
    expect(out).not.toContain('text "Submit"');
  });

  it('emits text alongside sibling elements', async () => {
    document.body.innerHTML = '<div>Intro copy<span>tail</span></div>';
    const out = await snap();
    expect(out).toContain('text "Intro copy"');
    expect(out).toContain('text "tail"');
  });

  it('skips text already covered by a content-derived parent name', async () => {
    document.body.innerHTML = '<h4>Enter <em>tomsmith</em> to log in</h4>';
    const out = await snap();
    expect(out).toContain('heading "Enter tomsmith to log in"');
    expect(out).not.toContain('text "');
  });

  it('keeps text that the parent name does not cover', async () => {
    document.body.innerHTML = '<div aria-label="Section">Body copy here</div>';
    expect(await snap()).toContain('text "Body copy here"');
  });

  it('drops elements left empty once their text moved to an ancestor name', async () => {
    document.body.innerHTML = '<h4>Enter <em>tomsmith</em> to log in</h4>';
    expect(await snap()).not.toContain('emphasis');
  });

  it('omits text nodes in interactive mode', async () => {
    document.body.innerHTML = '<p>Body copy</p><button>Go</button>';
    expect(await snap({ interactive: true })).not.toContain('text "Body copy"');
  });
});

describe('widget state', () => {
  it('reports disabled on button, select and fieldset', async () => {
    document.body.innerHTML =
      '<button disabled>B</button><select disabled aria-label="S"></select><fieldset disabled aria-label="F"></fieldset>';
    const out = await snap();
    expect(out.match(/disabled/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('reports aria-disabled on a custom widget', async () => {
    document.body.innerHTML = '<div role="button" aria-disabled="true">Go</div>';
    expect(await snap()).toContain('(disabled)');
  });

  it('reports aria-checked on a custom checkbox', async () => {
    document.body.innerHTML = '<div role="checkbox" aria-checked="mixed">Pick</div>';
    expect(await snap()).toContain('checked=mixed');
  });

  it('reports indeterminate native checkboxes as mixed', async () => {
    document.body.innerHTML = '<input type="checkbox" aria-label="Pick" />';
    (document.querySelector('input') as HTMLInputElement).indeterminate = true;
    expect(await snap()).toContain('checked=mixed');
  });

  it('reports aria-expanded on a non-details element', async () => {
    document.body.innerHTML = '<button aria-expanded="true">Menu</button>';
    expect(await snap()).toContain('expanded=true');
  });

  it('reports aria-selected and native option selection', async () => {
    document.body.innerHTML =
      '<div role="tab" aria-selected="true">Tab</div><select><option>One</option></select>';
    const out = await snap();
    expect(out.match(/selected/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('reports the current value of a select', async () => {
    document.body.innerHTML = '<select><option>One</option><option>Two</option></select>';
    (document.querySelector('select') as HTMLSelectElement).value = 'Two';
    expect(await snap()).toContain('value="Two"');
  });

  it('omits the fixed value of checkboxes and push buttons', async () => {
    document.body.innerHTML =
      '<input type="checkbox" aria-label="Pick" /><input type="submit" value="Login" />';
    const out = await snap();
    expect(out).not.toContain('value="on"');
    expect(out).not.toContain('value="Login"');
  });

  it('reports readonly inputs', async () => {
    document.body.innerHTML = '<input readonly aria-label="Code" value="x" />';
    expect(await snap()).toContain('readonly');
  });

  it('reports aria-required', async () => {
    document.body.innerHTML = '<div role="textbox" aria-required="true" aria-label="Name"></div>';
    expect(await snap()).toContain('required');
  });

  it('reports the focused element', async () => {
    document.body.innerHTML = '<input id="a" aria-label="A" /><input id="b" aria-label="B" />';
    (document.getElementById('b') as HTMLInputElement).focus();
    const lines = (await snap()).split('\n').filter((l) => l.includes('focused'));
    expect(lines).toHaveLength(1);
  });
});

describe('password redaction', () => {
  it('redacts type=password values', async () => {
    document.body.innerHTML = '<input type="password" aria-label="Password" value="hunter2" />';
    const out = await snap();
    expect(out).toContain('value=<redacted>');
    expect(out).not.toContain('hunter2');
  });

  it('redacts fields marked with a password autocomplete hint', async () => {
    document.body.innerHTML =
      '<input type="text" aria-label="Password" autocomplete="current-password" value="s3cret" />';
    const out = await snap();
    expect(out).toContain('value=<redacted>');
    expect(out).not.toContain('s3cret');
  });

  it('leaves ordinary text values alone', async () => {
    document.body.innerHTML = '<input type="text" aria-label="Username" value="tomsmith" />';
    expect(await snap()).toContain('value="tomsmith"');
  });
});

describe('depth limit', () => {
  it('-d 0 yields the page node only', async () => {
    document.body.innerHTML = '<div><p>Deep</p></div>';
    const out = await snap({ depth: 0 });
    expect(out.split('\n')).toHaveLength(1);
    expect(out).toMatch(/^page/);
  });

  it('-d 1 keeps only the first level below the page', async () => {
    document.body.innerHTML = '<div><p>Deep</p></div>';
    const out = await snap({ depth: 1 });
    expect(out).not.toContain('text "Deep"');
    expect(out.split('\n').length).toBeGreaterThan(1);
  });

  it('unlimited depth reaches nested content', async () => {
    document.body.innerHTML = '<div><section><p>Deep</p></section></div>';
    expect(await snap()).toContain('text "Deep"');
  });
});

describe('iframe annotation', () => {
  it('emits a frame hint instead of traversing iframe content', async () => {
    document.body.innerHTML = '<iframe id="pay" title="Payment" src="https://x.test/f"></iframe>';
    const out = await snap();
    expect(out).toContain('iframe "Payment"');
    expect(out).toContain('[use: frame ');
  });
});

describe('output cap', () => {
  it('truncates past maxChars with a narrowing hint', async () => {
    document.body.innerHTML = Array.from({ length: 200 }, (_, i) => `<p>row ${i}</p>`).join('');
    const out = await snap({ maxChars: 200 });
    expect(out).toContain('[truncated: showing ');
    expect(out).toContain('--max-chars <n>');
  });
});
