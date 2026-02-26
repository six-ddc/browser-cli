/**
 * All action types, their parameter types (derived from Zod schemas), and result interfaces.
 * Actions are the commands that flow from CLI → Daemon → Extension.
 */

import type { z } from 'zod';
import type * as schemas from './schemas.js';

// ─── Navigation ──────────────────────────────────────────────────────

export type NavigateParams = z.infer<typeof schemas.navigateParamsSchema>;
export interface NavigateResult {
  url: string;
  title: string;
}

export type GoBackParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface GoBackResult {
  url: string;
  title: string;
}

export type GoForwardParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface GoForwardResult {
  url: string;
  title: string;
}

export type ReloadParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface ReloadResult {
  url: string;
  title: string;
}

export type GetUrlParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface GetUrlResult {
  url: string;
}

export type GetTitleParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface GetTitleResult {
  title: string;
}

// ─── Interaction ─────────────────────────────────────────────────────

export type ClickParams = z.infer<typeof schemas.clickParamsSchema>;
export interface ClickResult {
  clicked: true;
}

export type DblClickParams = z.infer<typeof schemas.dblclickParamsSchema>;
export interface DblClickResult {
  clicked: true;
}

export type HoverParams = z.infer<typeof schemas.hoverParamsSchema>;
export interface HoverResult {
  hovered: true;
}

export type FillParams = z.infer<typeof schemas.fillParamsSchema>;
export interface FillResult {
  filled: true;
}

export type TypeParams = z.infer<typeof schemas.typeParamsSchema>;
export interface TypeResult {
  typed: true;
}

export type PressParams = z.infer<typeof schemas.pressParamsSchema>;
export interface PressResult {
  pressed: true;
}

export type ClearParams = z.infer<typeof schemas.clearParamsSchema>;
export interface ClearResult {
  cleared: true;
}

export type FocusParams = z.infer<typeof schemas.focusParamsSchema>;
export interface FocusResult {
  focused: true;
}

// ─── Form ────────────────────────────────────────────────────────────

export type CheckParams = z.infer<typeof schemas.checkParamsSchema>;
export interface CheckResult {
  checked: true;
}

export type UncheckParams = z.infer<typeof schemas.uncheckParamsSchema>;
export interface UncheckResult {
  unchecked: true;
}

export type SelectParams = z.infer<typeof schemas.selectParamsSchema>;
export interface SelectResult {
  selected: true;
  value: string;
}

export type UploadParams = z.infer<typeof schemas.uploadParamsSchema>;
export interface UploadResult {
  uploaded: true;
  fileCount: number;
}

// ─── Scroll ──────────────────────────────────────────────────────────

export type ScrollParams = z.infer<typeof schemas.scrollParamsSchema>;
export interface ScrollResult {
  scrolled: true;
}

export type ScrollIntoViewParams = z.infer<typeof schemas.scrollIntoViewParamsSchema>;
export interface ScrollIntoViewResult {
  scrolled: true;
}

// ─── Data Queries ────────────────────────────────────────────────────

export type GetTextParams = z.infer<typeof schemas.getTextParamsSchema>;
export interface GetTextResult {
  text: string;
}

export type GetHtmlParams = z.infer<typeof schemas.getHtmlParamsSchema>;
export interface GetHtmlResult {
  html: string;
}

export type GetValueParams = z.infer<typeof schemas.getValueParamsSchema>;
export interface GetValueResult {
  value: string;
}

export type GetAttributeParams = z.infer<typeof schemas.getAttributeParamsSchema>;
export interface GetAttributeResult {
  value: string | null;
}

export type IsVisibleParams = z.infer<typeof schemas.isVisibleParamsSchema>;
export interface IsVisibleResult {
  visible: boolean;
}

export type IsEnabledParams = z.infer<typeof schemas.isEnabledParamsSchema>;
export interface IsEnabledResult {
  enabled: boolean;
}

export type IsCheckedParams = z.infer<typeof schemas.isCheckedParamsSchema>;
export interface IsCheckedResult {
  checked: boolean;
}

export type CountParams = z.infer<typeof schemas.countParamsSchema>;
export interface CountResult {
  count: number;
}

