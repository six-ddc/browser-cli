/**
 * Executor shared by `batch` and `repl`: parses CLI-style command lines and
 * runs them serially over a single daemon connection.
 */

import type { Command } from 'commander';
import { CommanderError } from 'commander';
import { BrowserCliError, normalizeError, type ProtocolError } from '@browser-cli/shared';
import { SocketClient } from '../client/socket-client.js';
import { ensureDaemon } from '../daemon/process.js';
import { getSocketPath } from '../util/paths.js';
import { setBatchContext, type BatchContext } from '../commands/shared.js';
import { createProgram, makeNonExiting } from './program.js';

/** Commands that manage the daemon itself; running them mid-batch would cut the connection. */
const DISALLOWED = new Set(['batch', 'repl', 'start', 'stop']);

export interface BatchLineResult {
  line: number;
  command: string;
  success: boolean;
  /** Whatever the command printed to stdout, verbatim. */
  output?: string;
  data?: unknown;
  error?: ProtocolError;
}

/**
 * Split a command line the way a POSIX shell would: whitespace separates
 * arguments, single quotes are literal, double quotes allow backslash escapes.
 */
export function splitArgs(line: string): string[] {
  const args: string[] = [];
  let current = '';
  let started = false;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;

    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === '\\' && i + 1 < line.length && '"\\$`'.includes(line[i + 1] as string)) {
        current += line[++i] as string;
      } else current += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      started = true;
      continue;
    }
    if (ch === '\\' && i + 1 < line.length) {
      current += line[++i] as string;
      started = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (started) {
        args.push(current);
        current = '';
        started = false;
      }
      continue;
    }
    current += ch;
    started = true;
  }

  if (quote) throw new Error(`Unbalanced ${quote === '"' ? 'double' : 'single'} quote`);
  if (started) args.push(current);
  return args;
}

/** Drop blank lines and `#` comments; keep the original line numbers. */
export function parseBatchInput(input: string): Array<{ line: number; text: string }> {
  return input
    .split('\n')
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter(({ text }) => text.length > 0 && !text.startsWith('#'));
}

export interface BatchRunnerOptions {
  sessionId?: string;
  tabId?: number;
}

/**
 * Owns the shared daemon connection and the Commander instance for a run of
 * many command lines.
 */
export class BatchRunner {
  private program: Command;
  private client = new SocketClient();
  private context: BatchContext;
  private connected = false;
  private commanderErr = '';

  constructor(private options: BatchRunnerOptions = {}) {
    this.program = createProgram();
    makeNonExiting(this.program, (str) => {
      this.commanderErr += str;
    });
    this.context = {
      client: this.client,
      sessionId: options.sessionId,
      tabId: options.tabId,
    };
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await ensureDaemon();
    const socketPath = getSocketPath();
    const deadline = Date.now() + 5000;
    let lastErr: Error | undefined;
    while (Date.now() < deadline) {
      try {
        await this.client.connect(socketPath);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err as Error;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (lastErr) {
      throw new BrowserCliError(
        'EXTENSION_NOT_CONNECTED',
        `Failed to connect to daemon: ${lastErr.message}`,
        'Is the daemon running? Try: browser-cli start',
      );
    }
    this.connected = true;
  }

  disconnect(): void {
    this.client.disconnect();
    this.connected = false;
  }

  /** Run one command line. Never throws — failures come back on the result. */
  async run(text: string, lineNumber: number): Promise<BatchLineResult> {
    const base: BatchLineResult = { line: lineNumber, command: text, success: false };

    let argv: string[];
    try {
      argv = splitArgs(text);
    } catch (err) {
      return { ...base, error: invalidArgs((err as Error).message) };
    }
    if (argv.length === 0) {
      return { ...base, error: invalidArgs('Empty command') };
    }
    if (DISALLOWED.has(argv[0] as string)) {
      return {
        ...base,
        error: invalidArgs(
          `'${argv[0]}' cannot run inside batch or repl`,
          'Daemon lifecycle and nested batches must run as their own process.',
        ),
      };
    }

    // Everything the command prints to stdout belongs to this line's result,
    // not to the NDJSON stream.
    const captured: string[] = [];
    const realLog = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(args.map((a) => (typeof a === 'string' ? a : String(a))).join(' '));
    };
    this.commanderErr = '';
    this.context.lastData = undefined;
    setBatchContext(this.context);

    try {
      await this.program.parseAsync(argv, { from: 'user' });
      const output = captured.join('\n');
      const result: BatchLineResult = { ...base, success: true };
      if (output) result.output = output;
      if (this.context.lastData !== undefined) result.data = this.context.lastData;
      return result;
    } catch (err) {
      const output = captured.join('\n');
      const result: BatchLineResult = { ...base, error: toProtocolError(err, this.commanderErr) };
      if (output) result.output = output;
      return result;
    } finally {
      console.log = realLog;
      setBatchContext(null);
    }
  }
}

function invalidArgs(message: string, hint?: string): ProtocolError {
  return {
    code: 'INVALID_ARGS',
    message,
    hint: hint ?? "Use CLI syntax, one command per line — see 'browser-cli --help-all'.",
  };
}

function toProtocolError(err: unknown, commanderErr: string): ProtocolError {
  if (err instanceof BrowserCliError) return err.toProtocolError();
  if (err instanceof CommanderError) {
    return invalidArgs(commanderErr.trim() || err.message);
  }
  return normalizeError({ message: (err as Error).message });
}
