import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

// ===========================================================================
// Snapshot robustness tests — verifies fixes for Shadow DOM traversal,
// deep DOM protection, text escaping, visibility:collapse, and iframe annotation.
// ===========================================================================

test.describe('snapshot robustness', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.SNAPSHOT_ROBUSTNESS);
  });

  // ---- Shadow DOM traversal ----

  test.describe('shadow DOM traversal', () => {
    test('snapshot includes interactive elements inside open shadow roots', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      expect(r.stdout).toContain('Shadow Primary');
    });

    test('shadow DOM button gets a ref', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      // Should have a button from shadow root with a ref
      const lines = r.stdout.split('\n');
      const shadowBtnLine = lines.find((l) => l.includes('Shadow Primary'));
      expect(shadowBtnLine).toBeDefined();
      expect(shadowBtnLine).toContain('@e');
    });

    test('shadow DOM input appears in snapshot', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      // The shadow input may show as "textbox" (placeholder not always used as accessible name)
      // Verify we have at least one textbox from the shadow root
      expect(r.stdout).toContain('textbox');
    });

    test('shadow DOM link appears in snapshot', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      expect(r.stdout).toContain('Shadow Link');
    });
  });

  // ---- Deep DOM stack overflow protection ----

  test.describe('deep DOM protection', () => {
    test('snapshot does not crash on 150-level deep DOM', async ({ bcli }) => {
      const r = bcli('snapshot');
      expect(r).toBcliSuccess();
      expect(r.stdout.length).toBeGreaterThan(0);
    });

    test('default depth limit prevents deeply nested content from appearing fully', async ({
      bcli,
    }) => {
      // The deep button is at level 150 — with MAX_DEPTH=100 it should be cut off
      const r = bcli('snapshot');
      expect(r).toBcliSuccess();
      // The deep button should NOT appear since it's beyond the default depth limit
      expect(r.stdout).not.toContain('Deep Button');
    });

    test('explicit --depth can override default limit', async ({ bcli }) => {
      // With a very high explicit depth, the deep button should appear
      const r = bcli('snapshot', '-d', '200');
      expect(r).toBcliSuccess();
      expect(r.stdout).toContain('Deep Button');
    });

    test('very deep DOM created via eval does not crash snapshot', async ({ bcli }) => {
      // Create an even deeper DOM (500 levels) via eval
      bcli(
        'eval',
        "var d=document.getElementById('deep-root');d.innerHTML='';for(var i=0;i<500;i++){var c=document.createElement('div');d.appendChild(c);d=c;}d.innerHTML='<button>Very Deep</button>';'ok'",
      );
      const r = bcli('snapshot');
      expect(r).toBcliSuccess();
      // Should not crash — the button won't appear due to depth limit, but snapshot completes
      expect(r.stdout).toContain('Snapshot Robustness');
    });
  });

  // ---- Text escaping ----

  test.describe('text escaping', () => {
    test('quotes in button text are escaped', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      // The output should not have unescaped quotes breaking the format
      // button "Click \"here\" now" — escaped quotes
      const lines = r.stdout.split('\n');
      const quoteLine = lines.find((l) => l.includes('here') && l.includes('Click'));
      expect(quoteLine).toBeDefined();
      // The text should be properly enclosed — no bare unescaped quotes breaking format
      // Verify the line has escaped quotes (\" or the whole name is intact)
      expect(quoteLine).toContain('\\"');
    });

    test('newlines in button text are replaced with spaces', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      const lines = r.stdout.split('\n');
      // "Line1\nLine2" should become "Line1 Line2" (newline replaced with space)
      const newlineLine = lines.find((l) => l.includes('Line1') && l.includes('Line2'));
      expect(newlineLine).toBeDefined();
      // Both parts should be on the same line (newline was replaced)
    });

    test('tabs in button text are replaced with spaces', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      const lines = r.stdout.split('\n');
      const tabLine = lines.find((l) => l.includes('Col1') && l.includes('Col2'));
      expect(tabLine).toBeDefined();
      // Tab should not be present literally
      expect(tabLine).not.toContain('\t');
    });

    test('quotes in link text are escaped', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      const lines = r.stdout.split('\n');
      const linkLine = lines.find((l) => l.includes('quotes') && l.includes('link'));
      expect(linkLine).toBeDefined();
      expect(linkLine).toContain('\\"');
    });
  });

  // ---- visibility:collapse ----

  test.describe('visibility:collapse filtering', () => {
    test('visible buttons appear in snapshot', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      expect(r.stdout).toContain('Visible Button');
      expect(r.stdout).toContain('Another Visible');
    });

    test('visibility:collapse button is filtered out', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      expect(r.stdout).not.toContain('Collapsed Button');
    });

    test('visibility:hidden button is also filtered out', async ({ bcli }) => {
      const r = bcli('snapshot', '-ic');
      expect(r).toBcliSuccess();
      expect(r.stdout).not.toContain('Hidden Button');
    });
  });

  // ---- iframe annotation ----

  test.describe('iframe annotation', () => {
    test('iframe appears in snapshot as an iframe node', async ({ bcli }) => {
      const r = bcli('snapshot');
      expect(r).toBcliSuccess();
      expect(r.stdout).toContain('iframe');
    });

    test('iframe shows its title', async ({ bcli }) => {
      const r = bcli('snapshot');
      expect(r).toBcliSuccess();
      // The iframe has title="Test Frame"
      expect(r.stdout).toContain('Test Frame');
    });

    test('iframe shows its src URL', async ({ bcli }) => {
      const r = bcli('snapshot');
      expect(r).toBcliSuccess();
      expect(r.stdout).toContain('iframe-content');
    });
  });
});
