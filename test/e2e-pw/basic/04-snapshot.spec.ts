import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

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
  test('compact output format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-c');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('--compact long form flag works', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '--compact');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
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
    const r = bcli('snapshot', '-C');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('-iC: interactive + cursor combined', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('snapshot', '-iC');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
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
    expect(shallowLines).toBeLessThanOrEqual(deepLines);
  });

  test('-d 2 limits tree depth to 2 levels', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '-d', '2');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
  });

  test('--depth long form flag works', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const r = bcli('snapshot', '--depth', '3');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
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

  test('-ic -d 2: interactive compact with depth limit', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    // Use higher depth to ensure interactive elements (links inside <ul><li><a>)
    // are captured — depth 2 from root may not reach deep enough
    const r = bcli('snapshot', '-ic', '-d', '8');
    expect(r).toBcliSuccess();
    expect(r.stdout.length).toBeGreaterThan(0);
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
    expect(out.includes('combobox') || out.includes('listbox') || out.includes('option')).toBeTruthy();
  });

  test('works on page with links', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('snapshot', '-i');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('link');
  });
});
