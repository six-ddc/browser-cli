/**
 * Per-tab frame focus and frameId resolution.
 *
 * The focused frame is stored in the background (tabId -> frameId) so every
 * content-script message can be delivered straight to the target frame with
 * `tabs.sendMessage(tabId, msg, { frameId })`. That works for cross-origin
 * iframes, which cannot be reached from the parent document at all.
 */

import type {
  ErrorCode,
  FrameDescriptor,
  FrameDocumentInfo,
  FrameOffsetResult,
  ResolveFrameResult,
} from '@browser-cli/shared';
import { BrowserCliError } from '@browser-cli/shared';
import { sendToContentScript } from './send-to-content-script';

export const MAIN_FRAME_ID = 0;

const SESSION_KEY = 'browserCliFrameFocus';

/** tabId -> focused frameId (absent means the main frame) */
const focusByTab = new Map<number, number>();
/** tabId -> message explaining why the focus was dropped, consumed once */
const noticeByTab = new Map<number, string>();

interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/**
 * MV3 service workers are torn down between commands, so the focus lives in
 * `storage.session` (in-memory, cleared when the browser closes) as well.
 */
function sessionArea(): SessionArea | null {
  const area = (browser.storage as unknown as { session?: SessionArea }).session;
  return area ?? null;
}

let hydration: Promise<void> | null = null;

function hydrate(): Promise<void> {
  hydration ??= (async () => {
    const area = sessionArea();
    if (!area) return;
    try {
      const stored = await area.get(SESSION_KEY);
      const entry = stored[SESSION_KEY] as
        | { focus?: Record<string, number>; notice?: Record<string, string> }
        | undefined;
      if (!entry) return;
      for (const [tabId, frameId] of Object.entries(entry.focus ?? {})) {
        if (!focusByTab.has(Number(tabId))) focusByTab.set(Number(tabId), frameId);
      }
      for (const [tabId, message] of Object.entries(entry.notice ?? {})) {
        if (!noticeByTab.has(Number(tabId))) noticeByTab.set(Number(tabId), message);
      }
    } catch {
      /* session storage unavailable — in-memory state still works */
    }
  })();
  return hydration;
}

function persist(): void {
  const area = sessionArea();
  if (!area) return;
  void area
    .set({
      [SESSION_KEY]: {
        focus: Object.fromEntries(focusByTab),
        notice: Object.fromEntries(noticeByTab),
      },
    })
    .catch(() => {
      /* best effort */
    });
}

export async function getFocusedFrameId(tabId: number): Promise<number> {
  await hydrate();
  return focusByTab.get(tabId) ?? MAIN_FRAME_ID;
}

export async function setFocusedFrameId(tabId: number, frameId: number): Promise<void> {
  await hydrate();
  noticeByTab.delete(tabId);
  if (frameId === MAIN_FRAME_ID) {
    focusByTab.delete(tabId);
  } else {
    focusByTab.set(tabId, frameId);
  }
  persist();
}

/**
 * Drop the focus without a notice — used when the caller asked for the
 * navigation, so losing the frame is the expected outcome, not a surprise.
 */
export function clearFrameFocus(tabId: number): void {
  void hydrate().then(() => {
    if (!focusByTab.has(tabId) && !noticeByTab.has(tabId)) return;
    focusByTab.delete(tabId);
    noticeByTab.delete(tabId);
    persist();
  });
}

/**
 * Drop the focus and remember why. The next command that would have used the
 * frame reports the notice instead of silently acting on the wrong document.
 */
export function invalidateFrameFocus(tabId: number, reason: string): void {
  void hydrate().then(() => {
    if (!focusByTab.has(tabId)) return;
    focusByTab.delete(tabId);
    noticeByTab.set(tabId, reason);
    persist();
  });
}

export function forgetTab(tabId: number): void {
  focusByTab.delete(tabId);
  noticeByTab.delete(tabId);
  persist();
}

// ─── Frame tree ─────────────────────────────────────────────────────

export interface RawFrame {
  frameId: number;
  parentFrameId: number;
  url: string;
  errorOccurred?: boolean;
}

interface WebNavigationApi {
  getAllFrames(details: { tabId: number }): Promise<RawFrame[] | null>;
}

function webNavigationApi(): WebNavigationApi | null {
  const api = (browser as unknown as { webNavigation?: WebNavigationApi }).webNavigation;
  return api ?? null;
}

