const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

function timestamp(): string {
  return DIM + new Date().toLocaleTimeString() + RESET;
}

export const logger = {
  info(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${CYAN}ℹ${RESET} ${msg}`, ...args);
  },
  success(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${GREEN}✓${RESET} ${msg}`, ...args);
  },
  warn(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${YELLOW}⚠${RESET} ${msg}`, ...args);
  },
  error(msg: string, ...args: unknown[]) {
    console.error(`${timestamp()} ${RED}✗${RESET} ${msg}`, ...args);
  },
  debug(msg: string, ...args: unknown[]) {
    if (process.env.DEBUG) {
      console.error(`${timestamp()} ${DIM}DBG${RESET} ${msg}`, ...args);
    }
  },
};
