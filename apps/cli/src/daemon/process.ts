import { spawn, type ChildProcess } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  openSync,
  closeSync,
  constants,
} from 'node:fs';
import { getPidPath, getSocketPath } from '../util/paths.js';
import { logger } from '../util/logger.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Check if a process with given PID is running */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Read daemon PID from file, or null if not running */
export function getDaemonPid(): number | null {
  const pidPath = getPidPath();
  if (!existsSync(pidPath)) return null;

  try {
    const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
    if (isNaN(pid)) return null;
    if (!isProcessRunning(pid)) {
      // Stale PID file
      cleanupPidFile();
      return null;
    }
    return pid;
  } catch {
    return null;
  }
}

/** Write daemon PID to file using exclusive create to prevent races */
export function writeDaemonPid(pid: number): void {
  const pidPath = getPidPath();
  try {
    // O_CREAT | O_EXCL | O_WRONLY — fails if file already exists
    const fd = openSync(pidPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
    writeFileSync(fd, String(pid), 'utf-8');
    closeSync(fd);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      // File already exists — overwrite (e.g., stale PID file from crashed daemon)
      writeFileSync(pidPath, String(pid), 'utf-8');
    } else {
      throw err;
    }
  }
}

/** Clean up PID and socket files */
export function cleanupPidFile(): void {
  const pidPath = getPidPath();
  const sockPath = getSocketPath();
  try {
    if (existsSync(pidPath)) unlinkSync(pidPath);
  } catch {
    // ignore
  }
  try {
    if (!sockPath.startsWith('\\\\.\\pipe\\') && existsSync(sockPath)) unlinkSync(sockPath);
  } catch {
    // ignore
  }
}

/** Check if daemon is running */
export function isDaemonRunning(): boolean {
  return getDaemonPid() !== null;
}

/** Wait for daemon child to signal readiness or failure via IPC */
function waitForDaemonReady(child: ChildProcess, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Daemon startup timed out'));
    }, timeout);

    child.on('message', (msg: unknown) => {
      clearTimeout(timer);
      const m = msg as Record<string, unknown>;
      if (m.ready) {
        resolve();
      } else if (m.error) {
        reject(new Error(typeof m.error === 'string' ? m.error : JSON.stringify(m.error)));
      }
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Daemon exited during startup (code ${code})`));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn daemon: ${err.message}`));
    });
  });
}

/** Start the daemon as a detached child process */
export async function startDaemon(wsPort?: number): Promise<number> {
  const existing = getDaemonPid();
  if (existing) {
    logger.info(`Daemon already running (PID ${existing})`);
    return existing;
  }

  // Find the daemon entry point
  // When built, it's at dist/daemon/index.js relative to the CLI package
  const daemonEntry = new URL('./daemon/index.js', import.meta.url).pathname;

  const args = ['--daemon'];
  if (wsPort) args.push('--port', String(wsPort));

  const child = spawn(process.execPath, [daemonEntry, ...args], {
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: { ...process.env },
  });

  if (!child.pid) {
    throw new Error('Failed to start daemon process');
  }

  // Wait for daemon to signal readiness via IPC before reporting success
  try {
    await waitForDaemonReady(child, 5000);
  } catch (err) {
    try {
      child.kill();
    } catch {
      // Process may have already exited
    }
    cleanupPidFile();
    throw err;
  }

  // Daemon is ready — disconnect IPC and detach so parent can exit
  child.disconnect();
  child.unref();

  return child.pid;
}

/** Stop the daemon, waiting for process exit */
export async function stopDaemon(): Promise<boolean> {
  const pid = getDaemonPid();
  if (!pid) return false;

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process may have already exited
    cleanupPidFile();
    return true;
  }

  // Poll until process exits (max 5s)
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      cleanupPidFile();
      return true;
    }
    await sleep(100);
  }

  // Process didn't die — try SIGKILL
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // ignore
  }
  await sleep(200);
  cleanupPidFile();
  return true;
}

/** Ensure the daemon is running, starting it if necessary */
export async function ensureDaemon(wsPort?: number): Promise<number> {
  const existing = getDaemonPid();
  if (existing) return existing;
  return startDaemon(wsPort);
}