export type BoundingBoxParams = z.infer<typeof schemas.boundingBoxParamsSchema>;
export interface BoundingBoxResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Snapshot ────────────────────────────────────────────────────────

export type SnapshotParams = z.infer<typeof schemas.snapshotParamsSchema>;
export interface SnapshotResult {
  snapshot: string;
  refCount: number;
}

// ─── Screenshot ──────────────────────────────────────────────────────

export type ScreenshotParams = z.infer<typeof schemas.screenshotParamsSchema>;
export interface ScreenshotResult {
  /** Base64-encoded image data */
  data: string;
  /** MIME type */
  mimeType: string;
  /** Image width */
  width: number;
  /** Image height */
  height: number;
}

// ─── Drag and Drop ───────────────────────────────────────────────────

export type DragParams = z.infer<typeof schemas.dragParamsSchema>;
export interface DragResult {
  dragged: true;
}

// ─── Key Down/Up ────────────────────────────────────────────────────

export type KeyDownParams = z.infer<typeof schemas.keydownParamsSchema>;
export interface KeyDownResult {
  pressed: true;
}

export type KeyUpParams = z.infer<typeof schemas.keyupParamsSchema>;
export interface KeyUpResult {
  released: true;
}

// ─── Mouse Control ──────────────────────────────────────────────────

export type MouseMoveParams = z.infer<typeof schemas.mouseMoveParamsSchema>;
export interface MouseMoveResult {
  moved: true;
}

export type MouseDownParams = z.infer<typeof schemas.mouseDownParamsSchema>;
export interface MouseDownResult {
  pressed: true;
}

export type MouseUpParams = z.infer<typeof schemas.mouseUpParamsSchema>;
export interface MouseUpResult {
  released: true;
}

export type MouseWheelParams = z.infer<typeof schemas.mouseWheelParamsSchema>;
export interface MouseWheelResult {
  scrolled: true;
}

// ─── Wait ────────────────────────────────────────────────────────────

export type WaitParams = z.infer<typeof schemas.waitParamsSchema>;
export interface WaitResult {
  found: true;
}

export type WaitForUrlParams = z.infer<typeof schemas.waitForUrlParamsSchema>;
export interface WaitForUrlResult {
  url: string;
}

// ─── Evaluate ────────────────────────────────────────────────────────

export type EvaluateParams = z.infer<typeof schemas.evaluateParamsSchema>;
export interface EvaluateResult {
  value: unknown;
  /** Console output captured during evaluation (for debugging). */
  logs?: ConsoleEntry[];
}

// ─── Console ─────────────────────────────────────────────────────────

export type GetConsoleParams = z.infer<typeof schemas.getConsoleParamsSchema>;
export interface GetConsoleResult {
  entries: ConsoleEntry[];
}

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: unknown[];
  timestamp: number;
}

export type GetErrorsParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface GetErrorsResult {
  errors: ConsoleEntry[];
}

// ─── Tab Management ──────────────────────────────────────────────────

export type TabNewParams = z.infer<typeof schemas.tabNewParamsSchema>;
export interface TabNewResult {
  tabId: number;
  url: string;
  groupId?: number;
  groupName?: string;
}

export type TabListParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface TabListResult {
  tabs: TabInfo[];
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
}

export type TabSwitchParams = z.infer<typeof schemas.tabSwitchParamsSchema>;
export interface TabSwitchResult {
  tabId: number;
  url: string;
  title: string;
}

export type TabCloseParams = z.infer<typeof schemas.tabCloseParamsSchema>;
export interface TabCloseResult {
  closed: true;
}

// ─── Cookies ─────────────────────────────────────────────────────────

export type CookiesGetParams = z.infer<typeof schemas.cookiesGetParamsSchema>;
export interface CookiesGetResult {
  cookies: CookieInfo[];
}

export interface CookieInfo {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expirationDate?: number;
}

export type CookiesSetParams = z.infer<typeof schemas.cookiesSetParamsSchema>;
export interface CookiesSetResult {
  set: true;
}

export type CookiesClearParams = z.infer<typeof schemas.cookiesClearParamsSchema>;
export interface CookiesClearResult {
  cleared: number;
}

