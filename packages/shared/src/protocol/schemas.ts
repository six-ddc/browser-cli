/**
 * Zod schemas for runtime validation of protocol messages.
 */

import { z } from 'zod';
import { ErrorCode } from './errors.js';

// ─── Element Ref ─────────────────────────────────────────────────────

export const elementRefSchema = z.string().regex(/^@e\d+$/);

// ─── Error ───────────────────────────────────────────────────────────

export const protocolErrorSchema = z.object({
  code: z.enum(ErrorCode),
  message: z.string(),
  hint: z.string().optional(),
  details: z.unknown().optional(),
});

// ─── Action Params ───────────────────────────────────────────────────

// Position selector schema (reusable)
const positionSchema = z
  .object({
    type: z.enum(['first', 'last', 'nth']),
    index: z.number().optional(),
  })
  .optional();

// Navigation
export const navigateParamsSchema = z.object({ url: z.string() });
export const emptyParamsSchema = z.object({});

// Interaction
export const clickParamsSchema = z.object({
  selector: z.string(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  position: positionSchema,
});
export const dblclickParamsSchema = z.object({
  selector: z.string(),
  position: positionSchema,
});
export const hoverParamsSchema = z.object({
  selector: z.string(),
  position: positionSchema,
});
export const fillParamsSchema = z.object({
  selector: z.string(),
  value: z.string(),
  position: positionSchema,
});
export const typeParamsSchema = z.object({
  selector: z.string(),
  text: z.string(),
  delay: z.number().optional(),
  position: positionSchema,
});
export const pressParamsSchema = z.object({
  selector: z.string().optional(),
  key: z.string(),
  position: positionSchema,
});
export const clearParamsSchema = z.object({
  selector: z.string(),
  position: positionSchema,
});
export const focusParamsSchema = z.object({
  selector: z.string(),
  position: positionSchema,
});

// Form
export const checkParamsSchema = z.object({
  selector: z.string(),
  position: positionSchema,
});
export const uncheckParamsSchema = z.object({
  selector: z.string(),
  position: positionSchema,
});
export const selectParamsSchema = z.object({
  selector: z.string(),
  value: z.string(),
  position: positionSchema,
});

// Scroll
export const scrollParamsSchema = z.object({
  direction: z.enum(['up', 'down', 'left', 'right']),
  amount: z.number().optional(),
  selector: z.string().optional(),
});
export const scrollIntoViewParamsSchema = z.object({ selector: z.string() });

// Data queries
export const getTextParamsSchema = z.object({ selector: z.string() });
export const getHtmlParamsSchema = z.object({
  selector: z.string(),
  outer: z.boolean().optional(),
});
export const getValueParamsSchema = z.object({ selector: z.string() });
export const getAttributeParamsSchema = z.object({
  selector: z.string(),
  attribute: z.string(),
});
export const isVisibleParamsSchema = z.object({ selector: z.string() });
export const isEnabledParamsSchema = z.object({ selector: z.string() });
export const isCheckedParamsSchema = z.object({ selector: z.string() });
export const countParamsSchema = z.object({ selector: z.string() });
export const boundingBoxParamsSchema = z.object({ selector: z.string() });

// Snapshot
export const snapshotParamsSchema = z.object({
  interactive: z.boolean().optional(),
  compact: z.boolean().optional(),
  cursor: z.boolean().optional(),
  depth: z.number().optional(),
  selector: z.string().optional(),
});

// Screenshot
export const screenshotParamsSchema = z.object({
  selector: z.string().optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
});

// Drag
export const dragParamsSchema = z.object({
  source: z.string(),
  target: z.string(),
});

// Key Down/Up
export const keydownParamsSchema = z.object({
  key: z.string(),
  selector: z.string().optional(),
  position: positionSchema,
});
export const keyupParamsSchema = z.object({
  key: z.string(),
  selector: z.string().optional(),
  position: positionSchema,
});

// Mouse
export const mouseMoveParamsSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export const mouseDownParamsSchema = z.object({
  button: z.enum(['left', 'right', 'middle']).optional(),
});
export const mouseUpParamsSchema = z.object({
  button: z.enum(['left', 'right', 'middle']).optional(),
});
export const mouseWheelParamsSchema = z.object({
  deltaY: z.number(),
  deltaX: z.number().optional(),
});

// Wait
export const waitParamsSchema = z.object({
  selector: z.string().optional(),
  duration: z.number().optional(),
  timeout: z.number().optional(),
  visible: z.boolean().optional(),
  text: z.string().optional(),
  load: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  fn: z.string().optional(),
});
export const waitForUrlParamsSchema = z.object({
  pattern: z.string(),
  timeout: z.number().optional(),
});

// Evaluate
export const evaluateParamsSchema = z.object({
  expression: z.string(),
});

// Console
export const getConsoleParamsSchema = z.object({
  level: z.enum(['log', 'warn', 'error', 'info', 'debug']).optional(),
  clear: z.boolean().optional(),
});

// Tab
export const tabNewParamsSchema = z.object({
  url: z.string().optional(),
  container: z.string().optional(),
});
export const tabSwitchParamsSchema = z.object({ tabId: z.number() });
export const tabCloseParamsSchema = z.object({ tabId: z.number().optional() });

// Cookies
export const cookiesGetParamsSchema = z.object({
  name: z.string().optional(),
  url: z.string().optional(),
  domain: z.string().optional(),
});
export const cookiesSetParamsSchema = z.object({
  url: z.string(),
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  secure: z.boolean().optional(),
  httpOnly: z.boolean().optional(),
  sameSite: z.enum(['no_restriction', 'lax', 'strict']).optional(),
  expirationDate: z.number().optional(),
});
export const cookiesClearParamsSchema = z.object({
  url: z.string().optional(),
  domain: z.string().optional(),
});

// Storage
export const storageGetParamsSchema = z.object({
  key: z.string().optional(),
  area: z.enum(['local', 'session']).optional(),
});
export const storageSetParamsSchema = z.object({
  key: z.string(),
  value: z.string(),
  area: z.enum(['local', 'session']).optional(),
});
export const storageClearParamsSchema = z.object({
  area: z.enum(['local', 'session']).optional(),
});

// Dialog
export const dialogAcceptParamsSchema = z.object({ text: z.string().optional() });
export const dialogDismissParamsSchema = z.object({});

// Highlight
export const highlightParamsSchema = z.object({
  selector: z.string(),
  color: z.string().optional(),
  duration: z.number().optional(),
});

// Network
export const routeParamsSchema = z.object({
  pattern: z.string(),
  action: z.enum(['block', 'redirect']),
  redirectUrl: z.string().optional(),
});
export const unrouteParamsSchema = z.object({ routeId: z.number() });
export const getRequestsParamsSchema = z.object({
  pattern: z.string().optional(),
  tabId: z.number().optional(),
  blockedOnly: z.boolean().optional(),
  limit: z.number().optional(),
});
export const getRoutesParamsSchema = emptyParamsSchema;
export const clearRequestsParamsSchema = emptyParamsSchema;

// Frame management
export const switchFrameParamsSchema = z.object({
  selector: z.string().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  index: z.number().optional(),
  main: z.boolean().optional(),
});

// Upload
export const uploadParamsSchema = z.object({
  selector: z.string(),
  files: z.union([z.string(), z.array(z.string())]),
  clear: z.boolean().optional(),
});

// Window
export const windowNewParamsSchema = z.object({
  url: z.string().optional(),
});
export const windowCloseParamsSchema = z.object({
  windowId: z.number().optional(),
});
export const windowFocusParamsSchema = z.object({
  windowId: z.number().optional(),
});

// Tab Group
export const tabGroupCreateParamsSchema = z.object({
  tabIds: z.array(z.number()),
});
export const tabGroupUpdateParamsSchema = z.object({
  groupId: z.number(),
  title: z.string().optional(),
  color: z
    .enum(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'])
    .optional(),
  collapsed: z.boolean().optional(),
});
export const tabGroupListParamsSchema = z.object({});
export const tabUngroupParamsSchema = z.object({
  tabIds: z.array(z.number()),
});

// Bookmark
export const bookmarkAddParamsSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
});
export const bookmarkRemoveParamsSchema = z.object({
  id: z.string(),
});
export const bookmarkListParamsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().optional(),
});

