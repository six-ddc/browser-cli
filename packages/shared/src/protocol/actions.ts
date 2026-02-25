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

// ─── Action Type Union ───────────────────────────────────────────────

export type ActionType =
  // Navigation
  | 'navigate'
  | 'goBack'
  | 'goForward'
  | 'reload'
  | 'getUrl'
  | 'getTitle'
  // Interaction
  | 'click'
  | 'dblclick'
  | 'hover'
  | 'fill'
  | 'type'
  | 'press'
  | 'clear'
  | 'focus'
  | 'drag'
  | 'keydown'
  | 'keyup'
  // Mouse
  | 'mouseMove'
  | 'mouseDown'
  | 'mouseUp'
  | 'mouseWheel'
  // Form
  | 'check'
  | 'uncheck'
  | 'select'
  | 'upload'
  // Scroll
  | 'scroll'
  | 'scrollIntoView'
  // Data queries
  | 'getText'
  | 'getHtml'
  | 'getValue'
  | 'getAttribute'
  | 'isVisible'
  | 'isEnabled'
  | 'isChecked'
  | 'count'
  | 'boundingBox'
  // Snapshot
  | 'snapshot'
  // Screenshot
  | 'screenshot'
  // Wait
  | 'wait'
  | 'waitForUrl'
  // Evaluate
  | 'evaluate'
  // Console
  | 'getConsole'
  | 'getErrors'
  // Tabs
  | 'tabNew'
  | 'tabList'
  | 'tabSwitch'
  | 'tabClose'
  // Cookies
  | 'cookiesGet'
  | 'cookiesSet'
  | 'cookiesClear'
  // Storage
  | 'storageGet'
  | 'storageSet'
  | 'storageClear'
  // Dialog
  | 'dialogAccept'
  | 'dialogDismiss'
  // Highlight
  | 'highlight'
  // Frames
  | 'switchFrame'
  | 'listFrames'
  | 'getCurrentFrame'
  // Network
  | 'route'
  | 'unroute'
  | 'getRequests'
  | 'getRoutes'
  | 'clearRequests'
  // Window
  | 'windowNew'
  | 'windowList'
  | 'windowClose'
  | 'windowFocus'
  // Tab Groups
  | 'tabGroupCreate'
  | 'tabGroupUpdate'
  | 'tabGroupList'
  | 'tabUngroup'
  // Bookmarks
  | 'bookmarkAdd'
  | 'bookmarkRemove'
  | 'bookmarkList'
  // History
  | 'historySearch'
  // Browser Config
  | 'setViewport'
  | 'setGeo'
  | 'setMedia'
  | 'setHeaders'
  // State Management
  | 'stateExport'
  | 'stateImport'
  // Markdown
  | 'markdown';

/**
 * Discriminated union of all commands.
 * Each variant pairs an action type with its params.
 */
export type Command =
  | { action: 'navigate'; params: NavigateParams }
  | { action: 'goBack'; params: GoBackParams }
  | { action: 'goForward'; params: GoForwardParams }
  | { action: 'reload'; params: ReloadParams }
  | { action: 'getUrl'; params: GetUrlParams }
  | { action: 'getTitle'; params: GetTitleParams }
  | { action: 'click'; params: ClickParams }
  | { action: 'dblclick'; params: DblClickParams }
  | { action: 'hover'; params: HoverParams }
  | { action: 'fill'; params: FillParams }
  | { action: 'type'; params: TypeParams }
  | { action: 'press'; params: PressParams }
  | { action: 'clear'; params: ClearParams }
  | { action: 'focus'; params: FocusParams }
  | { action: 'drag'; params: DragParams }
  | { action: 'keydown'; params: KeyDownParams }
  | { action: 'keyup'; params: KeyUpParams }
  | { action: 'mouseMove'; params: MouseMoveParams }
  | { action: 'mouseDown'; params: MouseDownParams }
  | { action: 'mouseUp'; params: MouseUpParams }
  | { action: 'mouseWheel'; params: MouseWheelParams }
  | { action: 'check'; params: CheckParams }
  | { action: 'uncheck'; params: UncheckParams }
  | { action: 'select'; params: SelectParams }
  | { action: 'upload'; params: UploadParams }
  | { action: 'scroll'; params: ScrollParams }
  | { action: 'scrollIntoView'; params: ScrollIntoViewParams }
  | { action: 'getText'; params: GetTextParams }
  | { action: 'getHtml'; params: GetHtmlParams }
  | { action: 'getValue'; params: GetValueParams }
  | { action: 'getAttribute'; params: GetAttributeParams }
  | { action: 'isVisible'; params: IsVisibleParams }
  | { action: 'isEnabled'; params: IsEnabledParams }
  | { action: 'isChecked'; params: IsCheckedParams }
  | { action: 'count'; params: CountParams }
  | { action: 'boundingBox'; params: BoundingBoxParams }
  | { action: 'snapshot'; params: SnapshotParams }
  | { action: 'screenshot'; params: ScreenshotParams }
  | { action: 'wait'; params: WaitParams }
  | { action: 'waitForUrl'; params: WaitForUrlParams }
  | { action: 'evaluate'; params: EvaluateParams }
  | { action: 'getConsole'; params: GetConsoleParams }
  | { action: 'getErrors'; params: GetErrorsParams }
  | { action: 'tabNew'; params: TabNewParams }
  | { action: 'tabList'; params: TabListParams }
  | { action: 'tabSwitch'; params: TabSwitchParams }
  | { action: 'tabClose'; params: TabCloseParams }
  | { action: 'cookiesGet'; params: CookiesGetParams }
  | { action: 'cookiesSet'; params: CookiesSetParams }
  | { action: 'cookiesClear'; params: CookiesClearParams }
  | { action: 'storageGet'; params: StorageGetParams }
  | { action: 'storageSet'; params: StorageSetParams }
  | { action: 'storageClear'; params: StorageClearParams }
  | { action: 'dialogAccept'; params: DialogAcceptParams }
  | { action: 'dialogDismiss'; params: DialogDismissParams }
  | { action: 'highlight'; params: HighlightParams }
  | { action: 'switchFrame'; params: SwitchFrameParams }
  | { action: 'listFrames'; params: ListFramesParams }
  | { action: 'getCurrentFrame'; params: GetCurrentFrameParams }
  | { action: 'route'; params: RouteParams }
  | { action: 'unroute'; params: UnrouteParams }
  | { action: 'getRequests'; params: GetRequestsParams }
  | { action: 'getRoutes'; params: GetRoutesParams }
  | { action: 'clearRequests'; params: ClearRequestsParams }
  | { action: 'windowNew'; params: WindowNewParams }
  | { action: 'windowList'; params: WindowListParams }
  | { action: 'windowClose'; params: WindowCloseParams }
  | { action: 'windowFocus'; params: WindowFocusParams }
  | { action: 'tabGroupCreate'; params: TabGroupCreateParams }
  | { action: 'tabGroupUpdate'; params: TabGroupUpdateParams }
  | { action: 'tabGroupList'; params: TabGroupListParams }
  | { action: 'tabUngroup'; params: TabUngroupParams }
  | { action: 'bookmarkAdd'; params: BookmarkAddParams }
  | { action: 'bookmarkRemove'; params: BookmarkRemoveParams }
  | { action: 'bookmarkList'; params: BookmarkListParams }
  | { action: 'historySearch'; params: HistorySearchParams }
  | { action: 'setViewport'; params: SetViewportParams }
  | { action: 'setGeo'; params: SetGeoParams }
  | { action: 'setMedia'; params: SetMediaParams }
  | { action: 'setHeaders'; params: SetHeadersParams }
  | { action: 'stateExport'; params: StateExportParams }
  | { action: 'stateImport'; params: StateImportParams }
  | { action: 'markdown'; params: MarkdownParams };

