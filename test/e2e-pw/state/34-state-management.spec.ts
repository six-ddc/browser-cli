import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
    expect(r).toBcliSuccess();

    // File should exist and not be empty
    expect(existsSync(stateFile)).toBe(true);
    const content = readFileSync(stateFile, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  test('creates valid JSON file', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'json-key', 'json-val');

    const stateFile = path.join(stateTempDir, 'json-state.json');
    const r = bcli('state', 'save', stateFile);
    expect(r).toBcliSuccess();

    // Save succeeded, so file must exist
    expect(existsSync(stateFile)).toBe(true);
    const content = readFileSync(stateFile, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test('captures cookies', async ({ bcli, baseURL }) => {
    // Set a unique cookie
    bcli('cookies', 'set', 'state-cookie', 'cookie-value', '--url', `${baseURL}/${PAGES.HOME}`);

    const stateFile = path.join(stateTempDir, 'cookie-state.json');
    const r = bcli('state', 'save', stateFile);
    expect(r).toBcliSuccess();

    // Save succeeded, so file must exist and contain the cookie name
    expect(existsSync(stateFile)).toBe(true);
    const content = readFileSync(stateFile, 'utf-8');
    expect(content).toContain('state-cookie');
  });

  test('captures localStorage', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'state-local', 'local-value');

    const stateFile = path.join(stateTempDir, 'local-state.json');
    const r = bcli('state', 'save', stateFile);
    expect(r).toBcliSuccess();

    // Save succeeded, so file must exist and contain the storage key
    expect(existsSync(stateFile)).toBe(true);
    const content = readFileSync(stateFile, 'utf-8');
    expect(content).toContain('state-local');
  });
});

test.describe('state load', () => {
  test('loads state from a file', async ({ bcli, baseURL }) => {
    // Save state
    bcli('cookies', 'set', 'load-test', 'load-value', '--url', `${baseURL}/${PAGES.HOME}`);
    bcli('storage', 'local', 'set', 'load-key', 'load-val');

    const stateFile = path.join(stateTempDir, 'load-state.json');
    const rSave = bcli('state', 'save', stateFile);
    expect(rSave).toBcliSuccess();

    // Clear everything
    bcli('cookies', 'clear');
    bcli('storage', 'local', 'clear');

    // Load state back
    const r = bcli('state', 'load', stateFile);
    expect(r).toBcliSuccess();

    // Verify data was restored: check cookie
    await sleep(1000);
    const rCookie = bcli('cookies', 'get', 'load-test');
    expect(rCookie).toBcliSuccess();
    expect(rCookie.stdout).toContain('load-test');
  });

  test('fails for nonexistent file', async ({ bcli }) => {
    const r = bcli('state', 'load', '/nonexistent/path/state.json');
    expect(r.exitCode).not.toBe(0);
  });
});

test.describe('state save/load round-trip', () => {
  test('save and load preserves cookies', async ({ bcli, navigateAndWait, baseURL }) => {
    await navigateAndWait(PAGES.HOME);

    // Set cookies
    bcli('cookies', 'set', 'roundtrip-cookie', 'cookie-preserved', '--url', `${baseURL}/${PAGES.HOME}`);
    await sleep(1000);

    // Save state
    const stateFile = path.join(stateTempDir, 'roundtrip-state.json');
    const r1 = bcli('state', 'save', stateFile);
    expect(r1).toBcliSuccess();

    // Clear cookies
    bcli('cookies', 'clear');

    // Load state back
    const r2 = bcli('state', 'load', stateFile);
    expect(r2).toBcliSuccess();
    await sleep(1000);

    // Verify cookie was restored
    const r3 = bcli('cookies', 'get', 'roundtrip-cookie');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('cookie-preserved');
  });

  test('save and load preserves localStorage', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    // Set localStorage
    bcli('storage', 'local', 'set', 'roundtrip-local', 'local-preserved');

    // Save state
    const stateFile = path.join(stateTempDir, 'local-roundtrip.json');
    const r1 = bcli('state', 'save', stateFile);
    expect(r1).toBcliSuccess();

    // Clear storage
    bcli('storage', 'local', 'clear');

    // Load state back
    const r2 = bcli('state', 'load', stateFile);
    expect(r2).toBcliSuccess();

    // Navigate back to ensure storage is accessible
    await navigateAndWait(PAGES.HOME);
    await sleep(1000);

    // Verify localStorage was restored
    const r3 = bcli('storage', 'local', 'roundtrip-local');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('local-preserved');
  });

  test('save and load preserves sessionStorage', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    bcli('storage', 'session', 'set', 'roundtrip-session', 'session-preserved');

    const stateFile = path.join(stateTempDir, 'session-roundtrip.json');
    const r1 = bcli('state', 'save', stateFile);
    expect(r1).toBcliSuccess();

    bcli('storage', 'session', 'clear');

    const r2 = bcli('state', 'load', stateFile);
    expect(r2).toBcliSuccess();

    await navigateAndWait(PAGES.HOME);
    await sleep(1000);

    const r3 = bcli('storage', 'session', 'roundtrip-session');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('session-preserved');
  });
});

test.describe('state - overwrite / multiple saves', () => {
  test('overwrites existing state file', async ({ bcli }) => {
    const stateFile = path.join(stateTempDir, 'overwrite-state.json');

    bcli('storage', 'local', 'set', 'first-save', 'first-value');
    bcli('state', 'save', stateFile);

    bcli('storage', 'local', 'set', 'second-save', 'second-value');
    const r = bcli('state', 'save', stateFile);
    expect(r).toBcliSuccess();
    expect(existsSync(stateFile)).toBe(true);
  });
});