// History
export const historySearchParamsSchema = z.object({
  text: z.string().optional(),
  limit: z.number().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
});

// Browser Config
export const setViewportParamsSchema = z.object({
  width: z.number(),
  height: z.number(),
});
export const setGeoParamsSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
});
export const setMediaParamsSchema = z.object({
  colorScheme: z.enum(['dark', 'light']),
});
export const setHeadersParamsSchema = z.object({
  headers: z.record(z.string(), z.string()),
});

// Container (Firefox contextualIdentities)
export const containerListParamsSchema = z.object({});
export const containerCreateParamsSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
});
export const containerRemoveParamsSchema = z.object({ name: z.string() });

// State Management
export const stateExportParamsSchema = z.object({});
export const stateImportParamsSchema = z.object({
  cookies: z
    .array(
      z.object({
        url: z.string(),
        name: z.string(),
        value: z.string(),
        domain: z.string().optional(),
        path: z.string().optional(),
        secure: z.boolean().optional(),
        httpOnly: z.boolean().optional(),
        sameSite: z.enum(['no_restriction', 'lax', 'strict', 'unspecified']).optional(),
        expirationDate: z.number().optional(),
      }),
    )
    .optional(),
  localStorage: z.record(z.string(), z.string()).optional(),
  sessionStorage: z.record(z.string(), z.string()).optional(),
});