/** Map action type → result type */
export interface ActionResultMap {
  navigate: NavigateResult;
  goBack: GoBackResult;
  goForward: GoForwardResult;
  reload: ReloadResult;
  getUrl: GetUrlResult;
  getTitle: GetTitleResult;
  click: ClickResult;
  dblclick: DblClickResult;
  hover: HoverResult;
  fill: FillResult;
  type: TypeResult;
  press: PressResult;
  clear: ClearResult;
  focus: FocusResult;
  drag: DragResult;
  keydown: KeyDownResult;
  keyup: KeyUpResult;
  mouseMove: MouseMoveResult;
  mouseDown: MouseDownResult;
  mouseUp: MouseUpResult;
  mouseWheel: MouseWheelResult;
  check: CheckResult;
  uncheck: UncheckResult;
  select: SelectResult;
  upload: UploadResult;
  scroll: ScrollResult;
  scrollIntoView: ScrollIntoViewResult;
  getText: GetTextResult;
  getHtml: GetHtmlResult;
  getValue: GetValueResult;
  getAttribute: GetAttributeResult;
  isVisible: IsVisibleResult;
  isEnabled: IsEnabledResult;
  isChecked: IsCheckedResult;
  count: CountResult;
  boundingBox: BoundingBoxResult;
  snapshot: SnapshotResult;
  screenshot: ScreenshotResult;
  wait: WaitResult;
  waitForUrl: WaitForUrlResult;
  evaluate: EvaluateResult;
  getConsole: GetConsoleResult;
  getErrors: GetErrorsResult;
  tabNew: TabNewResult;
  tabList: TabListResult;
  tabSwitch: TabSwitchResult;
  tabClose: TabCloseResult;
  cookiesGet: CookiesGetResult;
  cookiesSet: CookiesSetResult;
  cookiesClear: CookiesClearResult;
  storageGet: StorageGetResult;
  storageSet: StorageSetResult;
  storageClear: StorageClearResult;
  dialogAccept: DialogAcceptResult;
  dialogDismiss: DialogDismissResult;
  highlight: HighlightResult;
  switchFrame: SwitchFrameResult;
  listFrames: ListFramesResult;
  getCurrentFrame: GetCurrentFrameResult;
  route: RouteResult;
  unroute: UnrouteResult;
  getRequests: GetRequestsResult;
  getRoutes: GetRoutesResult;
  clearRequests: ClearRequestsResult;
  windowNew: WindowNewResult;
  windowList: WindowListResult;
  windowClose: WindowCloseResult;
  windowFocus: WindowFocusResult;
  tabGroupCreate: TabGroupCreateResult;
  tabGroupUpdate: TabGroupUpdateResult;
  tabGroupList: TabGroupListResult;
  tabUngroup: TabUngroupResult;
  bookmarkAdd: BookmarkAddResult;
  bookmarkRemove: BookmarkRemoveResult;
  bookmarkList: BookmarkListResult;
  historySearch: HistorySearchResult;
  setViewport: SetViewportResult;
  setGeo: SetGeoResult;
  setMedia: SetMediaResult;
  setHeaders: SetHeadersResult;
  stateExport: StateExportResult;
  stateImport: StateImportResult;
  markdown: MarkdownResult;
}
