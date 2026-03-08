/**
 * Help JSON generator — introspects Commander.js command tree
 * to produce structured, machine-readable help for AI agents.
 *
 * Category information comes from commandCategories in commands/index.ts
 * (single source of truth for both registration and categorization).
 */

import type { Command, Argument, Option } from 'commander';

interface ArgumentHelp {
  name: string;
  description: string;
  required: boolean;
  variadic: boolean;
  default?: unknown;
}

interface OptionHelp {
  flags: string;
  description: string;
  /** Whether this option must be provided (Commander `mandatory`) */
  required: boolean;
  /** Whether the option takes a value (vs boolean flag) */
  takesValue: boolean;
  default?: unknown;
}

interface CommandHelp {
  name: string;
  description: string;
  aliases: string[];
  arguments: ArgumentHelp[];
  options: OptionHelp[];
  subcommands: CommandHelp[];
}

interface CategoryHelp {
  name: string;
  commands: CommandHelp[];
}

interface HelpJSON {
  name: string;
  version: string;
  description: string;
  globalOptions: OptionHelp[];
  categories: CategoryHelp[];
}

function extractArgument(arg: Argument): ArgumentHelp {
  const result: ArgumentHelp = {
    name: arg.name(),
    description: arg.description,
    required: arg.required,
    variadic: arg.variadic,
  };
  if (arg.defaultValue !== undefined) result.default = arg.defaultValue;
  return result;
}

function extractOption(opt: Option): OptionHelp {
  const result: OptionHelp = {
    flags: opt.flags,
    description: opt.description,
    required: opt.mandatory, // Commander: mandatory = flag itself is required
    takesValue: opt.required || opt.optional, // required=<value>, optional=[value]
  };
  if (opt.defaultValue !== undefined) result.default = opt.defaultValue;
  return result;
}

function extractCommand(cmd: Command): CommandHelp {
  return {
    name: cmd.name(),
    description: cmd.description(),
    aliases: cmd.aliases(),
    arguments: cmd.registeredArguments.map(extractArgument),
    options: cmd.options.filter((o) => !o.hidden).map(extractOption),
    subcommands: cmd.commands.map(extractCommand),
  };
}

/**
 * Generate structured help JSON from the Commander.js program tree.
 *
 * @param program - The root Commander program (after registerCommands)
 * @param commandCategories - Category definitions from commands/index.ts
 */
export function generateHelpJSON(
  program: Command,
  commandCategories: Array<{ name: string; commands: Command[] }>,
): HelpJSON {
  const categories: CategoryHelp[] = commandCategories.map((cat) => ({
    name: cat.name,
    commands: cat.commands.map(extractCommand),
  }));

  return {
    name: program.name(),
    version: program.version() ?? 'unknown',
    description: program.description(),
    globalOptions: program.options.filter((o) => !o.hidden).map(extractOption),
    categories,
  };
}

/**
 * Generate a compact text summary of all commands, organized by category.
 * Useful for AI agents that prefer plain-text over JSON.
 */
export function generateHelpText(
  program: Command,
  commandCategories: Array<{ name: string; commands: Command[] }>,
): string {
  const json = generateHelpJSON(program, commandCategories);
  const lines: string[] = [];

  lines.push(`${json.name} v${json.version}`);
  lines.push(`Usage: ${json.name} [options] <command> [args]`);
  lines.push('');

  for (const cat of json.categories) {
    lines.push(`${cat.name}:`);
    for (const cmd of cat.commands) {
      const argsStr = cmd.arguments
        .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
        .join(' ');
      const usage = argsStr ? `${cmd.name} ${argsStr}` : cmd.name;
      lines.push(formatWithGap(`  ${usage}`, cmd.description));

      // Show subcommands inline
      for (const sub of cmd.subcommands) {
        const subArgsStr = sub.arguments
          .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
          .join(' ');
        const subUsage = subArgsStr
          ? `${cmd.name} ${sub.name} ${subArgsStr}`
          : `${cmd.name} ${sub.name}`;
        lines.push(formatWithGap(`    ${subUsage}`, sub.description));
      }
    }
    lines.push('');
  }

  lines.push('Global options:');
  for (const opt of json.globalOptions) {
    lines.push(formatWithGap(`  ${opt.flags}`, opt.description));
  }

  return lines.join('\n');
}

const GAP = 36;

function formatWithGap(left: string, right: string): string {
  const padding = Math.max(2, GAP - left.length);
  return left + ' '.repeat(padding) + right;
}