// ─── Command Schema ──────────────────────────────────────────────────

export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('navigate'), params: navigateParamsSchema }),
  z.object({ action: z.literal('goBack'), params: emptyParamsSchema }),
  z.object({ action: z.literal('goForward'), params: emptyParamsSchema }),
  z.object({ action: z.literal('reload'), params: emptyParamsSchema }),
  z.object({ action: z.literal('getUrl'), params: emptyParamsSchema }),
  z.object({ action: z.literal('getTitle'), params: emptyParamsSchema }),
  z.object({ action: z.literal('click'), params: clickParamsSchema }),
  z.object({ action: z.literal('dblclick'), params: dblclickParamsSchema }),
  z.object({ action: z.literal('hover'), params: hoverParamsSchema }),
  z.object({ action: z.literal('fill'), params: fillParamsSchema }),
  z.object({ action: z.literal('type'), params: typeParamsSchema }),
  z.object({ action: z.literal('press'), params: pressParamsSchema }),
  z.object({ action: z.literal('clear'), params: clearParamsSchema }),
  z.object({ action: z.literal('focus'), params: focusParamsSchema }),
  z.object({ action: z.literal('drag'), params: dragParamsSchema }),
  z.object({ action: z.literal('keydown'), params: keydownParamsSchema }),
  z.object({ action: z.literal('keyup'), params: keyupParamsSchema }),
  z.object({ action: z.literal('mouseMove'), params: mouseMoveParamsSchema }),
  z.object({ action: z.literal('mouseDown'), params: mouseDownParamsSchema }),
  z.object({ action: z.literal('mouseUp'), params: mouseUpParamsSchema }),
  z.object({ action: z.literal('mouseWheel'), params: mouseWheelParamsSchema }),
  z.object({ action: z.literal('check'), params: checkParamsSchema }),
  z.object({ action: z.literal('uncheck'), params: uncheckParamsSchema }),
  z.object({ action: z.literal('select'), params: selectParamsSchema }),
  z.object({ action: z.literal('upload'), params: uploadParamsSchema }),
  z.object({ action: z.literal('scroll'), params: scrollParamsSchema }),
  z.object({ action: z.literal('scrollIntoView'), params: scrollIntoViewParamsSchema }),
  z.object({ action: z.literal('getText'), params: getTextParamsSchema }),
  z.object({ action: z.literal('getHtml'), params: getHtmlParamsSchema }),
  z.object({ action: z.literal('getValue'), params: getValueParamsSchema }),
  z.object({ action: z.literal('getAttribute'), params: getAttributeParamsSchema }),
  z.object({ action: z.literal('isVisible'), params: isVisibleParamsSchema }),
  z.object({ action: z.literal('isEnabled'), params: isEnabledParamsSchema }),
  z.object({ action: z.literal('isChecked'), params: isCheckedParamsSchema }),
  z.object({ action: z.literal('count'), params: countParamsSchema }),
  z.object({ action: z.literal('boundingBox'), params: boundingBoxParamsSchema }),
  z.object({ action: z.literal('snapshot'), params: snapshotParamsSchema }),
  z.object({ action: z.literal('screenshot'), params: screenshotParamsSchema }),
  z.object({ action: z.literal('wait'), params: waitParamsSchema }),
  z.object({ action: z.literal('waitForUrl'), params: waitForUrlParamsSchema }),
  z.object({ action: z.literal('evaluate'), params: evaluateParamsSchema }),
  z.object({ action: z.literal('getConsole'), params: getConsoleParamsSchema }),
  z.object({ action: z.literal('getErrors'), params: emptyParamsSchema }),
  z.object({ action: z.literal('tabNew'), params: tabNewParamsSchema }),
  z.object({ action: z.literal('tabList'), params: emptyParamsSchema }),
  z.object({ action: z.literal('tabSwitch'), params: tabSwitchParamsSchema }),
  z.object({ action: z.literal('tabClose'), params: tabCloseParamsSchema }),
  z.object({ action: z.literal('cookiesGet'), params: cookiesGetParamsSchema }),
  z.object({ action: z.literal('cookiesSet'), params: cookiesSetParamsSchema }),
  z.object({ action: z.literal('cookiesClear'), params: cookiesClearParamsSchema }),
  z.object({ action: z.literal('storageGet'), params: storageGetParamsSchema }),
  z.object({ action: z.literal('storageSet'), params: storageSetParamsSchema }),
  z.object({ action: z.literal('storageClear'), params: storageClearParamsSchema }),
  z.object({ action: z.literal('dialogAccept'), params: dialogAcceptParamsSchema }),
  z.object({ action: z.literal('dialogDismiss'), params: dialogDismissParamsSchema }),
  z.object({ action: z.literal('highlight'), params: highlightParamsSchema }),
  z.object({ action: z.literal('switchFrame'), params: switchFrameParamsSchema }),
  z.object({ action: z.literal('listFrames'), params: emptyParamsSchema }),
  z.object({ action: z.literal('getCurrentFrame'), params: emptyParamsSchema }),
  z.object({ action: z.literal('route'), params: routeParamsSchema }),
  z.object({ action: z.literal('unroute'), params: unrouteParamsSchema }),
  z.object({ action: z.literal('getRequests'), params: getRequestsParamsSchema }),
  z.object({ action: z.literal('getRoutes'), params: getRoutesParamsSchema }),
  z.object({ action: z.literal('clearRequests'), params: clearRequestsParamsSchema }),
  z.object({ action: z.literal('windowNew'), params: windowNewParamsSchema }),
  z.object({ action: z.literal('windowList'), params: emptyParamsSchema }),
  z.object({ action: z.literal('windowClose'), params: windowCloseParamsSchema }),
  z.object({ action: z.literal('windowFocus'), params: windowFocusParamsSchema }),
  z.object({ action: z.literal('tabGroupCreate'), params: tabGroupCreateParamsSchema }),
  z.object({ action: z.literal('tabGroupUpdate'), params: tabGroupUpdateParamsSchema }),
  z.object({ action: z.literal('tabGroupList'), params: tabGroupListParamsSchema }),
  z.object({ action: z.literal('tabUngroup'), params: tabUngroupParamsSchema }),
  z.object({ action: z.literal('bookmarkAdd'), params: bookmarkAddParamsSchema }),
  z.object({ action: z.literal('bookmarkRemove'), params: bookmarkRemoveParamsSchema }),
  z.object({ action: z.literal('bookmarkList'), params: bookmarkListParamsSchema }),
  z.object({ action: z.literal('historySearch'), params: historySearchParamsSchema }),
  z.object({ action: z.literal('setViewport'), params: setViewportParamsSchema }),
  z.object({ action: z.literal('setGeo'), params: setGeoParamsSchema }),
  z.object({ action: z.literal('setMedia'), params: setMediaParamsSchema }),
  z.object({ action: z.literal('setHeaders'), params: setHeadersParamsSchema }),
  z.object({ action: z.literal('stateExport'), params: stateExportParamsSchema }),
  z.object({ action: z.literal('stateImport'), params: stateImportParamsSchema }),
  z.object({ action: z.literal('markdown'), params: emptyParamsSchema }),
  z.object({ action: z.literal('containerList'), params: containerListParamsSchema }),
  z.object({ action: z.literal('containerCreate'), params: containerCreateParamsSchema }),
  z.object({ action: z.literal('containerRemove'), params: containerRemoveParamsSchema }),
]);

