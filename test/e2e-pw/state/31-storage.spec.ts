import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('localStorage - set', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('sets a key-value pair', async ({ bcli }) => {
    const r = bcli('storage', 'local', 'set', 'mykey', 'myvalue');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Set');

    // Read-back verification: confirm the value was actually stored
    await sleep(500);
    const r2 = bcli('storage', 'local', 'mykey');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('mykey=myvalue');
  });

  test('sets key with special characters in value', async ({ bcli }) => {
    const r = bcli('storage', 'local', 'set', 'specialkey', 'hello world 123');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Set');

    // Read-back verification
    await sleep(500);
    const r2 = bcli('storage', 'local', 'specialkey');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('specialkey=hello world 123');
  });
});

test.describe('localStorage - get', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('gets specific key value', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'testkey', 'testvalue');
    await sleep(500);

    const r = bcli('storage', 'local', 'testkey');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('testkey=testvalue');
  });

  test('gets all entries when no key specified', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'key1', 'value1');
    bcli('storage', 'local', 'set', 'key2', 'value2');
    await sleep(500);

    const r = bcli('storage', 'local');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('key1=value1');
    expect(r.stdout).toContain('key2=value2');
  });

  test('shows (empty) when no entries', async ({ bcli }) => {
    const r = bcli('storage', 'local');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('(empty)');
  });

  test('returns only matching key', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'alpha', 'one');
    bcli('storage', 'local', 'set', 'beta', 'two');
    await sleep(500);

    const r = bcli('storage', 'local', 'alpha');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('alpha=one');
    expect(r.stdout).not.toContain('beta=two');
  });
});

test.describe('localStorage - clear', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('clears all localStorage', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'clearme', 'clearval');
    await sleep(500);

    const r = bcli('storage', 'local', 'clear');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');

    // Verify empty
    const r2 = bcli('storage', 'local');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('(empty)');
  });
});

test.describe('localStorage - round-trip', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('set-get round-trip preserves value', async ({ bcli }) => {
    const key = 'roundtrip';
    const value = 'testvalue123';

    bcli('storage', 'local', 'set', key, value);
    await sleep(500);

    const r = bcli('storage', 'local', key);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain(`${key}=${value}`);
  });

  test('overwrite existing value', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'overwrite', 'original');
    await sleep(500);
    bcli('storage', 'local', 'set', 'overwrite', 'updated');
    await sleep(500);

    const r = bcli('storage', 'local', 'overwrite');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('overwrite=updated');
  });

  test('set multiple, clear, verify empty', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'first', 'firstval');
    bcli('storage', 'local', 'set', 'second', 'secondval');
    bcli('storage', 'local', 'set', 'third', 'thirdval');
    await sleep(500);

    // Verify all set
    const r1 = bcli('storage', 'local');
    expect(r1).toBcliSuccess();
    expect(r1.stdout).toContain('first=firstval');
    expect(r1.stdout).toContain('second=secondval');
    expect(r1.stdout).toContain('third=thirdval');

    // Clear all
    bcli('storage', 'local', 'clear');
    await sleep(500);

    // Verify empty
    const r2 = bcli('storage', 'local');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('(empty)');
  });
});

test.describe('sessionStorage - set', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('sets a key-value pair', async ({ bcli }) => {
    const r = bcli('storage', 'session', 'set', 'sesskey', 'sessvalue');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Set');

    // Read-back verification: confirm the value was actually stored
    await sleep(500);
    const r2 = bcli('storage', 'session', 'sesskey');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('sesskey=sessvalue');
  });

  test('sets key with special characters in value', async ({ bcli }) => {
    const r = bcli('storage', 'session', 'set', 'specialsess', 'hello session 456');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Set');

    // Read-back verification
    await sleep(500);
    const r2 = bcli('storage', 'session', 'specialsess');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('specialsess=hello session 456');
  });
});

test.describe('sessionStorage - get', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('gets specific key value', async ({ bcli }) => {
    bcli('storage', 'session', 'set', 'testkey', 'testvalue');
    await sleep(500);

    const r = bcli('storage', 'session', 'testkey');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('testkey=testvalue');
  });

  test('gets all entries when no key specified', async ({ bcli }) => {
    bcli('storage', 'session', 'set', 'key1', 'value1');
    bcli('storage', 'session', 'set', 'key2', 'value2');
    await sleep(500);

    const r = bcli('storage', 'session');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('key1=value1');
    expect(r.stdout).toContain('key2=value2');
  });

  test('shows (empty) when no entries', async ({ bcli }) => {
    const r = bcli('storage', 'session');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('(empty)');
  });

  test('returns only matching key', async ({ bcli }) => {
    bcli('storage', 'session', 'set', 'gamma', 'three');
    bcli('storage', 'session', 'set', 'delta', 'four');
    await sleep(500);

    const r = bcli('storage', 'session', 'gamma');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('gamma=three');
    expect(r.stdout).not.toContain('delta=four');
  });
});

