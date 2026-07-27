/**
 * `verify` command group — one-shot assertions that combine the existing
 * get/is query channels with a local PASS/FAIL judgement.
 *
 * No new extension actions: every subcommand is `sendCommand` against an
 * action `get`/`is` already exposes, followed by a comparison done here.
 *
 * Exit codes:
 *   - Assertion holds            -> 0, "PASS: <description>" on stdout.
 *   - Assertion does not hold    -> 1 (ASSERTION_FAILED), "FAIL: <description>"
 *     plus expected/actual on stderr.
 *   - The underlying query itself fails (element not found, not connected,
 *     timeout, ...) -> propagates through sendCommand/fail with its own
 *     exitCodeFor class, since that is a real error, not a failed assertion.
 */

import { Command } from 'commander';
import { BrowserCliError, exitCodeFor } from '@browser-cli/shared';
import { fail, getBatchContext, getRootOpts, requireInt, sendCommand } from './shared.js';
import { logger } from '../util/logger.js';

/** Page text beyond this is a context-window hazard, not useful "actual" output. */
const MAX_TEXT_PREVIEW = 200;

function preview(text: string): string {
  return text.length > MAX_TEXT_PREVIEW ? text.slice(0, MAX_TEXT_PREVIEW) + '…' : text;
}

/**
 * Convert a glob/regex pattern to a RegExp, matched as a substring — kept in
 * sync with `patternToRegex` in apps/extension/src/content-lib/wait.ts so
 * `verify url`/`verify title` agree with `wait --url`.
 */
function patternToRegex(pattern: string): RegExp {
  if (pattern.includes('*')) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\0')
      .replace(/\*/g, '[^/]*')
      .replace(/\0/g, '.*');
    return new RegExp(escaped);
  }
  return new RegExp(pattern);
}

interface VerifyOutcome {
  pass: boolean;
  expected: unknown;
  actual: unknown;
}

/**
 * Report a PASS/FAIL judgement, honouring --json and batch/repl the same
 * way `fail()` does for real errors.
 */
function reportVerify(cmd: Command, description: string, outcome: VerifyOutcome): void {
  const { pass, expected, actual } = outcome;
  const data = { pass, expected, actual };
  const message = `${description} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;

  const batchContext = getBatchContext();
  if (batchContext) {
    if (!pass) {
      throw new BrowserCliError(
        'ASSERTION_FAILED',
        message,
        'The assertion did not hold; compare the expected/actual values in this message.',
      );
    }
    batchContext.lastData = data;
    console.log(`PASS: ${description}`);
    return;
  }

  if (getRootOpts(cmd).json) {
    if (pass) {
      console.log(JSON.stringify({ success: true, data }, null, 2));
      process.exit(0);
    }
    console.log(
      JSON.stringify(
        {
          success: false,
          error: {
            code: 'ASSERTION_FAILED',
            message,
            hint: 'The assertion did not hold; compare the expected/actual values in this message.',
          },
        },
        null,
        2,
      ),
    );
    process.exit(exitCodeFor('ASSERTION_FAILED'));
  }

  if (pass) {
    console.log(`PASS: ${description}`);
    return;
  }

  logger.error(`FAIL: ${description}`);
  logger.error(`  expected: ${JSON.stringify(expected)}`);
  logger.error(`  actual: ${JSON.stringify(actual)}`);
  process.exit(exitCodeFor('ASSERTION_FAILED'));
}

export const verifyCommand = new Command('verify').description(
  'Assert on page state — exits 0/PASS or 1/FAIL (subcommands: text, visible, value, count, url, title)',
);

verifyCommand
  .command('text <text>')
  .description('Assert the page contains the given text')
  .action(async (text: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(
      cmd,
      { action: 'getText', params: { selector: 'body' } },
      { skipJson: true },
    );
    const bodyText = result?.text ?? '';
    const pass = bodyText.includes(text);
    reportVerify(cmd, `page contains text ${JSON.stringify(text)}`, {
      pass,
      expected: text,
      actual: pass ? text : preview(bodyText),
    });
  });

verifyCommand
  .command('visible <selector>')
  .description('Assert an element is visible (missing or hidden both count as FAIL)')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(
      cmd,
      { action: 'isVisible', params: { selector } },
      { skipJson: true },
    );
    const visible = result?.visible ?? false;
    reportVerify(cmd, `${selector} is visible`, {
      pass: visible,
      expected: true,
      actual: visible,
    });
  });

verifyCommand
  .command('value <selector> <expected>')
  .description('Assert an input element has the given value')
  .action(async (selector: string, expected: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(
      cmd,
      { action: 'getValue', params: { selector } },
      { skipJson: true },
    );
    const actual = result?.value ?? '';
    reportVerify(cmd, `${selector} value equals ${JSON.stringify(expected)}`, {
      pass: actual === expected,
      expected,
      actual,
    });
  });

verifyCommand
  .command('count <selector> <n>')
  .description('Assert the number of matching elements equals n (n=0 passes even if none exist)')
  .action(async (selector: string, n: string, _opts: unknown, cmd: Command) => {
    const expected = requireInt(cmd, n, 'count', { min: 0 }) as number;
    const result = await sendCommand(
      cmd,
      { action: 'count', params: { selector } },
      { skipJson: true },
    );
    const actual = result?.count ?? 0;
    reportVerify(cmd, `${selector} count equals ${expected}`, {
      pass: actual === expected,
      expected,
      actual,
    });
  });

verifyCommand
  .command('url <pattern>')
  .description('Assert the current URL matches a glob pattern (same syntax as wait --url)')
  .action(async (pattern: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getUrl', params: {} }, { skipJson: true });
    const actual = result?.url ?? '';
    let pass: boolean;
    try {
      pass = patternToRegex(pattern).test(actual);
    } catch (err) {
      fail(
        cmd,
        'INVALID_ARGS',
        `Invalid pattern "${pattern}": ${(err as Error).message}`,
        'Use a glob (e.g. **/dashboard) or a valid regular expression.',
      );
    }
    reportVerify(cmd, `URL matches pattern ${JSON.stringify(pattern)}`, {
      pass,
      expected: pattern,
      actual,
    });
  });

verifyCommand
  .command('title <pattern>')
  .description('Assert the page title matches a glob pattern (same syntax as wait --url)')
  .action(async (pattern: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getTitle', params: {} }, { skipJson: true });
    const actual = result?.title ?? '';
    let pass: boolean;
    try {
      pass = patternToRegex(pattern).test(actual);
    } catch (err) {
      fail(
        cmd,
        'INVALID_ARGS',
        `Invalid pattern "${pattern}": ${(err as Error).message}`,
        'Use a glob (e.g. **/dashboard) or a valid regular expression.',
      );
    }
    reportVerify(cmd, `title matches pattern ${JSON.stringify(pattern)}`, {
      pass,
      expected: pattern,
      actual,
    });
  });
