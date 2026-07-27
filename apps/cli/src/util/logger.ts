import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

// eslint-disable-next-line no-control-regex -- deliberately matching ANSI escape codes to strip them
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024; // 5MB

let fileLogPath: string | null = null;

/**
 * Enable writing log output to a file in addition to stderr, as plain text
 * (ANSI escapes stripped). Intended for the daemon process only — the CLI
 * client process should never call this. Failures to write are swallowed so
 * logging can never crash the daemon.
 */
export function enableFileLogging(filePath: string): void {
  fileLogPath = filePath;
}

/**
 * Hand stdout over to a protocol that owns it (MCP stdio): every console
 * channel except `console.error`/`console.warn` is rerouted to stderr so a
 * stray print can never corrupt the framing.
 */
export function reserveStdoutForProtocol(): void {
  const write = (...args: unknown[]): void => {
    process.stderr.write(formatArgs(args).trimStart() + '\n');
  };
  console.log = write;
  console.info = write;
  console.debug = write;
  console.trace = write;
}

function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

function formatArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  return (
    ' ' +
    args
      .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : String(a)))
      .join(' ')
  );
}

function rotateIfNeeded(filePath: string): void {
  try {
    if (!existsSync(filePath)) return;
    const size = statSync(filePath).size;
    if (size >= MAX_LOG_FILE_BYTES) {
      renameSync(filePath, `${filePath}.1`);
    }
  } catch {
    // ignore — rotation failure should not block logging
  }
}

function writeToFile(level: string, msg: string, args: unknown[]): void {
  if (!fileLogPath) return;
  try {
    rotateIfNeeded(fileLogPath);
    const line = `${new Date().toISOString()} ${level.padEnd(5)} ${stripAnsi(msg)}${stripAnsi(
      formatArgs(args),
    )}\n`;
    appendFileSync(fileLogPath, line);
  } catch {
    // ignore — never let file logging crash the daemon
  }
}

function timestamp(): string {
  return DIM + new Date().toLocaleTimeString() + RESET;
}

export const logger = {
  info(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${CYAN}ℹ${RESET} ${msg}`, ...args);
    writeToFile('INFO', msg, args);
  },
  success(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${GREEN}✓${RESET} ${msg}`, ...args);
    writeToFile('OK', msg, args);
  },
  warn(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${YELLOW}⚠${RESET} ${msg}`, ...args);
    writeToFile('WARN', msg, args);
  },
  error(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${RED}✗${RESET} ${msg}`, ...args);
    writeToFile('ERROR', msg, args);
  },
  debug(msg: string, ...args: unknown[]) {
    if (process.env.DEBUG) {
      console.error(`${timestamp()} ${DIM}DBG${RESET} ${msg}`, ...args);
      writeToFile('DEBUG', msg, args);
    }
  },
};
