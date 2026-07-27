import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('logger file logging', () => {
  let dir: string;
  let logPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'browser-cli-logger-test-'));
    logPath = join(dir, 'daemon.log');
    // Fresh module instance per test so no prior test's enableFileLogging call leaks in.
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not write to file when enableFileLogging has not been called', async () => {
    const { logger } = await import('../src/util/logger.js');
    logger.info('hello');
    expect(existsSync(logPath)).toBe(false);
  });

  it('writes info/success/warn/error to file after enableFileLogging', async () => {
    const { logger, enableFileLogging } = await import('../src/util/logger.js');
    enableFileLogging(logPath);

    logger.info('info message');
    logger.success('success message');
    logger.warn('warn message');
    logger.error('error message');

    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z INFO {2}info message$/);
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z OK {4}success message$/);
    expect(lines[2]).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z WARN {2}warn message$/);
    expect(lines[3]).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z ERROR error message$/);
  });

  it('strips ANSI escape codes from file output', async () => {
    const { logger, enableFileLogging } = await import('../src/util/logger.js');
    enableFileLogging(logPath);

    logger.info('has \x1b[31mcolor\x1b[0m codes');

    const content = readFileSync(logPath, 'utf-8');
    // eslint-disable-next-line no-control-regex
    expect(content).not.toMatch(/\x1b\[/);
    expect(content).toContain('has color codes');
  });

  it('rotates the file to .1 when it exceeds 5MB', async () => {
    const { logger, enableFileLogging } = await import('../src/util/logger.js');
    enableFileLogging(logPath);

    // Pre-seed a file over 5MB so the next write triggers rotation.
    writeFileSync(logPath, 'x'.repeat(5 * 1024 * 1024 + 1));

    logger.info('trigger rotation');

    expect(existsSync(`${logPath}.1`)).toBe(true);
    expect(existsSync(logPath)).toBe(true);
    const rotatedSize = readFileSync(`${logPath}.1`).length;
    expect(rotatedSize).toBeGreaterThanOrEqual(5 * 1024 * 1024);

    const newContent = readFileSync(logPath, 'utf-8');
    expect(newContent).toContain('trigger rotation');
  });
});