// ─── Storage ─────────────────────────────────────────────────────────

export type StorageGetParams = z.infer<typeof schemas.storageGetParamsSchema>;
export interface StorageGetResult {
  entries: Record<string, string>;
}

export type StorageSetParams = z.infer<typeof schemas.storageSetParamsSchema>;
export interface StorageSetResult {
  set: true;
}

export type StorageClearParams = z.infer<typeof schemas.storageClearParamsSchema>;
export interface StorageClearResult {
  cleared: true;
}

// ─── Dialog ──────────────────────────────────────────────────────────

export type DialogAcceptParams = z.infer<typeof schemas.dialogAcceptParamsSchema>;
export interface DialogAcceptResult {
  accepted: true;
}

export type DialogDismissParams = z.infer<typeof schemas.dialogDismissParamsSchema>;
export interface DialogDismissResult {
  dismissed: true;
}

// ─── Highlight ───────────────────────────────────────────────────────

export type HighlightParams = z.infer<typeof schemas.highlightParamsSchema>;
export interface HighlightResult {
  highlighted: true;
}

// ─── Frame Management ────────────────────────────────────────────────

export type SwitchFrameParams = z.infer<typeof schemas.switchFrameParamsSchema>;
export interface SwitchFrameResult {
  frameIndex: number;
  frame: {
    index: number;
    name: string | null;
    src: string;
    isMainFrame: boolean;
    isSameOrigin: boolean;
  };
}

export type ListFramesParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface ListFramesResult {
  currentFrame: number;
  frames: Array<{
    index: number;
    name: string | null;
    src: string;
    isMainFrame: boolean;
    isSameOrigin: boolean;
  }>;
}

export type GetCurrentFrameParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface GetCurrentFrameResult {
  frameIndex: number;
  frame: {
    index: number;
    name: string | null;
    src: string;
    isMainFrame: boolean;
    isSameOrigin: boolean;
  };
}

// ─── Network ─────────────────────────────────────────────────────────

export type RouteParams = z.infer<typeof schemas.routeParamsSchema>;
export interface RouteResult {
  routeId: number;
  pattern: string;
  action: 'block' | 'redirect';
}

export type UnrouteParams = z.infer<typeof schemas.unrouteParamsSchema>;
export interface UnrouteResult {
  removed: true;
}

export type GetRequestsParams = z.infer<typeof schemas.getRequestsParamsSchema>;
export interface GetRequestsResult {
  requests: Array<{
    id: string;
    url: string;
    method: string;
    type: string;
    timestamp: number;
    tabId: number;
    blocked?: boolean;
    redirectedTo?: string;
  }>;
  total: number;
}

export type GetRoutesParams = z.infer<typeof schemas.getRoutesParamsSchema>;
export interface GetRoutesResult {
  routes: Array<{
    id: number;
    pattern: string;
    action: 'block' | 'redirect';
    redirectUrl?: string;
    createdAt: number;
  }>;
}

export type ClearRequestsParams = z.infer<typeof schemas.clearRequestsParamsSchema>;
export interface ClearRequestsResult {
  cleared: number;
}

// ─── Window Management ──────────────────────────────────────────────

export type WindowNewParams = z.infer<typeof schemas.windowNewParamsSchema>;
export interface WindowNewResult {
  windowId: number;
  tabId: number;
  url: string;
}

export type WindowListParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface WindowListResult {
  windows: WindowInfo[];
}

export interface WindowInfo {
  id: number;
  focused: boolean;
  type: string;
  tabs: number;
}

export type WindowCloseParams = z.infer<typeof schemas.windowCloseParamsSchema>;
export interface WindowCloseResult {
  closed: true;
}

export type WindowFocusParams = z.infer<typeof schemas.windowFocusParamsSchema>;
export interface WindowFocusResult {
  windowId: number;
  focused: true;
}

// ─── Tab Group Management ────────────────────────────────────────────

export type TabGroupCreateParams = z.infer<typeof schemas.tabGroupCreateParamsSchema>;
export interface TabGroupCreateResult {
  groupId: number;
  tabCount: number;
}

