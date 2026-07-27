import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Frames load asynchronously; give the browser a beat to attach them. */
const FRAME_SETTLE_MS = 1500;

test.afterEach(({ bcli }) => {
  // Frame focus is per-tab and survives across tests — always come back up.
  bcli('frame', 'main');
});

test.describe('frame list', () => {
  test('lists the main frame and its child frames with ids', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', 'list');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Frames (2)');
    expect(r.stdout).toContain('(main)');
    expect(r.stdout).toContain('iframe-content');
    // The main frame is the current one until a switch happens
    expect(r.stdout).toMatch(/→ \[\s*0\]/);
  });

  test('lists sibling frames on the nested frames page', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.NESTED_FRAMES);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', 'list');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Frames (5)');
    expect(r.stdout).toContain('name=frame-left');
    expect(r.stdout).toContain('name=frame-bottom');
  });

  test('lists a cross-origin child frame', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', 'list');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Frames (2)');
    expect(r.stdout).toContain('127.0.0.1:4174/cross-origin-frame');
  });

  test('shows nesting depth for grandchild frames', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_NESTED);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', 'list');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Frames (3)');
    expect(r.stdout).toContain('127.0.0.1:4174/cross-origin-outer');
    // The innermost frame is indented one level deeper than the outer one
    const lines = r.stdout.split('\n');
    const outer = lines.find((l) => l.includes('cross-origin-outer'));
    const inner = lines.find((l) => l.includes('localhost:4173/cross-origin-frame'));
    expect(outer).toBeTruthy();
    expect(inner).toBeTruthy();
    const indentOf = (line: string) => (/\]( +)/.exec(line)?.[1] ?? '').length;
    expect(indentOf(inner as string)).toBeGreaterThan(indentOf(outer as string));
  });
});

test.describe('frame current', () => {
  test('reports the main frame by default', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);

    const r = bcli('frame', 'current');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('main frame');
  });
});

test.describe('frame <selector> — same-origin iframe', () => {
  test('switches into the iframe and reads its DOM', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', '#mce_0_ifr');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('iframe-content');

    // #tinymce only exists inside the iframe document
    const text = bcli('get', 'text', '#tinymce');
    expect(text).toBcliSuccess();
    expect(text.stdout).toContain('Your content goes here');
  });

  test('frame current reflects the switch', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const before = bcli('frame', 'current');
    expect(before).toBcliSuccess();
    expect(before.stdout).toContain('main frame');

    expect(bcli('frame', '#mce_0_ifr')).toBcliSuccess();

    const after = bcli('frame', 'current');
    expect(after).toBcliSuccess();
    expect(after.stdout).not.toContain('main frame');
    expect(after.stdout).toContain('iframe-content');
  });

  test('snapshot is scoped to the focused frame', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#mce_0_ifr')).toBcliSuccess();

    const snap = bcli('snapshot', '-c');
    expect(snap).toBcliSuccess();
    // The host document's heading must not leak into the frame's snapshot
    expect(snap.stdout).not.toContain('An iFrame containing');
  });
});

test.describe('frame <selector> — cross-origin iframe', () => {
  test('switches into a cross-origin iframe and reads its DOM', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', '#cross-frame');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('127.0.0.1:4174/cross-origin-frame');

    const text = bcli('get', 'text', '#frame-heading');
    expect(text).toBcliSuccess();
    expect(text.stdout).toContain('Cross Origin Frame');
  });

  test('interacts with elements inside a cross-origin iframe', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#cross-frame')).toBcliSuccess();

    expect(bcli('fill', '#frame-input', 'hello cross origin')).toBcliSuccess();
    const value = bcli('get', 'value', '#frame-input');
    expect(value).toBcliSuccess();
    expect(value.stdout).toContain('hello cross origin');

    expect(bcli('click', '#frame-button')).toBcliSuccess();
    const status = bcli('get', 'text', '#frame-status');
    expect(status).toBcliSuccess();
    expect(status.stdout).toContain('clicked');
  });

  test('snapshot works inside a cross-origin iframe', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#cross-frame')).toBcliSuccess();

    const snap = bcli('snapshot', '-c');
    expect(snap).toBcliSuccess();
    expect(snap.stdout).toContain('Cross Origin Frame');
    expect(snap.stdout).not.toContain('Cross-Origin Host');
  });

  test('the host document is not reachable while a child frame is focused', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#cross-frame')).toBcliSuccess();

    // #host-heading lives in the top document only
    expect(bcli('get', 'text', '#host-heading')).toBcliFailure();
  });
});

