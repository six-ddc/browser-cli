import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { getPidPath, getSocketPath } from '../util/paths.js';
import { logger } from '../util/logger.js';

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

/** Write daemon PID to file */
export function writeDaemonPid(pid: number): void {
  writeFileSync(getPidPath(), String(pid), 'utf-8');
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

/** Start the daemon as a detached child process */
export function startDaemon(wsPort?: number): number {
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
    stdio: 'ignore',
    env: { ...process.env },
  });

  child.unref();

  if (!child.pid) {
    throw new Error('Failed to start daemon process');
  }

  writeDaemonPid(child.pid);
  return child.pid;
}

/** Stop the daemon */
export function stopDaemon(): boolean {
  const pid = getDaemonPid();
  if (!pid) return false;

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process may have already exited
  }

  cleanupPidFile();
  return true;
}

/** Ensure the daemon is running, starting it if necessary */
export function ensureDaemon(wsPort?: number): number {
  const existing = getDaemonPid();
  if (existing) return existing;
  return startDaemon(wsPort);
}
