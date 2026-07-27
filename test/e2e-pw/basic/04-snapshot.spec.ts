import { test, expect } from '../fixtures';
import { PAGES, SEL, TEST_PASSWORD } from '../helpers/constants';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test.describe('basic snapshot', () => {
  test('default snapshot returns accessibility tree', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('The Internet');
  });

  test('outputs interactive element count', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    // Verify output contains recognizable page elements (textbox for login form inputs)
    expect(r.stdout).toContain('textbox');
  });

  test('body text appears as StaticText nodes', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    // The login page subheader is plain body copy, not an accessible name
    expect(r.stdout).toContain('text "');
    expect(r.stdout).toContain('This is where you can log into the secure area');
  });

  test('text duplicated by a parent accessible name is not repeated', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    // "Login" is the button's accessible name — it must not also appear as a text node
    expect(r.stdout).not.toContain('text "Login"');
  });

  test('password field values are redacted', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    expect(bcli('fill', SEL.PASSWORD, TEST_PASSWORD)).toBcliSuccess();

    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('value=<redacted>');
    // The page prints the credentials as body copy, so only the field's own
    // value attribute must be free of the secret.
    expect(r.stdout).not.toContain(`value="${TEST_PASSWORD}"`);
  });
});

test.describe('--max-chars', () => {
  test('caps output and appends a narrowing hint', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('snapshot', '--max-chars', '500');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('[truncated: showing ');
    expect(r.stdout).toContain('--max-chars <n>');
    expect(r.stdout.length).toBeLessThan(1000);
  });

  test('full output is returned when it fits', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '--max-chars', '100000');
    expect(r).toBcliSuccess();
    expect(r.stdout).not.toContain('[truncated');
  });
});

test.describe('-d 0', () => {
  test('yields the page node only', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-d', '0');
    expect(r).toBcliSuccess();
    expect(r.stdout.trim().split('\n')).toHaveLength(1);
    expect(r.stdout.trim()).toMatch(/^page /);
  });
});

test.describe('iframe annotation', () => {
  test('iframe nodes carry a frame hint', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('iframe');
    expect(r.stdout).toContain('[use: frame ');
  });
});

test.describe('--base with --save', () => {
  test('diffs against the baseline and refreshes it in one call', async ({
    bcli,
    navigateAndWait,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'bcli-e2e-snap-'));
    const baseline = join(dir, 'baseline.txt');
    try {
      await navigateAndWait(PAGES.ADD_REMOVE);
      expect(bcli('snapshot', '-ic', '--save', baseline)).toBcliSuccess();
      const before = readFileSync(baseline, 'utf-8');

      expect(bcli('click', 'text=Add Element')).toBcliSuccess();

      const diff = bcli('snapshot', '-ic', '--base', baseline, '--save', baseline);
      expect(diff).toBcliSuccess();
      expect(diff.stdout).toContain('+');

      const after = readFileSync(baseline, 'utf-8');
      expect(after).not.toBe(before);

      // Baseline is current now, so a follow-up diff sees no changes
      const clean = bcli('snapshot', '-ic', '--base', baseline);
      expect(clean).toBcliSuccess();
      expect(clean.stdout.trim()).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('--save writes a file under --json', async ({ bcli, navigateAndWait }) => {
    const dir = mkdtempSync(join(tmpdir(), 'bcli-e2e-snap-json-'));
    const out = join(dir, 'snap.txt');
    try {
      await navigateAndWait(PAGES.LOGIN);
      const r = bcli('--json', 'snapshot', '-ic', '--save', out);
      expect(r).toBcliSuccess();

      const json = JSON.parse(r.stdout);
      expect(json.success).toBe(true);
      expect(json.data.saved).toBe(out);
      expect(readFileSync(out, 'utf-8')).toContain('textbox');
      // Baseline has refs stripped
      expect(readFileSync(out, 'utf-8')).not.toContain('@e');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test.describe('-i / --interactive flag', () => {
  test('shows only interactive elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const interactive = bcli('snapshot', '-i');
    expect(interactive).toBcliSuccess();
    expect(interactive.stdout).toContain('textbox');

    const full = bcli('snapshot');
    expect(full).toBcliSuccess();

    const interactiveLines = interactive.stdout.split('\n').length;
    const fullLines = full.stdout.split('\n').length;
    expect(interactiveLines).toBeLessThan(fullLines);
  });

  test('--interactive long form flag works', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '--interactive');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('textbox');
  });
});

test.describe('-c / --compact flag', () => {
  test('compact output is shorter than full output', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const compact = bcli('snapshot', '-c');
    expect(compact).toBcliSuccess();

    const full = bcli('snapshot');
    expect(full).toBcliSuccess();

    // Compact output should be strictly shorter than the full accessibility tree
    expect(compact.stdout.length).toBeLessThan(full.stdout.length);
  });

  test('--compact long form flag works', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const compact = bcli('snapshot', '--compact');
    expect(compact).toBcliSuccess();

    const full = bcli('snapshot');
    expect(full).toBcliSuccess();

    expect(compact.stdout.length).toBeLessThan(full.stdout.length);
  });
});

test.describe('-ic (interactive + compact combined)', () => {
  test('shows @e refs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('@e');
  });

  test('contains form elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('textbox');
  });

  test('refs are numbered sequentially', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('@e1');
  });
});

