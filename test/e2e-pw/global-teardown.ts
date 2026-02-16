import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../apps/cli/bin/cli.js');
const STATE_FILE = path.resolve(__dirname, '../../.e2e-state.json');

export default async function globalTeardown() {
  let session = 'e2e-pw';

  try {
    const state = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    session = state.session || session;
  } catch {
    // Use default session
  }

  // Stop the daemon
  try {
    execFileSync('node', [CLI_BIN, 'stop', '--session', session], {
      encoding: 'utf-8',
      timeout: 10_000,
    });
  } catch {
    // Ignore — daemon may already be stopped
  }

  // Clean up state file
  try {
    unlinkSync(STATE_FILE);
  } catch {
    // Ignore
  }
}
