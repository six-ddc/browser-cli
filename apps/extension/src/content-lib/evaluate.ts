/**
 * Evaluate arbitrary JavaScript from a content script context.
 *
 * Runs in the ISOLATED world — DOM access works, but page JS globals
 * (e.g. window variables set by the page) are not visible.  This is
 * the Firefox fallback when MAIN-world eval is blocked by CSP.
 */

import type { EvaluateParams } from '@browser-cli/shared';

export function handleEvaluate(
  params: EvaluateParams,
): Promise<{
  value: unknown;
  logs?: Array<{ level: string; args: unknown[]; timestamp: number }>;
}> {
  const { expression } = params;

  // Capture console output during eval
  const logs: Array<{ level: string; args: unknown[]; timestamp: number }> = [];
  const origConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };
  const capture =
    (level: string) =>
    (...args: unknown[]) => {
      logs.push({
        level,
        args: args.map((a) => {
          try {
            return JSON.parse(JSON.stringify(a));
          } catch {
            return String(a);
          }
        }),
        timestamp: Date.now(),
      });
      (origConsole as Record<string, (...a: unknown[]) => void>)[level](...args);
    };
  console.log = capture('log');
  console.warn = capture('warn');
  console.error = capture('error');
  console.info = capture('info');
  console.debug = capture('debug');

  // Content script eval() runs in the ISOLATED world and is NOT subject
  // to page CSP — only the extension's own CSP applies.  DOM objects
  // (document, elements, attributes) are shared with the page so all
  // querySelector / innerText / getAttribute patterns work.
  try {
    const result: unknown = (0, eval)(expression);
    const res: {
      value: unknown;
      logs?: Array<{ level: string; args: unknown[]; timestamp: number }>;
    } = { value: result };
    if (logs.length) res.logs = logs;
    return Promise.resolve(res);
  } catch (e: unknown) {
    return Promise.reject(new Error((e as Error).message));
  } finally {
    console.log = origConsole.log;
    console.warn = origConsole.warn;
    console.error = origConsole.error;
    console.info = origConsole.info;
    console.debug = origConsole.debug;
  }
}