export async function getAllFrames(tabId: number): Promise<RawFrame[]> {
  const api = webNavigationApi();
  if (!api) {
    throw new BrowserCliError(
      'UNSUPPORTED',
      'This browser build has no webNavigation API, so frames cannot be enumerated.',
      'Run commands against the top-level document only.',
    );
  }
  const frames = await api.getAllFrames({ tabId });
  if (!frames || frames.length === 0) {
    throw new BrowserCliError(
      'FRAME_ERROR',
      'Could not read the frame tree for this tab.',
      "The tab may be a privileged page (chrome://, PDF viewer) or still loading — retry after 'wait --load domcontentloaded'.",
    );
  }
  return frames;
}

function depthOf(frame: RawFrame, byId: Map<number, RawFrame>): number {
  let depth = 0;
  let current = frame;
  while (current.parentFrameId >= 0 && depth < 32) {
    const parent = byId.get(current.parentFrameId);
    if (!parent) break;
    depth++;
    current = parent;
  }
  return depth;
}

/** Depth-first ordering so nesting reads top-down in `frame list`. */
function orderFrames(frames: RawFrame[]): RawFrame[] {
  const childrenOf = new Map<number, RawFrame[]>();
  for (const frame of frames) {
    const bucket = childrenOf.get(frame.parentFrameId);
    if (bucket) bucket.push(frame);
    else childrenOf.set(frame.parentFrameId, [frame]);
  }
  const ordered: RawFrame[] = [];
  const visit = (frame: RawFrame) => {
    ordered.push(frame);
    for (const child of childrenOf.get(frame.frameId) ?? []) visit(child);
  };
  const roots = frames.filter(
    (f) => f.parentFrameId < 0 || !frames.some((p) => p.frameId === f.parentFrameId),
  );
  for (const root of roots) visit(root);
  // Frames whose parent vanished mid-traversal still deserve a line
  for (const frame of frames) {
    if (!ordered.includes(frame)) ordered.push(frame);
  }
  return ordered;
}

async function describeFrame(tabId: number, frameId: number): Promise<FrameDocumentInfo | null> {
  try {
    const response = await sendToContentScript(
      tabId,
      {
        type: 'browser-cli-command',
        id: `frame-describe-${frameId}-${Date.now()}`,
        command: { action: 'getCurrentFrame', params: {} },
      },
      { frameId, maxRetries: 0 },
    );
    if (!response.success) return null;
    return response.data as FrameDocumentInfo;
  } catch {
    return null;
  }
}

export async function listFrameDescriptors(
  tabId: number,
): Promise<{ currentFrameId: number; frames: FrameDescriptor[] }> {
  const currentFrameId = await getFocusedFrameId(tabId);
  const raw = await getAllFrames(tabId);
  const byId = new Map(raw.map((f) => [f.frameId, f]));
  const ordered = orderFrames(raw);

  const described = await Promise.all(ordered.map((f) => describeFrame(tabId, f.frameId)));

  return {
    currentFrameId,
    frames: ordered.map((frame, i) => {
      const info = described[i];
      return {
        frameId: frame.frameId,
        parentFrameId: frame.parentFrameId,
        url: info?.url ?? frame.url,
        name: info?.name ?? null,
        title: info?.title ?? null,
        depth: depthOf(frame, byId),
        isMainFrame: frame.frameId === MAIN_FRAME_ID,
        isCurrent: frame.frameId === currentFrameId,
        reachable: info != null,
      };
    }),
  };
}

/** Last-resort main frame description for tabs with no readable frame tree. */
async function mainFrameFromTab(tabId: number): Promise<FrameDescriptor> {
  const tab = await browser.tabs.get(tabId);
  return {
    frameId: MAIN_FRAME_ID,
    parentFrameId: -1,
    url: tab.url ?? '',
    name: null,
    title: tab.title ?? null,
    depth: 0,
    isMainFrame: true,
    isCurrent: true,
    reachable: false,
  };
}

export async function describeFrameId(tabId: number, frameId: number): Promise<FrameDescriptor> {
  // 'frame main' must work even on pages with no readable frame tree
  const raw =
    frameId === MAIN_FRAME_ID
      ? await getAllFrames(tabId).catch(() => null)
      : await getAllFrames(tabId);
  if (!raw) return mainFrameFromTab(tabId);

  const byId = new Map(raw.map((f) => [f.frameId, f]));
  const frame = byId.get(frameId);
  if (!frame) {
    if (frameId === MAIN_FRAME_ID) return mainFrameFromTab(tabId);
    throw new BrowserCliError(
      'FRAME_ERROR',
      `Frame ${frameId} is no longer part of this tab.`,
      "Run 'frame list' to see the frames that exist now.",
    );
  }
  const info = await describeFrame(tabId, frameId);
  const currentFrameId = await getFocusedFrameId(tabId);
  return {
    frameId: frame.frameId,
    parentFrameId: frame.parentFrameId,
    url: info?.url ?? frame.url,
    name: info?.name ?? null,
    title: info?.title ?? null,
    depth: depthOf(frame, byId),
    isMainFrame: frame.frameId === MAIN_FRAME_ID,
    isCurrent: frame.frameId === currentFrameId,
    reachable: info != null,
  };
}

