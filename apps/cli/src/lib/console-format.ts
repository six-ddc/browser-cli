/**
 * Rendering for console entries captured from the page.
 *
 * Error objects cross the wire as `{__error:true,...}` because `JSON.stringify(new Error())`
 * is `{}` — message and stack are non-enumerable. Both the `console`/`errors` commands and
 * the inline echo of `eval`/`script` render them through here.
 */

export type SerializedError = { __error: true; name: string; message: string; stack?: string };

export function isSerializedError(value: unknown): value is SerializedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__error === true
  );
}

/** One-line summary of console arguments, with errors rendered as `Name: message`. */
export function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (isSerializedError(a)) return `${a.name}: ${a.message}`;
      return typeof a === 'string' ? a : JSON.stringify(a);
    })
    .join(' ');
}

/** Indented stack frames for any error arguments, appended below the summary line. */
export function formatArgStacks(args: unknown[], maxFrames = 5): string {
  let out = '';
  for (const arg of args) {
    if (isSerializedError(arg) && arg.stack) out += indentStack(arg.stack, maxFrames);
  }
  return out;
}

export function indentStack(stack: string, maxFrames = 5): string {
  return stack
    .split('\n')
    .slice(0, maxFrames)
    .map((l) => `\n    ${l}`)
    .join('');
}
