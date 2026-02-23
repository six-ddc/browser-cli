import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_WS_PORT, E2E_DIR } from './helpers/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../apps/cli/bin/cli.js');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CHROME_PROFILE = path.resolve(__dirname, '../../.e2e-chrome-profile');

export default async function globalSetup() {
  // Ensure CLI is built
  if (!existsSync(CLI_BIN)) {
    throw new Error(
      `CLI not built: ${CLI_BIN} not found. Run 'pnpm build' first.`,
    );
  }

  // Clean Chrome profile to avoid stale cached extension state
  rmSync(CHROME_PROFILE, { recursive: true, force: true });

  // Rebuild extension with E2E WS port baked in
  execSync(`pnpm --filter @browser-cli/extension build`, {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    timeout: 30_000,
    env: { ...process.env, VITE_WS_PORT: String(E2E_WS_PORT) },
  });

  // Create isolated dir for E2E
  mkdirSync(E2E_DIR, { recursive: true });

  const cliEnv = { ...process.env, BROWSER_CLI_DIR: E2E_DIR };

  // Stop any existing daemon from a previous run
  try {
    execFileSync('node', [CLI_BIN, 'stop'], {
      encoding: 'utf-8',
      timeout: 10_000,
      env: cliEnv,
    });
  } catch {
    // Ignore — daemon may not be running
  }

  // Start the daemon on the E2E port
  try {
    execFileSync('node', [CLI_BIN, 'start', '--port', String(E2E_WS_PORT)], {
      encoding: 'utf-8',
      timeout: 15_000,
      env: cliEnv,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to start daemon: ${msg}`);
  }

  // Wait for the daemon socket to appear (15s timeout)
  const deadline = Date.now() + 15_000;
  let socketFound = false;

  while (Date.now() < deadline) {
    try {
      const files = readdirSync(E2E_DIR);
      if (files.some((f) => f === 'daemon.sock')) {
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
}
