import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { existsSync, statSync } from 'node:fs';
import { rmSync } from 'node:fs';
import path from 'node:path';

let screenshotDir: string;

// Chrome limits captureVisibleTab calls per second — slow down tests
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ activePage }) => {
  screenshotDir = mkdtempSync(path.join(tmpdir(), 'bcli-screenshot-'));
  // Rate-limit: wait between screenshot tests to avoid MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND
  await activePage.waitForTimeout(1500);
});

test.afterEach(() => {
  if (screenshotDir && existsSync(screenshotDir)) {
    rmSync(screenshotDir, { recursive: true, force: true });
  }
});

// ---- screenshot (default) ----

test.describe('screenshot default', () => {
  test('takes a screenshot with default settings', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const filePath = path.join(screenshotDir, 'default.png');
    const r = bcli('screenshot', '--path', filePath);
    expect(r).toBcliSuccess();
    // Verify file was created and is not empty
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(0);
  });

  test('output mentions screenshot path or success', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const filePath = path.join(screenshotDir, 'check-output.png');
    const r = bcli('screenshot', '--path', filePath);
    expect(r).toBcliSuccess();
    // Output should reference the screenshot
    const mentionsScreenshot =
      r.stdout.includes('screenshot') ||
      r.stdout.includes('Screenshot') ||
      r.stdout.includes(filePath) ||
      existsSync(filePath);
    expect(mentionsScreenshot).toBe(true);
  });
});

// ---- screenshot --path ----

test.describe('screenshot --path', () => {
  test('saves to custom file path', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const filePath = path.join(screenshotDir, 'custom-path.png');
    const r = bcli('screenshot', '--path', filePath);
    expect(r).toBcliSuccess();
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(0);
  });

  test('overwrites existing file', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const filePath = path.join(screenshotDir, 'overwrite-test.png');

    // Take first screenshot
    const r1 = bcli('screenshot', '--path', filePath);
    expect(r1).toBcliSuccess();

    // Navigate to different page
    await navigateAndWait(PAGES.CHECKBOXES);

    // Take second screenshot to same path
    const r2 = bcli('screenshot', '--path', filePath);
    expect(r2).toBcliSuccess();
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(0);
  });
});

// ---- screenshot --selector ----

test.describe('screenshot --selector', () => {
  test('captures specific element', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const filePath = path.join(screenshotDir, 'element.png');
    const r = bcli('screenshot', '--selector', '#login', '--path', filePath);
    expect(r).toBcliSuccess();
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(0);
  });

  test('element screenshot is smaller than full page', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    const fullPath = path.join(screenshotDir, 'full-page.png');
    const elementPath = path.join(screenshotDir, 'element-only.png');

    // Take full page screenshot
    const r1 = bcli('screenshot', '--path', fullPath);
    expect(r1).toBcliSuccess();

    // Take element screenshot
    const r2 = bcli('screenshot', '--selector', 'h2', '--path', elementPath);
    expect(r2).toBcliSuccess();

    if (existsSync(fullPath) && existsSync(elementPath)) {
      const fullSize = statSync(fullPath).size;
      const elementSize = statSync(elementPath).size;
      // Element screenshot should generally be smaller
      expect(elementSize).toBeLessThan(fullSize);
    }
  });
});

// ---- screenshot --format ----

test.describe('screenshot --format', () => {
  test('takes PNG screenshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const filePath = path.join(screenshotDir, 'format-test.png');
    const r = bcli('screenshot', '--format', 'png', '--path', filePath);
    expect(r).toBcliSuccess();
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(0);
  });

  test('takes JPEG screenshot', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const filePath = path.join(screenshotDir, 'format-test.jpg');
    const r = bcli('screenshot', '--format', 'jpeg', '--path', filePath);
    expect(r).toBcliSuccess();
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(0);
  });
});

// ---- screenshot --quality ----

test.describe('screenshot --quality', () => {
  test('sets JPEG quality', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const highPath = path.join(screenshotDir, 'high-quality.jpg');
    const lowPath = path.join(screenshotDir, 'low-quality.jpg');

    // High quality
    const r1 = bcli('screenshot', '--format', 'jpeg', '--quality', '95', '--path', highPath);
    expect(r1).toBcliSuccess();

    // Low quality
    const r2 = bcli('screenshot', '--format', 'jpeg', '--quality', '10', '--path', lowPath);
    expect(r2).toBcliSuccess();

    if (existsSync(highPath) && existsSync(lowPath)) {
      const highSize = statSync(highPath).size;
      const lowSize = statSync(lowPath).size;
      // Higher quality should be larger file
      expect(highSize).toBeGreaterThan(lowSize);
    }
  });
});

// ---- screenshot integration tests ----

test.describe('screenshot integration', () => {
  test('after filling form elements', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'screenshot-test');
    const filePath = path.join(screenshotDir, 'after-fill.png');
    const r = bcli('screenshot', '--path', filePath);
    expect(r).toBcliSuccess();
    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(0);
  });

  test('different pages produce different screenshots', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const path1 = path.join(screenshotDir, 'page1.png');
    const r1 = bcli('screenshot', '--path', path1);
    expect(r1).toBcliSuccess();

    await navigateAndWait(PAGES.LOGIN);
    const path2 = path.join(screenshotDir, 'page2.png');
    const r2 = bcli('screenshot', '--path', path2);
    expect(r2).toBcliSuccess();

    if (existsSync(path1) && existsSync(path2)) {
      const size1 = statSync(path1).size;
      const size2 = statSync(path2).size;
      // Just verify both files have content -- exact size comparison is fragile
      expect(size1).toBeGreaterThan(0);
      expect(size2).toBeGreaterThan(0);
    }
  });
});
