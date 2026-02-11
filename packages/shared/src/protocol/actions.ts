/**
 * All action types, their parameter interfaces, and result interfaces.
 * Actions are the commands that flow from CLI → Daemon → Extension.
 */

// ─── Navigation ──────────────────────────────────────────────────────

export interface NavigateParams {
  url: string;
}
export interface NavigateResult {
  url: string;
  title: string;
}

export type GoBackParams = Record<string, never>;
export interface GoBackResult {
  url: string;
  title: string;
}

export type GoForwardParams = Record<string, never>;
export interface GoForwardResult {
  url: string;
  title: string;
}

export type ReloadParams = Record<string, never>;
export interface ReloadResult {
  url: string;
  title: string;
}

export type GetUrlParams = Record<string, never>;
export interface GetUrlResult {
  url: string;
}

export type GetTitleParams = Record<string, never>;
export interface GetTitleResult {
  title: string;
}

// ─── Interaction ─────────────────────────────────────────────────────

export interface ClickParams {
  selector: string;
  /** Click button: left, right, middle */
  button?: 'left' | 'right' | 'middle';
}
export interface ClickResult {
  clicked: true;
}

export interface DblClickParams {
  selector: string;
}
export interface DblClickResult {
  clicked: true;
}

export interface HoverParams {
  selector: string;
}
export interface HoverResult {
  hovered: true;
}

export interface FillParams {
  selector: string;
  value: string;
}
export interface FillResult {
  filled: true;
}

export interface TypeParams {
  selector: string;
  text: string;
  /** Delay between keystrokes in ms */
  delay?: number;
}
export interface TypeResult {
  typed: true;
}

export interface PressParams {
  /** Selector of element to press key on (defaults to active element) */
  selector?: string;
  key: string;
}
export interface PressResult {
  pressed: true;
}

export interface ClearParams {
  selector: string;
}
export interface ClearResult {
  cleared: true;
}

export interface FocusParams {
  selector: string;
}
export interface FocusResult {
  focused: true;
}

// ─── Form ────────────────────────────────────────────────────────────

export interface CheckParams {
  selector: string;
}
export interface CheckResult {
  checked: true;
}

export interface UncheckParams {
  selector: string;
}
export interface UncheckResult {
  unchecked: true;
}

export interface SelectParams {
  selector: string;
  value: string;
}
export interface SelectResult {
  selected: true;
  value: string;
}

export interface UploadParams {
  selector: string;
  files: string | string[];
  clear?: boolean;
}
export interface UploadResult {
  uploaded: true;
  fileCount: number;
}

// ─── Scroll ──────────────────────────────────────────────────────────

export interface ScrollParams {
  /** Direction: up, down, left, right */
  direction: 'up' | 'down' | 'left' | 'right';
  /** Scroll amount in pixels */
  amount?: number;
  /** Selector of element to scroll (defaults to page) */
  selector?: string;
}
export interface ScrollResult {
  scrolled: true;
}

export interface ScrollIntoViewParams {
  selector: string;
}
export interface ScrollIntoViewResult {
  scrolled: true;
}

// ─── Data Queries ────────────────────────────────────────────────────

export interface GetTextParams {
  selector: string;
}
export interface GetTextResult {
  text: string;
}

export interface GetHtmlParams {
  selector: string;
  /** Return outerHTML instead of innerHTML */
  outer?: boolean;
}
export interface GetHtmlResult {
  html: string;
}

export interface GetValueParams {
  selector: string;
}
export interface GetValueResult {
  value: string;
}

export interface GetAttributeParams {
  selector: string;
  attribute: string;
}
export interface GetAttributeResult {
  value: string | null;
}

export interface IsVisibleParams {
  selector: string;
}
export interface IsVisibleResult {
  visible: boolean;
}

export interface IsEnabledParams {
  selector: string;
}
export interface IsEnabledResult {
  enabled: boolean;
}

export interface IsCheckedParams {
  selector: string;
}
export interface IsCheckedResult {
  checked: boolean;
}

export interface CountParams {
  selector: string;
}
export interface CountResult {
  count: number;
}

export interface BoundingBoxParams {
  selector: string;
}
export interface BoundingBoxResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Snapshot ────────────────────────────────────────────────────────

export interface SnapshotParams {
  /** Only include interactive elements */
  interactive?: boolean;
  /** Compact output (fewer whitespace) */
  compact?: boolean;
  /** Include cursor-interactive elements (cursor:pointer) */
  cursor?: boolean;
  /** Max depth of tree traversal */
  depth?: number;
  /** Scope snapshot to a specific selector (CSS, @ref, or semantic locator) */
  selector?: string;
}
export interface SnapshotResult {
  snapshot: string;
  refCount: number;
}