export type TabGroupUpdateParams = z.infer<typeof schemas.tabGroupUpdateParamsSchema>;
export interface TabGroupUpdateResult {
  groupId: number;
  title: string | null;
  color: string;
}

export type TabGroupListParams = z.infer<typeof schemas.tabGroupListParamsSchema>;
export interface TabGroupListResult {
  groups: TabGroupInfo[];
}

export interface TabGroupInfo {
  id: number;
  title: string | null;
  color: string;
  collapsed: boolean;
  windowId: number;
  tabCount: number;
}

export type TabUngroupParams = z.infer<typeof schemas.tabUngroupParamsSchema>;
export interface TabUngroupResult {
  ungrouped: number;
}

// ─── Bookmarks ───────────────────────────────────────────────────────

export type BookmarkAddParams = z.infer<typeof schemas.bookmarkAddParamsSchema>;
export interface BookmarkAddResult {
  id: string;
  url: string;
  title: string;
}

export type BookmarkRemoveParams = z.infer<typeof schemas.bookmarkRemoveParamsSchema>;
export interface BookmarkRemoveResult {
  removed: true;
}

export type BookmarkListParams = z.infer<typeof schemas.bookmarkListParamsSchema>;
export interface BookmarkListResult {
  bookmarks: BookmarkInfo[];
  total: number;
}

export interface BookmarkInfo {
  id: string;
  url: string;
  title: string;
  dateAdded?: number;
}

// ─── History ─────────────────────────────────────────────────────────

export type HistorySearchParams = z.infer<typeof schemas.historySearchParamsSchema>;
export interface HistorySearchResult {
  entries: HistoryEntry[];
  total: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  lastVisitTime?: number;
  visitCount?: number;
}

// ─── Browser Config ─────────────────────────────────────────────────

export type SetViewportParams = z.infer<typeof schemas.setViewportParamsSchema>;
export interface SetViewportResult {
  set: true;
  width: number;
  height: number;
}

export type SetGeoParams = z.infer<typeof schemas.setGeoParamsSchema>;
export interface SetGeoResult {
  set: true;
}

export type SetMediaParams = z.infer<typeof schemas.setMediaParamsSchema>;
export interface SetMediaResult {
  set: true;
}

export type SetHeadersParams = z.infer<typeof schemas.setHeadersParamsSchema>;
export interface SetHeadersResult {
  set: true;
  ruleCount: number;
}

// ─── State Management ───────────────────────────────────────────────

