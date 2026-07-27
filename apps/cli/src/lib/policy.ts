/**
 * Action policy: a CLI-side guard rail that decides whether a command may be
 * sent to the daemon at all.
 *
 * This is a guard rail, not a security boundary — it is enforced in the CLI
 * process only. Anything talking to the daemon socket directly is unaffected.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { BrowserCliError, schemas } from '@browser-cli/shared';

export type PolicyDecision = 'allow' | 'deny' | 'confirm';

export interface ActionPolicy {
  default: 'allow' | 'deny';
  allow: string[];
  deny: string[];
  confirm: string[];
}

export interface PolicyVerdict {
  decision: PolicyDecision;
  /** The rule that produced the decision; absent when the default applied. */
  rule?: string;
}

const RULE_KEYS = ['allow', 'deny', 'confirm'] as const;
const KNOWN_KEYS = new Set<string>(['default', ...RULE_KEYS]);

const FORMAT_HINT =
  'Expected {"default":"allow"|"deny","allow":[],"deny":[],"confirm":[]} — lists hold action names or globs, e.g. "evaluate", "tab*".';

function invalid(message: string, hint: string): BrowserCliError {
  return new BrowserCliError('INVALID_ARGS', message, hint);
}

/** Parse and validate a policy document. Throws INVALID_ARGS on any defect. */
export function parsePolicy(source: string, origin: string): ActionPolicy {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch (err) {
    throw invalid(`Policy ${origin} is not valid JSON: ${(err as Error).message}`, FORMAT_HINT);
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw invalid(`Policy ${origin} must be a JSON object`, FORMAT_HINT);
  }
  const obj = raw as Record<string, unknown>;

  const unknownKeys = Object.keys(obj).filter((k) => !KNOWN_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw invalid(`Policy ${origin} has unknown field(s): ${unknownKeys.join(', ')}`, FORMAT_HINT);
  }

  const defaultValue = obj.default ?? 'allow';
  if (defaultValue !== 'allow' && defaultValue !== 'deny') {
    throw invalid(
      `Policy ${origin} field "default" must be "allow" or "deny", got: ${JSON.stringify(obj.default)}`,
      FORMAT_HINT,
    );
  }

  const policy: ActionPolicy = { default: defaultValue, allow: [], deny: [], confirm: [] };
  for (const key of RULE_KEYS) {
    const value = obj[key];
    if (value === undefined) continue;
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || v.length === 0)) {
      throw invalid(
        `Policy ${origin} field "${key}" must be an array of non-empty strings`,
        FORMAT_HINT,
      );
    }
    policy[key] = value as string[];
    for (const pattern of value as string[]) {
      assertPatternMatchesAnAction(pattern, key, origin);
    }
  }

  return policy;
}

/**
 * A rule that matches nothing is worse than no rule: a misspelled entry in
 * `deny` reads as protection while silently failing open.
 */
function assertPatternMatchesAnAction(pattern: string, field: string, origin: string): void {
  const re = globToRegExp(pattern);
  if (schemas.ACTION_TYPES.some((action) => re.test(action))) return;

  const near = nearestActions(pattern);
  throw invalid(
    `Policy ${origin} field "${field}" has a pattern that matches no action: "${pattern}"`,
    near.length > 0
      ? `Did you mean ${near.map((a) => `"${a}"`).join(', ')}? Action names are the protocol names (navigate, click, evaluate, tabNew, …), not CLI subcommand names.`
      : 'Action names are the protocol names (navigate, click, evaluate, tabNew, …), not CLI subcommand names. Use a glob such as "tab*" to cover a family.',
  );
}

/** Up to 3 action names sharing a prefix or substring with the bad pattern. */
function nearestActions(pattern: string): string[] {
  const needle = pattern.replace(/[*?]/g, '').toLowerCase();
  if (needle.length < 3) return [];
  return schemas.ACTION_TYPES.filter((action) => {
    const name = action.toLowerCase();
    return name.startsWith(needle) || name.includes(needle) || needle.startsWith(name);
  }).slice(0, 3);
}