// ─── Screenshot ──────────────────────────────────────────────────────

export interface ScreenshotParams {
  /** CSS selector for element screenshot (full page if omitted) */
  selector?: string;
  /** Image format */
  format?: 'png' | 'jpeg';
  /** JPEG quality (0-100) */
  quality?: number;
}
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

export interface DragParams {
  /** Source element selector */
  source: string;
  /** Target element selector */
  target: string;
}
export interface DragResult {
  dragged: true;
}

// ─── Key Down/Up ────────────────────────────────────────────────────

export interface KeyDownParams {
  /** Key to press down */
  key: string;
  /** Selector of element (defaults to active element) */
  selector?: string;
}
export interface KeyDownResult {
  pressed: true;
}

export interface KeyUpParams {
  /** Key to release */
  key: string;
  /** Selector of element (defaults to active element) */
  selector?: string;
}
export interface KeyUpResult {
  released: true;
}

// ─── Mouse Control ──────────────────────────────────────────────────

export interface MouseMoveParams {
  x: number;
  y: number;
}
export interface MouseMoveResult {
  moved: true;
}

export interface MouseDownParams {
  button?: 'left' | 'right' | 'middle';
}
export interface MouseDownResult {
  pressed: true;
}

export interface MouseUpParams {
  button?: 'left' | 'right' | 'middle';
}
export interface MouseUpResult {
  released: true;
}

export interface MouseWheelParams {
  /** Vertical scroll delta (positive = down) */
  deltaY: number;
  /** Horizontal scroll delta (positive = right) */
  deltaX?: number;
}
export interface MouseWheelResult {
  scrolled: true;
}

// ─── Wait ────────────────────────────────────────────────────────────

export interface WaitParams {
  /** CSS selector to wait for (optional if duration is provided) */
  selector?: string;
  /** Duration to wait in ms (for time-based delays) */
  duration?: number;
  /** Timeout in ms (only used with selector) */
  timeout?: number;
  /** Wait until visible (default true, only used with selector) */
  visible?: boolean;
  /** Wait for text content to appear on the page */
  text?: string;
  /** Wait for document load state: load, domcontentloaded, networkidle */
  load?: 'load' | 'domcontentloaded' | 'networkidle';
  /** Wait for a JavaScript function/expression to return truthy (evaluated in MAIN world) */
  fn?: string;
}
export interface WaitResult {
  found: true;
}

export interface WaitForUrlParams {
  pattern: string;
  /** Timeout in ms */
  timeout?: number;
}
export interface WaitForUrlResult {
  url: string;
}

// ─── Evaluate ────────────────────────────────────────────────────────

export interface EvaluateParams {
  expression: string;
}
export interface EvaluateResult {
  value: unknown;
}

// ─── Console ─────────────────────────────────────────────────────────

export interface GetConsoleParams {
  /** Filter by level */
  level?: 'log' | 'warn' | 'error' | 'info' | 'debug';
  /** Only return entries since last call */
  clear?: boolean;
}
export interface GetConsoleResult {
  entries: ConsoleEntry[];
}

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: unknown[];
  timestamp: number;
}

export type GetErrorsParams = Record<string, never>;
export interface GetErrorsResult {
  errors: ConsoleEntry[];
}

// ─── Tab Management ──────────────────────────────────────────────────

export interface TabNewParams {
  url?: string;
}
export interface TabNewResult {
  tabId: number;
  url: string;
}

export type TabListParams = Record<string, never>;
export interface TabListResult {
  tabs: TabInfo[];
}

export interface TabInfo {
  id: number;
  url: string;
  title: string;
  active: boolean;
}

export interface TabSwitchParams {
  tabId: number;
}
export interface TabSwitchResult {
  tabId: number;
  url: string;
  title: string;
}

export interface TabCloseParams {
  tabId?: number;
}
export interface TabCloseResult {
  closed: true;
}

// ─── Cookies ─────────────────────────────────────────────────────────

export interface CookiesGetParams {
  name?: string;
  url?: string;
  domain?: string;
}
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

export interface CookiesSetParams {
  url: string;
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'no_restriction' | 'lax' | 'strict';
  expirationDate?: number;
}
export interface CookiesSetResult {
  set: true;
}

export interface CookiesClearParams {
  url?: string;
  domain?: string;
}
export interface CookiesClearResult {
  cleared: number;
}

// ─── Storage ─────────────────────────────────────────────────────────

export interface StorageGetParams {
  key?: string;
  area?: 'local' | 'session';
}
export interface StorageGetResult {
  entries: Record<string, string>;
}

