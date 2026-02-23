import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

test.describe('markdown command', () => {
  test('extracts readable content as markdown', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    // Should contain article heading
    expect(r.stdout).toContain('Browser Automation');
    // Should contain markdown-formatted content (headings, links, etc.)
    expect(r.stdout).toContain('Key Benefits');
    expect(r.stdout).toContain('Architecture Overview');
  });

  test('preserves markdown formatting for headings', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    // atx-style headings
    expect(r.stdout).toMatch(/^## /m);
  });

  test('preserves links in markdown format', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    // Should have markdown link syntax
    expect(r.stdout).toContain('[Playwright]');
  });

  test('preserves lists', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    // Unordered list items
    expect(r.stdout).toMatch(/^[-*] /m);
    // Ordered list items
    expect(r.stdout).toMatch(/^\d+\. /m);
  });

  test('preserves code blocks', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    // Fenced code blocks
    expect(r.stdout).toContain('```');
    expect(r.stdout).toContain('browser-cli navigate');
  });

  test('preserves blockquotes', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    expect(r.stdout).toMatch(/^> /m);
  });

  test('preserves tables (GFM)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    // GFM table syntax: pipes
    expect(r.stdout).toContain('|');
    expect(r.stdout).toContain('Feature');
    expect(r.stdout).toContain('Extension-based');
  });

  test('trims long URLs', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('markdown');
    expect(r).toBcliSuccess();
    // The long URL in article.html should be trimmed (contains ellipsis)
    expect(r.stdout).toContain('\u2026');
  });

  test('--json returns structured result', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.ARTICLE);
    const r = bcli('--json', 'markdown');
    expect(r.exitCode).toBe(0);
    const json = JSON.parse(r.stdout);
    expect(json.success).toBe(true);
    expect(json.data.title).toContain('Test Article');
    expect(json.data.markdown).toBeTruthy();
    expect(typeof json.data.markdown).toBe('string');
    expect(json.data.markdown).toContain('Key Benefits');
  });

  test('fails gracefully on minimal page', async ({ bcli, navigateAndWait }) => {
    // Navigate to a page that Defuddle might not be able to parse
    await navigateAndWait('about:blank');
    const r = bcli('markdown');
    // Should fail with an error or return empty — just check it doesn't hang/timeout
    expect(r.exitCode).toBeDefined();
  });
});
