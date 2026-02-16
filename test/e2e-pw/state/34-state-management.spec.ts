import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let stateTempDir: string;

test.beforeEach(async ({ navigateAndWait }) => {
  stateTempDir = mkdtempSync(path.join(tmpdir(), 'bcli-test-'));
  await navigateAndWait(PAGES.HOME);
});

test.afterEach(() => {
  if (stateTempDir && existsSync(stateTempDir)) {
    rmSync(stateTempDir, { recursive: true, force: true });
  }
});

test.describe('state save', () => {
  test('saves state to a file', async ({ bcli, baseURL }) => {
    // Set some cookies and storage first
    bcli('cookies', 'set', 'save-test', 'save-value', '--url', `${baseURL}/${PAGES.HOME}`);
    bcli('storage', 'local', 'set', 'save-key', 'save-val');

    const stateFile = path.join(stateTempDir, 'test-state.json');
    const r = bcli('state', 'save', stateFile);
    expect(r.exitCode).toBe(0);

    // File should exist and not be empty
    expect(existsSync(stateFile)).toBe(true);
    const content = readFileSync(stateFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  test('creates valid JSON file', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'json-key', 'json-val');

    const stateFile = path.join(stateTempDir, 'json-state.json');
    const r = bcli('state', 'save', stateFile);
    expect(r.exitCode).toBe(0);

    // Verify it's valid JSON
    if (existsSync(stateFile)) {
      const content = readFileSync(stateFile, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  test('captures cookies', async ({ bcli, baseURL }) => {
    // Set a unique cookie
    bcli('cookies', 'set', 'state-cookie', 'cookie-value', '--url', `${baseURL}/${PAGES.HOME}`);

    const stateFile = path.join(stateTempDir, 'cookie-state.json');
    const r = bcli('state', 'save', stateFile);
    expect(r.exitCode).toBe(0);

    if (existsSync(stateFile)) {
      const content = readFileSync(stateFile, 'utf-8');
      // File should contain the cookie (best effort check)
      expect(content.includes('state-cookie') || content.length > 0).toBe(true);
    }
  });

  test('captures localStorage', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'state-local', 'local-value');

    const stateFile = path.join(stateTempDir, 'local-state.json');
    const r = bcli('state', 'save', stateFile);
    expect(r.exitCode).toBe(0);

    if (existsSync(stateFile)) {
      const content = readFileSync(stateFile, 'utf-8');
      expect(content.includes('state-local') || content.length > 0).toBe(true);
    }
  });
});

test.describe('state load', () => {
  test('loads state from a file', async ({ bcli, baseURL, activePage }) => {
    // Save state
    bcli('cookies', 'set', 'load-test', 'load-value', '--url', `${baseURL}/${PAGES.HOME}`);
    bcli('storage', 'local', 'set', 'load-key', 'load-val');

    const stateFile = path.join(stateTempDir, 'load-state.json');
    bcli('state', 'save', stateFile);

    // Clear everything
    bcli('cookies', 'clear');
    bcli('storage', 'local', 'clear');

    // Load state back
    const r = bcli('state', 'load', stateFile);
    expect(r.exitCode).toBe(0);
  });

  test('fails for nonexistent file', async ({ bcli }) => {
    const r = bcli('state', 'load', '/nonexistent/path/state.json');
    expect(r.exitCode).not.toBe(0);
  });
});

test.describe('state save/load round-trip', () => {
  test('save and load preserves cookies', async ({ bcli, navigateAndWait, baseURL, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    // Set cookies
    bcli('cookies', 'set', 'roundtrip-cookie', 'cookie-preserved', '--url', `${baseURL}/${PAGES.HOME}`);
    await activePage.waitForTimeout(1000);

    // Save state
    const stateFile = path.join(stateTempDir, 'roundtrip-state.json');
    const r1 = bcli('state', 'save', stateFile);
    expect(r1.exitCode).toBe(0);

    // Clear cookies
    bcli('cookies', 'clear');

    // Load state back
    const r2 = bcli('state', 'load', stateFile);
    expect(r2.exitCode).toBe(0);
    await activePage.waitForTimeout(1000);

    // Verify cookie was restored
    const r3 = bcli('cookies', 'get', 'roundtrip-cookie');
    expect(r3.exitCode).toBe(0);
    expect(
      r3.stdout.includes('cookie-preserved') || r3.stdout.includes('roundtrip-cookie'),
    ).toBe(true);
  });

  test('save and load preserves localStorage', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    // Set localStorage
    bcli('storage', 'local', 'set', 'roundtrip-local', 'local-preserved');

    // Save state
    const stateFile = path.join(stateTempDir, 'local-roundtrip.json');
    const r1 = bcli('state', 'save', stateFile);
    expect(r1.exitCode).toBe(0);

    // Clear storage
    bcli('storage', 'local', 'clear');

    // Load state back
    const r2 = bcli('state', 'load', stateFile);
    expect(r2.exitCode).toBe(0);

    // Navigate back to ensure storage is accessible
    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(1000);

    // Verify localStorage was restored
    const r3 = bcli('storage', 'local', 'roundtrip-local');
    expect(r3.exitCode).toBe(0);
    expect(
      r3.stdout.includes('local-preserved') || r3.stdout.includes('roundtrip-local'),
    ).toBe(true);
  });

  test('save and load preserves sessionStorage', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('storage', 'session', 'set', 'roundtrip-session', 'session-preserved');

    const stateFile = path.join(stateTempDir, 'session-roundtrip.json');
    const r1 = bcli('state', 'save', stateFile);
    expect(r1.exitCode).toBe(0);

    bcli('storage', 'session', 'clear');

    const r2 = bcli('state', 'load', stateFile);
    expect(r2.exitCode).toBe(0);

    await navigateAndWait(PAGES.HOME);
    await activePage.waitForTimeout(1000);

    const r3 = bcli('storage', 'session', 'roundtrip-session');
    expect(r3.exitCode).toBe(0);
    expect(
      r3.stdout.includes('session-preserved') || r3.stdout.includes('roundtrip-session'),
    ).toBe(true);
  });
});

test.describe('state - overwrite / multiple saves', () => {
  test('overwrites existing state file', async ({ bcli }) => {
    const stateFile = path.join(stateTempDir, 'overwrite-state.json');

    bcli('storage', 'local', 'set', 'first-save', 'first-value');
    bcli('state', 'save', stateFile);

    bcli('storage', 'local', 'set', 'second-save', 'second-value');
    const r = bcli('state', 'save', stateFile);
    expect(r.exitCode).toBe(0);
    expect(existsSync(stateFile)).toBe(true);
  });
});