export type StateExportParams = z.infer<typeof schemas.stateExportParamsSchema>;
export interface StateExportResult {
  url: string;
  cookies: CookieInfo[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export type StateImportParams = z.infer<typeof schemas.stateImportParamsSchema>;
export interface StateImportResult {
  imported: { cookies: number; localStorage: number; sessionStorage: number };
}

// ─── Container (Firefox contextualIdentities) ──────────────────────

export type ContainerListParams = z.infer<typeof schemas.containerListParamsSchema>;
export interface ContainerInfo {
  name: string;
  color: string;
  icon: string;
  cookieStoreId: string;
}
export interface ContainerListResult {
  containers: ContainerInfo[];
}

export type ContainerCreateParams = z.infer<typeof schemas.containerCreateParamsSchema>;
export interface ContainerCreateResult {
  name: string;
  color: string;
  icon: string;
  cookieStoreId: string;
}

export type ContainerRemoveParams = z.infer<typeof schemas.containerRemoveParamsSchema>;
export interface ContainerRemoveResult {
  removed: true;
}

// ─── Markdown ───────────────────────────────────────────────────────
export type MarkdownParams = z.infer<typeof schemas.emptyParamsSchema>;
export interface MarkdownResult {
  title: string;
  markdown: string;
  /** Author if detected */
  byline: string | null;
  /** Description/excerpt if detected */
  excerpt: string | null;
}

/** Raw HTML returned by extension for CLI-side extraction */
export interface MarkdownRawResult {
  html: string;
  url: string;
}

// ─── Action Definition (Single Source of Truth) ─────────────────────

/**
 * Discriminated union of all actions.
 * Each variant pairs an action type with its params and result.
 * Command, ActionType, ActionParamsMap, and ActionResultMap are all derived from this.
 */
export type ActionDef =
  // Navigation
  | { action: 'navigate'; params: NavigateParams; result: NavigateResult }
  | { action: 'goBack'; params: GoBackParams; result: GoBackResult }
  | { action: 'goForward'; params: GoForwardParams; result: GoForwardResult }
  | { action: 'reload'; params: ReloadParams; result: ReloadResult }
  | { action: 'getUrl'; params: GetUrlParams; result: GetUrlResult }
  | { action: 'getTitle'; params: GetTitleParams; result: GetTitleResult }
  // Interaction
  | { action: 'click'; params: ClickParams; result: ClickResult }
  | { action: 'dblclick'; params: DblClickParams; result: DblClickResult }
  | { action: 'hover'; params: HoverParams; result: HoverResult }
  | { action: 'fill'; params: FillParams; result: FillResult }
  | { action: 'type'; params: TypeParams; result: TypeResult }
  | { action: 'press'; params: PressParams; result: PressResult }
  | { action: 'clear'; params: ClearParams; result: ClearResult }
  | { action: 'focus'; params: FocusParams; result: FocusResult }
  | { action: 'drag'; params: DragParams; result: DragResult }
  | { action: 'keydown'; params: KeyDownParams; result: KeyDownResult }
  | { action: 'keyup'; params: KeyUpParams; result: KeyUpResult }
  // Mouse
  | { action: 'mouseMove'; params: MouseMoveParams; result: MouseMoveResult }
  | { action: 'mouseDown'; params: MouseDownParams; result: MouseDownResult }
  | { action: 'mouseUp'; params: MouseUpParams; result: MouseUpResult }
  | { action: 'mouseWheel'; params: MouseWheelParams; result: MouseWheelResult }
  // Form
  | { action: 'check'; params: CheckParams; result: CheckResult }
  | { action: 'uncheck'; params: UncheckParams; result: UncheckResult }
  | { action: 'select'; params: SelectParams; result: SelectResult }
  | { action: 'upload'; params: UploadParams; result: UploadResult }
  // Scroll
  | { action: 'scroll'; params: ScrollParams; result: ScrollResult }
  | { action: 'scrollIntoView'; params: ScrollIntoViewParams; result: ScrollIntoViewResult }
  // Data queries
  | { action: 'getText'; params: GetTextParams; result: GetTextResult }
  | { action: 'getHtml'; params: GetHtmlParams; result: GetHtmlResult }
  | { action: 'getValue'; params: GetValueParams; result: GetValueResult }
  | { action: 'getAttribute'; params: GetAttributeParams; result: GetAttributeResult }
  | { action: 'isVisible'; params: IsVisibleParams; result: IsVisibleResult }
  | { action: 'isEnabled'; params: IsEnabledParams; result: IsEnabledResult }
  | { action: 'isChecked'; params: IsCheckedParams; result: IsCheckedResult }
  | { action: 'count'; params: CountParams; result: CountResult }
  | { action: 'boundingBox'; params: BoundingBoxParams; result: BoundingBoxResult }
  // Snapshot
  | { action: 'snapshot'; params: SnapshotParams; result: SnapshotResult }
  // Screenshot
  | { action: 'screenshot'; params: ScreenshotParams; result: ScreenshotResult }
  // Wait
  | { action: 'wait'; params: WaitParams; result: WaitResult }
  | { action: 'waitForUrl'; params: WaitForUrlParams; result: WaitForUrlResult }
  // Evaluate
  | { action: 'evaluate'; params: EvaluateParams; result: EvaluateResult }
  // Console
  | { action: 'getConsole'; params: GetConsoleParams; result: GetConsoleResult }
  | { action: 'getErrors'; params: GetErrorsParams; result: GetErrorsResult }
  // Tabs
  | { action: 'tabNew'; params: TabNewParams; result: TabNewResult }
  | { action: 'tabList'; params: TabListParams; result: TabListResult }
  | { action: 'tabSwitch'; params: TabSwitchParams; result: TabSwitchResult }
  | { action: 'tabClose'; params: TabCloseParams; result: TabCloseResult }
  // Cookies
  | { action: 'cookiesGet'; params: CookiesGetParams; result: CookiesGetResult }
  | { action: 'cookiesSet'; params: CookiesSetParams; result: CookiesSetResult }
  | { action: 'cookiesClear'; params: CookiesClearParams; result: CookiesClearResult }
  // Storage
  | { action: 'storageGet'; params: StorageGetParams; result: StorageGetResult }
  | { action: 'storageSet'; params: StorageSetParams; result: StorageSetResult }
  | { action: 'storageClear'; params: StorageClearParams; result: StorageClearResult }
  // Dialog
  | { action: 'dialogAccept'; params: DialogAcceptParams; result: DialogAcceptResult }
  | { action: 'dialogDismiss'; params: DialogDismissParams; result: DialogDismissResult }
  // Highlight
  | { action: 'highlight'; params: HighlightParams; result: HighlightResult }
  // Frames
  | { action: 'switchFrame'; params: SwitchFrameParams; result: SwitchFrameResult }
  | { action: 'listFrames'; params: ListFramesParams; result: ListFramesResult }
  | { action: 'getCurrentFrame'; params: GetCurrentFrameParams; result: GetCurrentFrameResult }
  // Network
  | { action: 'route'; params: RouteParams; result: RouteResult }
  | { action: 'unroute'; params: UnrouteParams; result: UnrouteResult }
  | { action: 'getRequests'; params: GetRequestsParams; result: GetRequestsResult }
  | { action: 'getRoutes'; params: GetRoutesParams; result: GetRoutesResult }
  | { action: 'clearRequests'; params: ClearRequestsParams; result: ClearRequestsResult }
  // Window
  | { action: 'windowNew'; params: WindowNewParams; result: WindowNewResult }
  | { action: 'windowList'; params: WindowListParams; result: WindowListResult }
  | { action: 'windowClose'; params: WindowCloseParams; result: WindowCloseResult }
  | { action: 'windowFocus'; params: WindowFocusParams; result: WindowFocusResult }
  // Tab Groups
  | { action: 'tabGroupCreate'; params: TabGroupCreateParams; result: TabGroupCreateResult }
  | { action: 'tabGroupUpdate'; params: TabGroupUpdateParams; result: TabGroupUpdateResult }
  | { action: 'tabGroupList'; params: TabGroupListParams; result: TabGroupListResult }
  | { action: 'tabUngroup'; params: TabUngroupParams; result: TabUngroupResult }
  // Bookmarks
  | { action: 'bookmarkAdd'; params: BookmarkAddParams; result: BookmarkAddResult }
  | { action: 'bookmarkRemove'; params: BookmarkRemoveParams; result: BookmarkRemoveResult }
  | { action: 'bookmarkList'; params: BookmarkListParams; result: BookmarkListResult }
  // History
  | { action: 'historySearch'; params: HistorySearchParams; result: HistorySearchResult }
  // Browser Config
  | { action: 'setViewport'; params: SetViewportParams; result: SetViewportResult }
  | { action: 'setGeo'; params: SetGeoParams; result: SetGeoResult }
  | { action: 'setMedia'; params: SetMediaParams; result: SetMediaResult }
  | { action: 'setHeaders'; params: SetHeadersParams; result: SetHeadersResult }
  // State Management
  | { action: 'stateExport'; params: StateExportParams; result: StateExportResult }
  | { action: 'stateImport'; params: StateImportParams; result: StateImportResult }
  // Container
  | { action: 'containerList'; params: ContainerListParams; result: ContainerListResult }
  | { action: 'containerCreate'; params: ContainerCreateParams; result: ContainerCreateResult }
  | { action: 'containerRemove'; params: ContainerRemoveParams; result: ContainerRemoveResult }
  // Markdown
  | { action: 'markdown'; params: MarkdownParams; result: MarkdownResult };

// ─── Derived Types ──────────────────────────────────────────────────

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

/** All action type strings */
export type ActionType = ActionDef['action'];

/** Wire command: action + params (no result) */
export type Command = DistributiveOmit<ActionDef, 'result'>;

/** Map action type → result type */
export type ActionResultMap = {
  [D in ActionDef as D['action']]: D['result'];
};

/** Map action type → params type */
export type ActionParamsMap = {
  [D in ActionDef as D['action']]: D['params'];
};
