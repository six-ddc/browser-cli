import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_DIR } from './helpers/constants';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../apps/cli/bin/cli.js');

export default async function globalTeardown() {
  const cliEnv = { ...process.env, BROWSER_CLI_DIR: E2E_DIR };

  // Stop the daemon
  try {
    execFileSync('node', [CLI_BIN, 'stop'], {
      encoding: 'utf-8',
      timeout: 10_000,
      env: cliEnv,
    });
  } catch {
    // Ignore — daemon may already be stopped
  }

  // Clean up the isolated directory
  try {
    rmSync(E2E_DIR, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}