// ─── Selector -> frameId ────────────────────────────────────────────

export interface FrameCandidate {
  frameId: number;
  url: string;
}

export interface FrameMatchHint {
  index: number;
  total: number;
  src: string;
}

function normalizeUrl(url: string): string {
  return url
    .split('#')[0]
    .replace(/\.html?$/i, '')
    .replace(/\/+$/, '');
}

export function urlsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeUrl(a) === normalizeUrl(b);
}

/**
 * Map an iframe element (identified by its position among the parent's child
 * browsing contexts, plus its resolved src) onto a frameId from the frame tree.
 *
 * The browsing-context index is authoritative whenever the two views agree on
 * how many children exist — it survives about:blank, srcdoc, redirects and
 * duplicate URLs. The URL is only a tie-breaker for the cases where the counts
 * disagree (a frame was attached or detached between the two reads).
 */
export function pickChildFrameId(
  children: FrameCandidate[],
  hint: FrameMatchHint,
): { frameId: number; matchedBy: 'index' | 'url' } | null {
  const urlMatches = hint.src ? children.filter((c) => urlsMatch(c.url, hint.src)) : [];
  const byIndex =
    hint.index >= 0 && children.length === hint.total ? children[hint.index] : undefined;

  if (byIndex) {
    if (urlMatches.length === 1 && urlMatches[0].frameId !== byIndex.frameId) {
      return { frameId: urlMatches[0].frameId, matchedBy: 'url' };
    }
    return { frameId: byIndex.frameId, matchedBy: 'index' };
  }

  if (urlMatches.length === 1) return { frameId: urlMatches[0].frameId, matchedBy: 'url' };
  return null;
}

