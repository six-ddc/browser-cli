import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import {
  addPositionOptions,
  fail,
  getRootOpts,
  positionFrom,
  sendCommand,
  type TargetOptions,
} from './shared.js';
import { logger } from '../util/logger.js';
import { wrapPageContent } from '../lib/boundaries.js';

/** Beyond this, HTML is a context-window hazard rather than useful output. */
const MAX_HTML_CHARS = 100_000;

const getCmd = new Command('get').description(
  'Query page data (subcommands: text, html, value, attr, url, title, count, box)',
);

addPositionOptions(
  getCmd.command('text <selector>').description('Get text content of an element'),
).action(async (selector: string, opts: TargetOptions, cmd: Command) => {
  const result = await sendCommand(cmd, {
    action: 'getText',
    params: { selector, position: positionFrom(opts) },
  });
  if (result) console.log(wrapPageContent(result.text));
});

addPositionOptions(
  getCmd
    .command('html <selector>')
    .description(
      'Get innerHTML of an element (--outer for outerHTML, --out-file to write large HTML to disk)',
    )
    .option('--outer', 'Get outerHTML instead')
    .option('--out-file <path>', 'Write the full HTML to a file instead of stdout'),
).action(
  async (
    selector: string,
    opts: TargetOptions & { outer?: boolean; outFile?: string },
    cmd: Command,
  ) => {
    const result = await sendCommand(
      cmd,
      {
        action: 'getHtml',
        params: { selector, outer: opts.outer, position: positionFrom(opts) },
      },
      { skipJson: !!opts.outFile },
    );
    if (!result) return;

    if (opts.outFile) {
      try {
        writeFileSync(opts.outFile, result.html);
      } catch (err) {
        fail(
          cmd,
          'INVALID_ARGS',
          `Failed to write --out-file ${opts.outFile}: ${(err as Error).message}`,
          'Pass a path in an existing, writable directory.',
        );
      }
      const data = { path: opts.outFile, chars: result.html.length };
      if (getRootOpts(cmd).json) {
        console.log(JSON.stringify({ success: true, data }, null, 2));
      } else {
        logger.success(`Wrote ${data.chars} chars of HTML to ${opts.outFile}`);
      }
      return;
    }

    if (result.html.length > MAX_HTML_CHARS) {
      const notice = `[truncated: showing ${MAX_HTML_CHARS} of ${result.html.length} chars]`;
      console.log(wrapPageContent(result.html.slice(0, MAX_HTML_CHARS), notice));
      logger.warn(
        `HTML truncated: showing ${MAX_HTML_CHARS} of ${result.html.length} chars. Use --out-file <path> for the full document, or a narrower selector.`,
      );
      return;
    }
    console.log(wrapPageContent(result.html));
  },
);

addPositionOptions(
  getCmd.command('value <selector>').description('Get value of an input element'),
).action(async (selector: string, opts: TargetOptions, cmd: Command) => {
  const result = await sendCommand(cmd, {
    action: 'getValue',
    params: { selector, position: positionFrom(opts) },
  });
  if (result) console.log(result.value);
});

addPositionOptions(
  getCmd.command('attr <selector> <attribute>').description('Get an attribute value'),
).action(async (selector: string, attribute: string, opts: TargetOptions, cmd: Command) => {
  const result = await sendCommand(cmd, {
    action: 'getAttribute',
    params: { selector, attribute, position: positionFrom(opts) },
  });
  if (result) console.log(result.value ?? 'null');
});

getCmd
  .command('url')
  .description('Get the current page URL')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getUrl', params: {} });
    if (result) console.log(result.url);
  });

getCmd
  .command('title')
  .description('Get the current page title')
  .action(async (_opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'getTitle', params: {} });
    if (result) console.log(result.title);
  });

getCmd
  .command('count <selector>')
  .description('Count matching elements')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'count', params: { selector } });
    if (result) console.log(result.count);
  });

addPositionOptions(
  getCmd.command('box <selector>').description('Get bounding box of an element'),
).action(async (selector: string, opts: TargetOptions, cmd: Command) => {
  const result = await sendCommand(cmd, {
    action: 'boundingBox',
    params: { selector, position: positionFrom(opts) },
  });
  if (result) console.log(`x=${result.x} y=${result.y} w=${result.width} h=${result.height}`);
});

export { getCmd as getCommand };

// is commands
const isCmd = new Command('is').description(
  'Check element state — returns true/false (subcommands: visible, enabled, checked)',
);

isCmd
  .command('visible <selector>')
  .description('Check if an element is visible')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'isVisible', params: { selector } });
    if (result) console.log(result.visible);
  });

isCmd
  .command('enabled <selector>')
  .description('Check if an element is enabled')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'isEnabled', params: { selector } });
    if (result) console.log(result.enabled);
  });

isCmd
  .command('checked <selector>')
  .description('Check if a checkbox/radio is checked')
  .action(async (selector: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'isChecked', params: { selector } });
    if (result) console.log(result.checked);
  });

export { isCmd as isCommand };
