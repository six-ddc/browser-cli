import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('dialog accept', () => {
  test('sets up auto-accept for alert', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    // Set up dialog handler to auto-accept
    const r1 = bcli('dialog', 'accept');
    expect(r1).toBcliSuccess();

    // Trigger an alert (first button: "Click for JS Alert")
    const r2 = bcli('click', 'button[onclick="jsAlert()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);

    // The result text should show the alert was accepted
    const r3 = bcli('get', 'text', '#result');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('successfully');
  });

  test('accepts confirm dialog', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    const r1 = bcli('dialog', 'accept');
    expect(r1).toBcliSuccess();

    // Trigger a confirm dialog (second button: "Click for JS Confirm")
    const r2 = bcli('click', 'button[onclick="jsConfirm()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);

    // Result should show OK was pressed
    const r3 = bcli('get', 'text', '#result');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('Ok');
  });

  test('provides text for prompt dialog', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    // Set up dialog handler to auto-accept with text
    const r1 = bcli('dialog', 'accept', 'Hello from test');
    expect(r1).toBcliSuccess();

    // Trigger a prompt dialog (third button: "Click for JS Prompt")
    const r2 = bcli('click', 'button[onclick="jsPrompt()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);

    // Result should show the text we entered
    const r3 = bcli('get', 'text', '#result');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('Hello from test');
  });
});

test.describe('dialog dismiss', () => {
  test('dismisses alert', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    const r1 = bcli('dialog', 'dismiss');
    expect(r1).toBcliSuccess();

    // Trigger an alert
    const r2 = bcli('click', 'button[onclick="jsAlert()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);

    // Alert should have been dismissed (result may still show success since alert only has OK)
    const r3 = bcli('get', 'text', '#result');
    expect(r3).toBcliSuccess();
  });

  test('dismisses confirm dialog (Cancel)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    const r1 = bcli('dialog', 'dismiss');
    expect(r1).toBcliSuccess();

    // Trigger a confirm dialog
    const r2 = bcli('click', 'button[onclick="jsConfirm()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);

    // Result should show Cancel was pressed
    const r3 = bcli('get', 'text', '#result');
    expect(r3).toBcliSuccess();
    expect(r3.stdout).toContain('Cancel');
  });

  test('dismisses prompt dialog', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    const r1 = bcli('dialog', 'dismiss');
    expect(r1).toBcliSuccess();

    // Trigger a prompt dialog
    const r2 = bcli('click', 'button[onclick="jsPrompt()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);

    // Result should show null (prompt was dismissed)
    const r3 = bcli('get', 'text', '#result');
    expect(r3).toBcliSuccess();
    const stdout = r3.stdout;
    expect(stdout.includes('null') || stdout.includes('Cancel')).toBe(true);
  });
});

test.describe('dialog integration', () => {
  test('accept then dismiss in sequence', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    // First, accept a confirm
    const r1 = bcli('dialog', 'accept');
    expect(r1).toBcliSuccess();
    const r2 = bcli('click', 'button[onclick="jsConfirm()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);
    const r3 = bcli('get', 'text', '#result');
    expect(r3.stdout).toContain('Ok');

    // Then, dismiss a confirm
    const r4 = bcli('dialog', 'dismiss');
    expect(r4).toBcliSuccess();
    const r5 = bcli('click', 'button[onclick="jsConfirm()"]');
    expect(r5).toBcliSuccess();
    await sleep(1000);
    const r6 = bcli('get', 'text', '#result');
    expect(r6.stdout).toContain('Cancel');
  });

  test('multiple prompt dialogs with different text', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.JAVASCRIPT_ALERTS);

    // First prompt with text "First"
    const r1 = bcli('dialog', 'accept', 'First');
    expect(r1).toBcliSuccess();
    const r2 = bcli('click', 'button[onclick="jsPrompt()"]');
    expect(r2).toBcliSuccess();
    await sleep(1000);
    const r3 = bcli('get', 'text', '#result');
    expect(r3.stdout).toContain('First');

    // Second prompt with text "Second"
    const r4 = bcli('dialog', 'accept', 'Second');
    expect(r4).toBcliSuccess();
    const r5 = bcli('click', 'button[onclick="jsPrompt()"]');
    expect(r5).toBcliSuccess();
    await sleep(1000);
    const r6 = bcli('get', 'text', '#result');
    expect(r6.stdout).toContain('Second');
  });
});
