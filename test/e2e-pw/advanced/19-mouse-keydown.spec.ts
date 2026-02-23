import { test, expect } from '../fixtures';
import { PAGES, SEL } from '../helpers/constants';

test.describe('mouse move', () => {
  test('moves mouse to coordinates', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);
    const r = bcli('mouse', 'move', '100', '200');
    expect(r).toBcliSuccess();
  });

  test('moves to different positions', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('mouse', 'move', '0', '0');
    expect(r1).toBcliSuccess();

    const r2 = bcli('mouse', 'move', '500', '300');
    expect(r2).toBcliSuccess();
  });
});

test.describe('mouse down / up', () => {
  test('presses mouse button', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('mouse', 'move', '100', '100');
    expect(r1).toBcliSuccess();

    const r2 = bcli('mouse', 'down');
    expect(r2).toBcliSuccess();

    // Release to clean up
    const r3 = bcli('mouse', 'up');
    expect(r3).toBcliSuccess();
  });

  test('presses left button explicitly', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('mouse', 'move', '100', '100');
    expect(r1).toBcliSuccess();

    const r2 = bcli('mouse', 'down', 'left');
    expect(r2).toBcliSuccess();

    const r3 = bcli('mouse', 'up', 'left');
    expect(r3).toBcliSuccess();
  });

  test('releases mouse button', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('mouse', 'move', '100', '100');
    expect(r1).toBcliSuccess();

    const r2 = bcli('mouse', 'down');
    expect(r2).toBcliSuccess();

    const r3 = bcli('mouse', 'up');
    expect(r3).toBcliSuccess();
  });

  test('full click cycle (move + down + up)', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const r1 = bcli('mouse', 'move', '200', '200');
    expect(r1).toBcliSuccess();

    const r2 = bcli('mouse', 'down');
    expect(r2).toBcliSuccess();

    const r3 = bcli('mouse', 'up');
    expect(r3).toBcliSuccess();
  });
});

test.describe('mouse wheel', () => {
  test('scrolls vertically', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('mouse', 'wheel', '200');
    expect(r).toBcliSuccess();
  });

  test('scrolls with deltaX', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);
    const r = bcli('mouse', 'wheel', '0', '100');
    expect(r).toBcliSuccess();
  });

  test('negative delta scrolls up', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LARGE_PAGE);

    // First scroll down
    bcli('mouse', 'wheel', '500');

    // Then scroll back up with negative delta
    const r = bcli('mouse', 'wheel', '-300');
    expect(r).toBcliSuccess();
  });
});

test.describe('keydown', () => {
  test('presses key down', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);

    const r1 = bcli('keydown', 'Shift');
    expect(r1).toBcliSuccess();

    // Verify the key press was registered in the page's #result element
    await expect(activePage.locator('#result')).toContainText('Shift');

    // Release the key
    const r2 = bcli('keyup', 'Shift');
    expect(r2).toBcliSuccess();
  });

  test('presses Control key', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);

    const r1 = bcli('keydown', 'Control');
    expect(r1).toBcliSuccess();

    // Verify the key press was registered
    await expect(activePage.locator('#result')).toContainText('Control');

    const r2 = bcli('keyup', 'Control');
    expect(r2).toBcliSuccess();
  });

  test('presses letter key', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);

    const r1 = bcli('keydown', 'a');
    expect(r1).toBcliSuccess();

    // Verify the key press was registered
    await expect(activePage.locator('#result')).toContainText('a');

    const r2 = bcli('keyup', 'a');
    expect(r2).toBcliSuccess();
  });
});

test.describe('keyup', () => {
  test('releases key', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);

    const r1 = bcli('keydown', 'Shift');
    expect(r1).toBcliSuccess();

    const r2 = bcli('keyup', 'Shift');
    expect(r2).toBcliSuccess();
  });
});

test.describe('keydown + keyup integration', () => {
  test('modifier key sequence', async ({ bcli, navigateAndWait, activePage }) => {
    await navigateAndWait(PAGES.KEY_PRESSES);

    // Hold Shift, press 'a', release both
    const r1 = bcli('keydown', 'Shift');
    expect(r1).toBcliSuccess();

    const r2 = bcli('press', 'a');
    expect(r2).toBcliSuccess();

    // The last keydown event should show 'a' in the result
    await expect(activePage.locator('#result')).toContainText('a');

    const r3 = bcli('keyup', 'Shift');
    expect(r3).toBcliSuccess();
  });

  test('Control+a select all pattern', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.LOGIN);
    bcli('fill', SEL.USERNAME, 'test-keydown');

    // Focus the input
    bcli('focus', SEL.USERNAME);

    // Control+A to select all
    const r1 = bcli('keydown', 'Control');
    expect(r1).toBcliSuccess();

    const r2 = bcli('press', 'a');
    expect(r2).toBcliSuccess();

    const r3 = bcli('keyup', 'Control');
    expect(r3).toBcliSuccess();
  });
});

test.describe('mouse + keydown integration', () => {
  test('Shift+Click pattern', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    // Hold Shift
    const r1 = bcli('keydown', 'Shift');
    expect(r1).toBcliSuccess();

    // Move mouse and click
    const r2 = bcli('mouse', 'move', '200', '200');
    expect(r2).toBcliSuccess();

    const r3 = bcli('mouse', 'down');
    expect(r3).toBcliSuccess();

    const r4 = bcli('mouse', 'up');
    expect(r4).toBcliSuccess();

    // Release Shift
    const r5 = bcli('keyup', 'Shift');
    expect(r5).toBcliSuccess();
  });
});
