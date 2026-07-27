import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { addTargetOptions, fail, positionFrom, sendCommand, type TargetOptions } from './shared.js';

export const checkCommand = addTargetOptions(
  new Command('check')
    .description('Check a checkbox or radio button')
    .argument('<selector>', 'CSS selector or @ref'),
).action(async (selector: string, opts: TargetOptions, cmd: Command) => {
  await sendCommand(cmd, {
    action: 'check',
    params: { selector, force: opts.force || undefined, position: positionFrom(opts) },
  });
  console.log('Checked');
});

export const uncheckCommand = addTargetOptions(
  new Command('uncheck')
    .description('Uncheck a checkbox')
    .argument('<selector>', 'CSS selector or @ref'),
).action(async (selector: string, opts: TargetOptions, cmd: Command) => {
  await sendCommand(cmd, {
    action: 'uncheck',
    params: { selector, force: opts.force || undefined, position: positionFrom(opts) },
  });
  console.log('Unchecked');
});

export const selectCommand = addTargetOptions(
  new Command('select')
    .description('Select an option in a <select> dropdown by value or visible text')
    .argument('<selector>', 'CSS selector or @ref')
    .argument('<value>', 'Option value to select'),
).action(async (selector: string, value: string, opts: TargetOptions, cmd: Command) => {
  const result = await sendCommand(cmd, {
    action: 'select',
    params: { selector, value, force: opts.force || undefined, position: positionFrom(opts) },
  });
  if (result) console.log(`Selected: ${result.value}`);
});

export const formCommand = new Command('form').description(
  'Batch form operations (subcommand: fill)',
);

formCommand
  .command('fill')
  .description('Fill many fields in one round-trip from a selector→value JSON map')
  .option('--data <json>', 'JSON object mapping selector to value, or a JSON array of pairs')
  .option('--data-file <path>', 'Read the JSON map from a file ("-" for stdin)')
  .option('--force', 'Skip the disabled and occlusion checks')
  .option('--continue-on-error', 'Apply the remaining fields after one fails')
  .action(
    async (
      opts: { data?: string; dataFile?: string; force?: boolean; continueOnError?: boolean },
      cmd: Command,
    ) => {
      if (!opts.data && !opts.dataFile) {
        fail(
          cmd,
          'INVALID_ARGS',
          'form fill requires --data <json> or --data-file <path>',
          'Example: form fill --data \'{"#user":"alice","#terms":true,"#country":"Japan"}\'',
        );
      }
      if (opts.data && opts.dataFile) {
        fail(
          cmd,
          'INVALID_ARGS',
          'Pass only one of --data or --data-file',
          'Choose whichever source holds the field map.',
        );
      }

      let raw = opts.data;
      if (opts.dataFile) {
        try {
          raw = readFileSync(opts.dataFile === '-' ? 0 : opts.dataFile, 'utf-8');
        } catch (err) {
          fail(
            cmd,
            'INVALID_ARGS',
            `Failed to read --data-file ${opts.dataFile}: ${(err as Error).message}`,
            'Pass a readable file path, or "-" to read the JSON from stdin.',
          );
        }
      }

      const fields = parseFields(cmd, raw as string);
      const result = await sendCommand(cmd, {
        action: 'formFill',
        params: {
          fields,
          force: opts.force || undefined,
          continueOnError: opts.continueOnError || undefined,
        },
      });

      if (result) {
        for (const field of result.fields) {
          if (field.error) {
            console.log(`✗ ${field.selector} — [${field.error.code}] ${field.error.message}`);
          } else {
            console.log(`${field.action} ${field.selector} = ${field.value}`);
          }
        }
        console.log(`Filled ${result.filled}/${result.fields.length} fields`);
      }
    },
  );

type Field = { selector: string; value: string | number | boolean };

/**
 * Accepts `{"sel": value}` (key order is the fill order) or `[["sel", value]]`
 * / `[{selector, value}]` when a selector must repeat.
 */
function parseFields(cmd: Command, raw: string): Field[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(
      cmd,
      'INVALID_ARGS',
      `--data is not valid JSON: ${(err as Error).message}`,
      'Wrap the JSON in single quotes so the shell does not eat the double quotes.',
    );
  }

  const isValue = (v: unknown): v is string | number | boolean =>
    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

  const fields: Field[] = [];
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (Array.isArray(entry) && typeof entry[0] === 'string' && isValue(entry[1])) {
        fields.push({ selector: entry[0], value: entry[1] });
        continue;
      }
      const obj = entry as { selector?: unknown; value?: unknown };
      if (typeof obj.selector === 'string' && isValue(obj.value)) {
        fields.push({ selector: obj.selector, value: obj.value });
        continue;
      }
      fail(
        cmd,
        'INVALID_ARGS',
        `Array entries must be ["selector", value] or {"selector":..., "value":...}, got: ${JSON.stringify(entry)}`,
        'Or pass a plain object: {"#user":"alice"}.',
      );
    }
  } else if (parsed !== null && typeof parsed === 'object') {
    for (const [selector, value] of Object.entries(parsed)) {
      if (!isValue(value)) {
        fail(
          cmd,
          'INVALID_ARGS',
          `Value for "${selector}" must be a string, number, or boolean, got: ${JSON.stringify(value)}`,
          'Checkboxes take true/false; text fields and <select> take strings.',
        );
      }
      fields.push({ selector, value });
    }
  } else {
    fail(
      cmd,
      'INVALID_ARGS',
      'Field data must be a JSON object or array',
      'Example: form fill --data \'{"#user":"alice","#terms":true}\'',
    );
  }

  if (fields.length === 0) {
    fail(cmd, 'INVALID_ARGS', 'No fields to fill', 'Add at least one selector→value entry.');
  }
  return fields;
}