async function pingFrame(tabId: number, frameId: number, timeoutMs = 3_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response: { ready?: boolean } | undefined = await browser.tabs.sendMessage(
        tabId,
        { type: 'browser-cli-ping' },
        { frameId },
      );
      if (response?.ready) return true;
    } catch {
      /* frame not injected yet */
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Resolve `frame <selector>` against the currently focused frame, so nested
 * switches compose (`frame #outer` then `frame #inner`).
 */
export async function resolveFrameBySelector(
  tabId: number,
  selector: string,
): Promise<{ frameId: number; matchedBy: 'index' | 'url' }> {
  const parentFrameId = await getFocusedFrameId(tabId);

  const response = await sendToContentScript(
    tabId,
    {
      type: 'browser-cli-command',
      id: `frame-resolve-${Date.now()}`,
      command: { action: 'resolveFrame', params: { selector } },
    },
    { frameId: parentFrameId },
  );
  if (!response.success) {
    throw new BrowserCliError(
      (response.error?.code as ErrorCode | undefined) ?? 'FRAME_ERROR',
      response.error?.message ?? `No frame element matches "${selector}".`,
      response.error?.hint ?? "Run 'frame list' to see the frames on this page.",
    );
  }
  const hint = response.data as ResolveFrameResult;

  const raw = await getAllFrames(tabId);
  const children = raw.filter((f) => f.parentFrameId === parentFrameId);
  if (children.length === 0) {
    throw new BrowserCliError(
      'FRAME_ERROR',
      `The frame element "${selector}" exists but the browser reports no child frames for the current frame.`,
      "The iframe may not have loaded yet — 'wait 500' and retry, or run 'frame list'.",
    );
  }

  const picked = pickChildFrameId(children, hint);
  if (!picked) {
    throw new BrowserCliError(
      'FRAME_ERROR',
      `Could not map "${selector}" to a frame: the document reports ${hint.total} child frame(s) but the browser reports ${children.length}, and the URL "${hint.src || '(none)'}" matched no single frame.`,
      "Run 'frame list' and switch by frameId instead, e.g. 'frame 3'.",
    );
  }

  if (!(await pingFrame(tabId, picked.frameId))) {
    throw new BrowserCliError(
      'FRAME_ERROR',
      `Frame ${picked.frameId} ("${selector}") has no reachable content script${hint.srcdoc ? ' — srcdoc frames are not injectable' : ''}.`,
      "Frames without a document (srcdoc, PDF, error pages) cannot be automated. Run 'frame list' to see which frames are reachable.",
    );
  }

  return picked;
}

// ─── Command routing ────────────────────────────────────────────────

/**
 * The frameId every content-script command should be delivered to.
 * Throws once when the focus was invalidated, then falls back to the main
 * frame, so a stale focus never silently retargets the top document.
 */
export async function resolveCommandFrameId(tabId: number): Promise<number> {
  await hydrate();

  const notice = noticeByTab.get(tabId);
  if (notice) {
    noticeByTab.delete(tabId);
    persist();
    throw new BrowserCliError(
      'FRAME_ERROR',
      notice,
      "The focus is back on the main frame — re-run this command to act on the top document, or run 'frame list' / 'frame <selector>' to focus a frame again.",
    );
  }

  const frameId = focusByTab.get(tabId) ?? MAIN_FRAME_ID;
  if (frameId === MAIN_FRAME_ID) return MAIN_FRAME_ID;

  const raw = await getAllFrames(tabId).catch(() => null);
  if (raw && !raw.some((f) => f.frameId === frameId)) {
    focusByTab.delete(tabId);
    persist();
    throw new BrowserCliError(
      'FRAME_ERROR',
      `The focused frame ${frameId} no longer exists — it was removed from the page.`,
      "The focus is back on the main frame — re-run this command, or run 'frame list' to pick a frame that still exists.",
    );
  }

  return frameId;
}

// ─── Viewport offsets (for CDP input) ───────────────────────────────

/**
 * Chain of (host frame, child browsing-context index) pairs from the main
 * frame down to `frameId`.
 */
export async function getFrameChain(
  tabId: number,
  frameId: number,
): Promise<Array<{ hostFrameId: number; childIndex: number }>> {
  const raw = await getAllFrames(tabId);
  const byId = new Map(raw.map((f) => [f.frameId, f]));
  const chain: Array<{ hostFrameId: number; childIndex: number }> = [];

  let current = byId.get(frameId);
  while (current && current.frameId !== MAIN_FRAME_ID) {
    const parentId = current.parentFrameId;
    const siblings = raw.filter((f) => f.parentFrameId === parentId);
    const childIndex = siblings.findIndex((f) => f.frameId === current?.frameId);
    if (childIndex < 0) return [];
    chain.unshift({ hostFrameId: parentId, childIndex });
    current = byId.get(parentId);
    if (chain.length > 16) return [];
  }
  return chain;
}

/**
 * Viewport-relative origin of a frame's content box in the top-level document.
 * CDP `Input.dispatch*` coordinates are top-level viewport coordinates, while
 * `getBoundingClientRect()` inside an iframe is frame-relative — this walks the
 * ancestor chain and sums the offsets to bridge the two.
 */
export async function getFrameViewportOffset(
  tabId: number,
  frameId: number,
): Promise<{ x: number; y: number }> {
  const chain = await getFrameChain(tabId, frameId);
  if (chain.length === 0) {
    throw new BrowserCliError(
      'UNSUPPORTED',
      `--debugger cannot compute page coordinates for frame ${frameId}: its position in the frame tree could not be resolved.`,
      'Drop --debugger to use synthetic events, which are dispatched inside the frame and need no coordinates.',
    );
  }

  const measure = async (
    hostFrameId: number,
    childIndex: number,
    scroll: boolean,
  ): Promise<FrameOffsetResult> => {
    const response = await sendToContentScript(
      tabId,
      {
        type: 'browser-cli-command',
        id: `frame-offset-${hostFrameId}-${Date.now()}`,
        command: { action: 'frameOffset', params: { index: childIndex, scroll } },
      },
      { frameId: hostFrameId },
    );
    if (!response.success) {
      throw new BrowserCliError(
        'UNSUPPORTED',
        `--debugger cannot compute page coordinates for frame ${frameId}: ${response.error?.message ?? 'the parent frame did not report the iframe position'}.`,
        'Drop --debugger to use synthetic events, which are dispatched inside the frame and need no coordinates.',
      );
    }
    return response.data as FrameOffsetResult;
  };

  // Scroll every ancestor iframe into view before measuring, otherwise the
  // computed point can land outside the top-level viewport.
  for (const link of chain) {
    await measure(link.hostFrameId, link.childIndex, true);
  }

  let x = 0;
  let y = 0;
  for (const link of chain) {
    const offset = await measure(link.hostFrameId, link.childIndex, false);
    if (offset.scaled) {
      throw new BrowserCliError(
        'UNSUPPORTED',
        `--debugger cannot compute page coordinates for frame ${frameId}: an ancestor iframe has a CSS transform that scales or rotates it.`,
        'Drop --debugger to use synthetic events, which are dispatched inside the frame and need no coordinates.',
      );
    }
    x += offset.x;
    y += offset.y;
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new BrowserCliError(
      'UNSUPPORTED',
      `--debugger cannot compute page coordinates for frame ${frameId}.`,
      'Drop --debugger to use synthetic events, which are dispatched inside the frame and need no coordinates.',
    );
  }

  return { x, y };
}