test.describe('frame <selector> — nested cross-origin frames', () => {
  test('switches down two levels and back up', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_NESTED);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#outer-frame')).toBcliSuccess();
    const outer = bcli('get', 'text', '#outer-heading');
    expect(outer).toBcliSuccess();
    expect(outer.stdout).toContain('Outer Frame');

    // The inner frame is resolved relative to the currently focused frame
    expect(bcli('frame', '#inner-frame')).toBcliSuccess();
    const inner = bcli('get', 'text', '#frame-heading');
    expect(inner).toBcliSuccess();
    expect(inner.stdout).toContain('Cross Origin Frame');

    expect(bcli('frame', 'main')).toBcliSuccess();
    const host = bcli('get', 'text', '#host-heading');
    expect(host).toBcliSuccess();
    expect(host.stdout).toContain('Nested Cross-Origin Host');
  });

  test('an inner frame is not reachable from the main frame', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_NESTED);
    await sleep(FRAME_SETTLE_MS);

    // #inner-frame lives inside #outer-frame, not in the top document
    expect(bcli('frame', '#inner-frame')).toBcliFailure();
  });
});

test.describe('frame main — switch back to the top document', () => {
  test('returns to the main frame after a same-origin switch', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#mce_0_ifr')).toBcliSuccess();

    const r = bcli('frame', 'main');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Switched to main frame');

    const title = bcli('get', 'title');
    expect(title).toBcliSuccess();
    expect(title.stdout).toContain('The Internet');
  });

  test('returns to the main frame after a cross-origin switch', async ({
    bcli,
    navigateAndWait,
  }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#cross-frame')).toBcliSuccess();
    expect(bcli('frame', 'main')).toBcliSuccess();

    const host = bcli('get', 'text', '#host-heading');
    expect(host).toBcliSuccess();
    expect(host.stdout).toContain('Cross-Origin Host');
  });

  test('works even when already on the main frame', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', 'main');
    expect(r).toBcliSuccess();
  });

  test('page operations work after returning from an iframe', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#mce_0_ifr')).toBcliSuccess();
    expect(bcli('frame', 'main')).toBcliSuccess();

    const snap = bcli('snapshot', '-ic');
    expect(snap).toBcliSuccess();

    const title = bcli('get', 'title');
    expect(title).toBcliSuccess();
    expect(title.stdout).toContain('The Internet');
  });
});

test.describe('frame — focus lifetime', () => {
  test('an explicit navigation quietly drops the focus', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    expect(bcli('frame', '#cross-frame')).toBcliSuccess();

    // navigate is an explicit request for a new document — no error afterwards
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const current = bcli('frame', 'current');
    expect(current).toBcliSuccess();
    expect(current.stdout).toContain('main frame');

    const text = bcli('get', 'text', 'h3');
    expect(text).toBcliSuccess();
  });
});

test.describe('frame — error handling', () => {
  test('a nonexistent selector fails with a hint', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    const r = bcli('frame', '#nonexistent-iframe-12345');
    expect(r).toBcliFailure();
    expect(r).toContainOutput('hint');
  });

  test('a selector that is not an iframe fails', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', 'h3');
    expect(r).toBcliFailure();
    expect(r).toContainOutput('FRAME_ERROR');
  });

  test('an unknown frameId fails', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const r = bcli('frame', '99999');
    expect(r).toBcliFailure();
    expect(r).toContainOutput('FRAME_ERROR');
  });

  test('switching by frameId from frame list works', async ({ bcli, navigateAndWait }) => {
    await navigateAndWait(PAGES.CROSS_ORIGIN_IFRAME);
    await sleep(FRAME_SETTLE_MS);

    const list = bcli('frame', 'list');
    expect(list).toBcliSuccess();
    const line = list.stdout.split('\n').find((l) => l.includes('cross-origin-frame'));
    expect(line).toBeTruthy();
    const frameId = /\[\s*(\d+)\]/.exec(line as string)?.[1];
    expect(frameId).toBeTruthy();

    expect(bcli('frame', frameId as string)).toBcliSuccess();
    const text = bcli('get', 'text', '#frame-heading');
    expect(text).toBcliSuccess();
    expect(text.stdout).toContain('Cross Origin Frame');
  });
});
