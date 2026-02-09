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
export function getDaemonPid(session?: string): number | null {
  const pidPath = getPidPath(session);
  if (!existsSync(pidPath)) return null;

  try {
    const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
    if (isNaN(pid)) return null;
    if (!isProcessRunning(pid)) {
      // Stale PID file
      cleanupPidFile(session);
      return null;
    }
    return pid;
  } catch {
    return null;
  }
}

/** Write daemon PID to file */
export function writeDaemonPid(pid: number, session?: string): void {
  writeFileSync(getPidPath(session), String(pid), 'utf-8');
}

/** Clean up PID and socket files */
export function cleanupPidFile(session?: string): void {
  const pidPath = getPidPath(session);
  const sockPath = getSocketPath(session);
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

/** Check if daemon is running for a session */
export function isDaemonRunning(session?: string): boolean {
  return getDaemonPid(session) !== null;
}

/** Start the daemon as a detached child process */
export function startDaemon(session?: string, wsPort?: number): number {
  const existing = getDaemonPid(session);
  if (existing) {
    logger.info(`Daemon already running (PID ${existing})`);
    return existing;
  }

  // Find the daemon entry point
  // When built, it's at dist/daemon/index.js relative to the CLI package
  const daemonEntry = new URL('./daemon/index.js', import.meta.url).pathname;

  const args = ['--daemon'];
  if (session) args.push('--session', session);
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

  writeDaemonPid(child.pid, session);
  return child.pid;
}

/** Stop the daemon for a session */
export function stopDaemon(session?: string): boolean {
  const pid = getDaemonPid(session);
  if (!pid) return false;

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Process may have already exited
  }

  cleanupPidFile(session);
  return true;
}

/** Ensure the daemon is running, starting it if necessary */
export function ensureDaemon(session?: string, wsPort?: number): number {
  const existing = getDaemonPid(session);
  if (existing) return existing;
  return startDaemon(session, wsPort);
}