/** Read a policy document off disk. Throws INVALID_ARGS when unreadable. */
export function loadPolicyFile(path: string): ActionPolicy {
  const full = resolve(path);
  let source: string;
  try {
    source = readFileSync(full, 'utf-8');
  } catch (err) {
    throw invalid(
      `Failed to read policy file ${full}: ${(err as Error).message}`,
      'Pass a readable path to --policy, or unset BROWSER_CLI_POLICY.',
    );
  }
  return parsePolicy(source, full);
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

function firstMatch(action: string, patterns: string[]): string | undefined {
  return patterns.find((pattern) => globToRegExp(pattern).test(action));
}

/**
 * Resolve an action name against a policy. Precedence is deny > confirm >
 * allow, falling through to `default` when no rule matches.
 */
export function decidePolicy(action: string, policy: ActionPolicy): PolicyVerdict {
  const denied = firstMatch(action, policy.deny);
  if (denied !== undefined) return { decision: 'deny', rule: denied };

  const confirmed = firstMatch(action, policy.confirm);
  if (confirmed !== undefined) return { decision: 'confirm', rule: confirmed };

  const allowed = firstMatch(action, policy.allow);
  if (allowed !== undefined) return { decision: 'allow', rule: allowed };

  return { decision: policy.default };
}

let activePolicy: ActionPolicy | null = null;
let policyInitialized = false;

/**
 * Resolve the process-wide policy once. An explicit `--policy` always wins;
 * otherwise `BROWSER_CLI_POLICY` is used, and a later call without an explicit
 * path keeps whatever was already resolved (batch and repl reparse the root
 * options for every line).
 */
export function initPolicy(explicitPath?: string): void {
  if (explicitPath) {
    activePolicy = loadPolicyFile(explicitPath);
    policyInitialized = true;
    return;
  }
  if (policyInitialized) return;
  policyInitialized = true;
  const fromEnv = process.env.BROWSER_CLI_POLICY;
  activePolicy = fromEnv ? loadPolicyFile(fromEnv) : null;
}

export function getPolicy(): ActionPolicy | null {
  return activePolicy;
}

/** Test seam: drop the resolved policy so the next init re-reads its inputs. */
export function resetPolicy(policy: ActionPolicy | null = null): void {
  activePolicy = policy;
  policyInitialized = policy !== null;
}

/** Verdict for an action under the active policy; `allow` when none is set. */
export function checkAction(action: string): PolicyVerdict {
  if (!activePolicy) return { decision: 'allow' };
  return decidePolicy(action, activePolicy);
}

/**
 * Enforce the policy where no human can be asked — `script` and the MCP server
 * both drive the daemon without a terminal, so `confirm` degrades to a refusal
 * rather than silently passing through.
 */
export function enforceActionNonInteractive(action: string, params: unknown): void {
  const verdict = checkAction(action);
  if (verdict.decision === 'allow') return;

  const rule = verdict.rule ? ` (${verdict.decision} rule "${verdict.rule}")` : '';
  if (verdict.decision === 'confirm') {
    throw new BrowserCliError(
      'POLICY_DENIED',
      `Action '${action}' needs confirmation${rule} and cannot be confirmed here: ${describeCommand(action, params)}`,
      `Move '${action}' to the policy's "allow" list — script and mcp runs have no terminal to prompt on.`,
    );
  }
  throw new BrowserCliError(
    'POLICY_DENIED',
    `Action '${action}' is blocked by the active policy${rule}: ${describeCommand(action, params)}`,
    `Move '${action}' to the policy's "allow" list, or run without --policy / BROWSER_CLI_POLICY.`,
  );
}

const SUMMARY_KEYS = [
  'url',
  'selector',
  'expression',
  'text',
  'value',
  'key',
  'name',
  'path',
] as const;

/** One-line "what is about to happen" for the confirmation prompt. */
export function describeCommand(action: string, params: unknown): string {
  if (params === null || typeof params !== 'object') return action;
  const record = params as Record<string, unknown>;
  for (const key of SUMMARY_KEYS) {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0) continue;
    const flat = value.replace(/\s+/g, ' ');
    const shown = flat.length > 100 ? `${flat.slice(0, 100)}…` : flat;
    return `${action} ${key}=${shown}`;
  }
  return action;
}

/** Whether a confirmation prompt can actually reach a human right now. */
export function canPromptConfirm(): boolean {
  return process.stdin.isTTY && process.stderr.isTTY;
}

/** Ask on stderr so stdout stays a clean data channel. Default is no. */
export async function promptConfirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
  try {
    const answer = await new Promise<string>((res) => rl.question(question, res));
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