export interface StorageSetParams {
  key: string;
  value: string;
  area?: 'local' | 'session';
}
export interface StorageSetResult {
  set: true;
}

export interface StorageClearParams {
  area?: 'local' | 'session';
}
export interface StorageClearResult {
  cleared: true;
}

// ─── Dialog ──────────────────────────────────────────────────────────

export interface DialogAcceptParams {
  text?: string;
}
export interface DialogAcceptResult {
  accepted: true;
}

export type DialogDismissParams = Record<string, never>;
export interface DialogDismissResult {
  dismissed: true;
}

// ─── Highlight ───────────────────────────────────────────────────────

export interface HighlightParams {
  selector: string;
  color?: string;
  duration?: number;
}
export interface HighlightResult {
  highlighted: true;
}

// ─── Frame Management ────────────────────────────────────────────────

export interface SwitchFrameParams {
  /** CSS selector to find the iframe */
  selector?: string;
  /** Frame name attribute */
  name?: string;
  /** Frame URL (partial match) */
  url?: string;
  /** Frame index (0-based) */
  index?: number;
  /** Switch to main/top frame */
  main?: boolean;
}
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

export type ListFramesParams = Record<string, never>;
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

export type GetCurrentFrameParams = Record<string, never>;
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

export interface RouteParams {
  pattern: string;
  action: 'block' | 'redirect';
  redirectUrl?: string;
}
export interface RouteResult {
  routeId: number;
  pattern: string;
  action: 'block' | 'redirect';
}

export interface UnrouteParams {
  routeId: number;
}
export interface UnrouteResult {
  removed: true;
}

export interface GetRequestsParams {
  /** Filter by URL pattern */
  pattern?: string;
  /** Filter by tab ID */
  tabId?: number;
  /** Only blocked requests */
  blockedOnly?: boolean;
  /** Limit number of results */
  limit?: number;
}
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

export type GetRoutesParams = Record<string, never>;
export interface GetRoutesResult {
  routes: Array<{
    id: number;
    pattern: string;
    action: 'block' | 'redirect';
    redirectUrl?: string;
    createdAt: number;
  }>;
}

export type ClearRequestsParams = Record<string, never>;
export interface ClearRequestsResult {
  cleared: number;
}

// ─── Window Management ──────────────────────────────────────────────

export interface WindowNewParams {
  url?: string;
}
export interface WindowNewResult {
  windowId: number;
  tabId: number;
  url: string;
}

export type WindowListParams = Record<string, never>;
export interface WindowListResult {
  windows: WindowInfo[];
}

export interface WindowInfo {
  id: number;
  focused: boolean;
  type: string;
  tabs: number;
}

export interface WindowCloseParams {
  windowId?: number;
}
export interface WindowCloseResult {
  closed: true;
}

// ─── Browser Config ─────────────────────────────────────────────────

export interface SetViewportParams {
  width: number;
  height: number;
}
export interface SetViewportResult {
  set: true;
  width: number;
  height: number;
}

export interface SetGeoParams {
  latitude: number;
  longitude: number;
  accuracy?: number;
}
export interface SetGeoResult {
  set: true;
}

export interface SetMediaParams {
  colorScheme: 'dark' | 'light';
}
export interface SetMediaResult {
  set: true;
}

export interface SetHeadersParams {
  headers: Record<string, string>;
}
export interface SetHeadersResult {
  set: true;
  ruleCount: number;
}

// ─── State Management ───────────────────────────────────────────────

export type StateExportParams = Record<string, never>;
export interface StateExportResult {
  url: string;
  cookies: CookieInfo[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface StateImportParams {
  cookies?: Array<{
    url: string;
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'no_restriction' | 'lax' | 'strict';
    expirationDate?: number;
  }>;
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
}
export interface StateImportResult {
  imported: { cookies: number; localStorage: number; sessionStorage: number };
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
  // Browser Config
  | 'setViewport'
  | 'setGeo'
  | 'setMedia'
  | 'setHeaders'
  // State Management
  | 'stateExport'
  | 'stateImport';

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
  | { action: 'setViewport'; params: SetViewportParams }
  | { action: 'setGeo'; params: SetGeoParams }
  | { action: 'setMedia'; params: SetMediaParams }
  | { action: 'setHeaders'; params: SetHeadersParams }
  | { action: 'stateExport'; params: StateExportParams }
  | { action: 'stateImport'; params: StateImportParams };

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
  setViewport: SetViewportResult;
  setGeo: SetGeoResult;
  setMedia: SetMediaResult;
  setHeaders: SetHeadersResult;
  stateExport: StateExportResult;
  stateImport: StateImportResult;
}
