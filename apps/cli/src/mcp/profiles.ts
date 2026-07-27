import { BrowserCliError } from '@browser-cli/shared';

export const TOOL_PROFILES = ['core', 'network', 'state', 'debug', 'tabs'] as const;

export type ToolProfile = (typeof TOOL_PROFILES)[number];

export const DEFAULT_PROFILES: ToolProfile[] = ['core'];

/**
 * Turn a `--tools` value ("core,state" / "all") into the profile set the
 * server should expose. Throws INVALID_ARGS listing the legal names.
 */
export function parseProfiles(spec: string | undefined): Set<ToolProfile> {
  if (spec === undefined) return new Set(DEFAULT_PROFILES);

  const names = spec
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (names.length === 0) {
    throw new BrowserCliError(
      'INVALID_ARGS',
      '--tools was given an empty list',
      `Pass one or more of: ${TOOL_PROFILES.join(', ')}, all`,
    );
  }

  const selected = new Set<ToolProfile>();
  for (const name of names) {
    if (name === 'all') {
      for (const profile of TOOL_PROFILES) selected.add(profile);
      continue;
    }
    if (!(TOOL_PROFILES as readonly string[]).includes(name)) {
      throw new BrowserCliError(
        'INVALID_ARGS',
        `Unknown tool profile "${name}"`,
        `Valid profiles: ${TOOL_PROFILES.join(', ')}, all`,
      );
    }
    selected.add(name as ToolProfile);
  }
  return selected;
}
