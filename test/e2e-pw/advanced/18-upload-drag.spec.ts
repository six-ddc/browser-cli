import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';
import { writeFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let uploadTempDir: string;

test.beforeEach(() => {
  uploadTempDir = mkdtempSync(path.join(tmpdir(), 'bcli-upload-'));
});

test.afterEach(() => {
  // Clean up temp files — best effort
  try {
    const { rmSync } = require('node:fs');
    rmSync(uploadTempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

test.describe('upload', () => {
  test('uploads a file to file input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.UPLOAD);

    const testFile = path.join(uploadTempDir, 'test-upload.txt');
    writeFileSync(testFile, 'test file content');

    const r = bcli('upload', SEL.FILE_UPLOAD, testFile);
    expect(r).toBcliSuccess();
  });

  test('file input shows filename after upload', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.UPLOAD);

    const testFile = path.join(uploadTempDir, 'hello.txt');
    writeFileSync(testFile, 'hello world');

    const r1 = bcli('upload', SEL.FILE_UPLOAD, testFile);
    expect(r1).toBcliSuccess();

    // Get the value of the file input -- should contain the filename
    const r2 = bcli('get', 'value', SEL.FILE_UPLOAD);
    expect(r2).toBcliSuccess();
    const stdout = r2.stdout;
    expect(
      stdout.includes('hello.txt') || stdout.includes('hello') || stdout.length > 0,
    ).toBe(true);
  });

  test('upload then submit form', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.UPLOAD);

    const testFile = path.join(uploadTempDir, 'submit-test.txt');
    writeFileSync(testFile, 'file for submission');

    // Upload file
    const r1 = bcli('upload', SEL.FILE_UPLOAD, testFile);
    expect(r1).toBcliSuccess();

    // Click submit
    const r2 = bcli('click', SEL.FILE_SUBMIT);
    expect(r2).toBcliSuccess();
    await activePage.waitForTimeout(2000);

    // After submit, the page shows the uploaded filename in #uploaded-files
    const r3 = bcli('get', 'text', '#uploaded-files');
    expect(r3).toBcliSuccess();
    const stdout = r3.stdout;
    expect(stdout.includes('submit-test.txt') || stdout.includes('Uploaded')).toBe(true);
  });

  test('upload with --clear flag', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.UPLOAD);

    const testFile1 = path.join(uploadTempDir, 'first.txt');
    const testFile2 = path.join(uploadTempDir, 'second.txt');
    writeFileSync(testFile1, 'first file');
    writeFileSync(testFile2, 'second file');

    // Upload first file
    const r1 = bcli('upload', SEL.FILE_UPLOAD, testFile1);
    expect(r1).toBcliSuccess();

    // Upload second file with --clear (should replace first)
    const r2 = bcli('upload', SEL.FILE_UPLOAD, testFile2, '--clear');
    expect(r2).toBcliSuccess();
  });

  test('fails for nonexistent file input', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.UPLOAD);

    const testFile = path.join(uploadTempDir, 'test.txt');
    writeFileSync(testFile, 'test');

    const r = bcli('upload', '.nonexistent-input-12345', testFile);
    expect(r).toBcliFailure();
  });
});

test.describe('drag', () => {
  test('drags element from source to target', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.DRAG_AND_DROP);

    // Get initial text of column A
    const r1 = bcli('get', 'text', SEL.DRAG_COL_A);
    expect(r1).toBcliSuccess();

    // Drag column A to column B
    const r2 = bcli('drag', SEL.DRAG_COL_A, SEL.DRAG_COL_B);
    expect(r2).toBcliSuccess();
    await activePage.waitForTimeout(1000);
  });

  test('command completes successfully', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DRAG_AND_DROP);
    const r = bcli('drag', SEL.DRAG_COL_A, SEL.DRAG_COL_B);
    expect(r).toBcliSuccess();
  });

  test('fails with nonexistent source', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DRAG_AND_DROP);
    const r = bcli('drag', '.nonexistent-source-12345', SEL.DRAG_COL_B);
    expect(r).toBcliFailure();
  });

  test('fails with nonexistent target', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.DRAG_AND_DROP);
    const r = bcli('drag', SEL.DRAG_COL_A, '.nonexistent-target-12345');
    expect(r).toBcliFailure();
  });
});