test.describe('-C / --cursor flag', () => {
  test('includes cursor-interactive elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const withCursor = bcli('snapshot', '-C');
    expect(withCursor).toBcliSuccess();
    // Cursor flag should include elements with cursor:pointer — verify it contains link elements
    expect(withCursor.stdout).toContain('link');
  });

  test('-iC shows at least as many elements as -i alone', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const interactive = bcli('snapshot', '-i');
    expect(interactive).toBcliSuccess();

    const interactiveCursor = bcli('snapshot', '-iC');
    expect(interactiveCursor).toBcliSuccess();

    // -iC includes cursor-interactive elements on top of regular interactive ones
    const iLines = interactive.stdout.split('\n').length;
    const iCLines = interactiveCursor.stdout.split('\n').length;
    expect(iCLines).toBeGreaterThanOrEqual(iLines);
  });
});

test.describe('-d / --depth flag', () => {
  test('-d 1 limits tree depth to 1 level', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const shallow = bcli('snapshot', '-d', '1');
    expect(shallow).toBcliSuccess();

    const deep = bcli('snapshot', '-d', '5');
    expect(deep).toBcliSuccess();

    const shallowLines = shallow.stdout.split('\n').length;
    const deepLines = deep.stdout.split('\n').length;
    expect(shallowLines).toBeLessThan(deepLines);
  });

  test('-d 2 produces fewer lines than unlimited depth', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const limited = bcli('snapshot', '-d', '2');
    expect(limited).toBcliSuccess();

    const full = bcli('snapshot');
    expect(full).toBcliSuccess();

    expect(limited.stdout.split('\n').length).toBeLessThan(full.stdout.split('\n').length);
  });

  test('--depth long form flag works', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const limited = bcli('snapshot', '--depth', '3');
    expect(limited).toBcliSuccess();

    const full = bcli('snapshot');
    expect(full).toBcliSuccess();

    expect(limited.stdout.split('\n').length).toBeLessThan(full.stdout.split('\n').length);
  });
});

test.describe('-s / --selector flag', () => {
  test('scopes to specific element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-s', 'form');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('textbox');
  });

  test('scoped snapshot is smaller than full', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const scoped = bcli('snapshot', '-s', 'form');
    expect(scoped).toBcliSuccess();

    const full = bcli('snapshot');
    expect(full).toBcliSuccess();

    expect(scoped.stdout.length).toBeLessThan(full.stdout.length);
  });

  test('--selector long form flag works', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '--selector', 'form');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('textbox');
  });
});

test.describe('combined flags', () => {
  test('-ic -s: interactive compact scoped to element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-ic', '-s', 'form');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('@e');
    expect(r.stdout).toContain('textbox');
  });

  test('-ic -d 8: interactive compact with depth limit', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    // Use higher depth to ensure interactive elements (links inside <ul><li><a>)
    // are captured — depth 2 from root may not reach deep enough
    const r = bcli('snapshot', '-ic', '-d', '8');
    expect(r).toBcliSuccess();
    // Should contain element refs since -ic is used
    expect(r.stdout).toContain('@e');
  });

  test('all flags combined: -i -c -C -d 3 -s form', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-i', '-c', '-C', '-d', '3', '-s', 'form');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('@e');
    // Scoped to form, so should contain form elements
    expect(r.stdout).toContain('textbox');
  });
});

test.describe('element refs used in subsequent commands', () => {
  test('snapshot -ic then click @e1', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    bcli('snapshot', '-ic');
    const r = bcli('click', '@e1');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Clicked');
  });

  test('snapshot -ic then fill @e ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('snapshot', '-ic');
    const r = bcli('fill', '@e2', 'refvalue');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Filled');
  });

  test('snapshot -ic then get text via @e ref', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('snapshot', '-ic');
    const r = bcli('get', 'text', '@e1');
    expect(r).toBcliSuccess();
  });
});

test.describe('snapshot on different page types', () => {
  test('works on page with checkboxes', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);
    const r = bcli('snapshot');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('checkbox');
  });

  test('works on page with dropdown', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DROPDOWN);
    const r = bcli('snapshot', '-i');
    expect(r).toBcliSuccess();
    const out = r.stdout;
    expect(
      out.includes('combobox') || out.includes('listbox') || out.includes('option'),
    ).toBeTruthy();
  });

  test('works on page with links', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('snapshot', '-i');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('link');
  });
});