test.describe('sessionStorage - clear', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('clears all sessionStorage', async ({ bcli }) => {
    bcli('storage', 'session', 'set', 'clearme', 'clearval');
    await sleep(500);

    const r = bcli('storage', 'session', 'clear');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Cleared');

    // Verify empty
    const r2 = bcli('storage', 'session');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('(empty)');
  });
});

test.describe('sessionStorage - round-trip', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('set-get round-trip preserves value', async ({ bcli }) => {
    const key = 'sessround';
    const value = 'sessvalue789';

    bcli('storage', 'session', 'set', key, value);
    await sleep(500);

    const r = bcli('storage', 'session', key);
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain(`${key}=${value}`);
  });

  test('overwrite existing value', async ({ bcli }) => {
    bcli('storage', 'session', 'set', 'overwrite', 'original');
    await sleep(500);
    bcli('storage', 'session', 'set', 'overwrite', 'updated');
    await sleep(500);

    const r = bcli('storage', 'session', 'overwrite');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('overwrite=updated');
  });

  test('set multiple, clear, verify empty', async ({ bcli }) => {
    bcli('storage', 'session', 'set', 'first', 'firstval');
    bcli('storage', 'session', 'set', 'second', 'secondval');
    bcli('storage', 'session', 'set', 'third', 'thirdval');
    await sleep(500);

    // Verify all set
    const r1 = bcli('storage', 'session');
    expect(r1).toBcliSuccess();
    expect(r1.stdout).toContain('first=firstval');
    expect(r1.stdout).toContain('second=secondval');
    expect(r1.stdout).toContain('third=thirdval');

    // Clear all
    bcli('storage', 'session', 'clear');
    await sleep(500);

    // Verify empty
    const r2 = bcli('storage', 'session');
    expect(r2).toBcliSuccess();
    expect(r2.stdout).toContain('(empty)');
  });
});

test.describe('cross-area isolation', () => {
  test.beforeEach(async ({ navigateAndWait, bcli }) => {
    await navigateAndWait(PAGES.HOME);
    bcli('storage', 'local', 'clear');
    bcli('storage', 'session', 'clear');
  });

  test('localStorage and sessionStorage are isolated', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'isolated', 'localvalue');
    bcli('storage', 'session', 'set', 'isolated', 'sessionvalue');
    await sleep(500);

    // Local should have localvalue
    const rLocal = bcli('storage', 'local', 'isolated');
    expect(rLocal).toBcliSuccess();
    expect(rLocal.stdout).toContain('isolated=localvalue');

    // Session should have sessionvalue
    const rSession = bcli('storage', 'session', 'isolated');
    expect(rSession).toBcliSuccess();
    expect(rSession.stdout).toContain('isolated=sessionvalue');
  });

  test('clearing local does not affect session', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'localonly', 'localval');
    bcli('storage', 'session', 'set', 'sessiononly', 'sessionval');
    await sleep(500);

    // Clear local only
    bcli('storage', 'local', 'clear');
    await sleep(500);

    // Local should be empty
    const rLocal = bcli('storage', 'local');
    expect(rLocal).toBcliSuccess();
    expect(rLocal.stdout).toContain('(empty)');

    // Session should still have its value
    const rSession = bcli('storage', 'session', 'sessiononly');
    expect(rSession).toBcliSuccess();
    expect(rSession.stdout).toContain('sessiononly=sessionval');
  });

  test('clearing session does not affect local', async ({ bcli }) => {
    bcli('storage', 'local', 'set', 'localonly', 'localval');
    bcli('storage', 'session', 'set', 'sessiononly', 'sessionval');
    await sleep(500);

    // Clear session only
    bcli('storage', 'session', 'clear');
    await sleep(500);

    // Session should be empty
    const rSession = bcli('storage', 'session');
    expect(rSession).toBcliSuccess();
    expect(rSession.stdout).toContain('(empty)');

    // Local should still have its value
    const rLocal = bcli('storage', 'local', 'localonly');
    expect(rLocal).toBcliSuccess();
    expect(rLocal.stdout).toContain('localonly=localval');
  });
});