// ─── Message Schemas ─────────────────────────────────────────────────

export const requestMessageSchema = z.object({
  id: z.string(),
  type: z.literal('request'),
  command: commandSchema,
  tabId: z.number().optional(),
});

export const responseMessageSchema = z.object({
  id: z.string(),
  type: z.literal('response'),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: protocolErrorSchema.optional(),
});

export const eventMessageSchema = z.object({
  type: z.literal('event'),
  event: z.string(),
  data: z.unknown(),
  tabId: z.number().optional(),
  timestamp: z.number(),
});

export const browserInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  userAgent: z.string(),
});

export const handshakeMessageSchema = z.object({
  type: z.literal('handshake'),
  protocolVersion: z.string(),
  extensionId: z.string(),
  browser: browserInfoSchema.optional(),
  clientId: z.string().optional(),
  token: z.string().optional(),
});

export const handshakeAckMessageSchema = z.object({
  type: z.literal('handshake_ack'),
  protocolVersion: z.string(),
  sessionId: z.string(),
});

export const pingMessageSchema = z.object({
  type: z.literal('ping'),
  timestamp: z.number(),
});

export const pongMessageSchema = z.object({
  type: z.literal('pong'),
  timestamp: z.number(),
});

export const wsMessageSchema = z.discriminatedUnion('type', [
  requestMessageSchema,
  responseMessageSchema,
  eventMessageSchema,
  handshakeMessageSchema,
  handshakeAckMessageSchema,
  pingMessageSchema,
  pongMessageSchema,
]);

// ─── Daemon ↔ CLI Schemas ────────────────────────────────────────────

export const daemonRequestSchema = z.object({
  id: z.string(),
  command: commandSchema,
  tabId: z.number().optional(),
  sessionId: z.string().optional(),
});

export const daemonResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: protocolErrorSchema.optional(),
});
