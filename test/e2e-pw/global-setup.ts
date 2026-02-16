import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../apps/cli/bin/cli.js');
const SESSION = 'e2e-pw';
const STATE_FILE = path.resolve(__dirname, '../../.e2e-state.json');

export default async function globalSetup() {
  // Ensure CLI is built
  if (!existsSync(CLI_BIN)) {
    throw new Error(
      `CLI not built: ${CLI_BIN} not found. Run 'pnpm build' first.`,
    );
  }

  // Stop any existing daemon from a previous run
  try {
    execFileSync('node', [CLI_BIN, 'stop', '--session', SESSION], {
      encoding: 'utf-8',
      timeout: 10_000,
    });
  } catch {
    // Ignore — daemon may not be running
  }

  // Start the daemon
  try {
    execFileSync('node', [CLI_BIN, 'start', '--session', SESSION], {
      encoding: 'utf-8',
      timeout: 15_000,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to start daemon: ${msg}`);
  }

  // Wait for the daemon socket to appear (15s timeout)
  const socketDir = path.join(os.homedir(), '.browser-cli');
  const deadline = Date.now() + 15_000;
  let socketFound = false;

  while (Date.now() < deadline) {
    try {
      const files = readdirSync(socketDir);
      if (files.some((f) => f.startsWith(SESSION) && f.endsWith('.sock'))) {
        socketFound = true;
        break;
      }
    } catch {
      // Directory may not exist yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }

  if (!socketFound) {
    throw new Error('Daemon did not become ready within 15s');
  }

  // Write state for teardown
  writeFileSync(STATE_FILE, JSON.stringify({ session: SESSION }));
}
