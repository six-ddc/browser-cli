/**
 * Zod schemas for runtime validation of protocol messages.
 */

import { z } from 'zod';

// ─── Element Ref ─────────────────────────────────────────────────────

export const elementRefSchema = z.string().regex(/^@e\d+$/);

// ─── Error ───────────────────────────────────────────────────────────

export const protocolErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

// ─── Action Params ───────────────────────────────────────────────────

// Navigation
export const navigateParamsSchema = z.object({ url: z.string() });
export const emptyParamsSchema = z.object({});

// Interaction
export const clickParamsSchema = z.object({
  selector: z.string(),
  button: z.enum(['left', 'right', 'middle']).optional(),
});
export const dblclickParamsSchema = z.object({ selector: z.string() });
export const hoverParamsSchema = z.object({ selector: z.string() });
export const fillParamsSchema = z.object({ selector: z.string(), value: z.string() });
export const typeParamsSchema = z.object({
  selector: z.string(),
  text: z.string(),
  delay: z.number().optional(),
});
export const pressParamsSchema = z.object({ selector: z.string(), key: z.string() });
export const clearParamsSchema = z.object({ selector: z.string() });
export const focusParamsSchema = z.object({ selector: z.string() });

// Form
export const checkParamsSchema = z.object({ selector: z.string() });
export const uncheckParamsSchema = z.object({ selector: z.string() });
export const selectParamsSchema = z.object({ selector: z.string(), value: z.string() });

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
  depth: z.number().optional(),
});

// Screenshot
export const screenshotParamsSchema = z.object({
  selector: z.string().optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().min(0).max(100).optional(),
});

// Wait
export const waitParamsSchema = z.object({
  selector: z.string(),
  timeout: z.number().optional(),
  visible: z.boolean().optional(),
});
export const waitForUrlParamsSchema = z.object({
  pattern: z.string(),
  timeout: z.number().optional(),
});

// Evaluate
export const evaluateParamsSchema = z.object({ expression: z.string() });

// Console
export const getConsoleParamsSchema = z.object({
  level: z.enum(['log', 'warn', 'error', 'info', 'debug']).optional(),
  clear: z.boolean().optional(),
});

// Tab
export const tabNewParamsSchema = z.object({ url: z.string().optional() });
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
  z.object({ action: z.literal('check'), params: checkParamsSchema }),
  z.object({ action: z.literal('uncheck'), params: uncheckParamsSchema }),
  z.object({ action: z.literal('select'), params: selectParamsSchema }),
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

export const handshakeMessageSchema = z.object({
  type: z.literal('handshake'),
  protocolVersion: z.string(),
  extensionId: z.string(),
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
});

export const daemonResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: protocolErrorSchema.optional(),
});
