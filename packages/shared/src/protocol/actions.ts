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
  | 'clearRequests';

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
  | { action: 'clearRequests'; params: ClearRequestsParams };

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
}
