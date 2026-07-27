import { Command } from 'commander';
import { connect as netConnect } from 'node:net';
import { getDaemonPid, startDaemon, stopDaemon } from '../daemon/process.js';
import { getSocketPath, getWsPort } from '../util/paths.js';
import { getRootOpts } from './shared.js';
import { queryDaemonStatus, type StatusData } from './lifecycle.js';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
}

export interface DoctorSummary {
  passed: number;
  failed: number;
}

/** Probe whether a TCP port accepts connections, with a short timeout. */
function probePort(port: number, host: string, timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = netConnect({ port, host, timeout: timeoutMs });
    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/** Run all doctor checks and return the results. Pure aside from I/O probes. */
export async function runChecks(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  // 1. Daemon process
  const pid = getDaemonPid();
  checks.push(
    pid
      ? { name: 'daemon process', ok: true, detail: `running (PID ${pid})` }
      : {
          name: 'daemon process',
          ok: false,
          detail: 'not running',
          hint: 'run: browser-cli start',
        },
  );

  // 2. Socket connectable
  let status: StatusData | null = null;
  if (pid) {
    status = await queryDaemonStatus();
  }
  checks.push(
    status
      ? { name: 'socket', ok: true, detail: `connectable at ${getSocketPath()}` }
      : {
          name: 'socket',
          ok: false,
          detail: `not connectable at ${getSocketPath()}`,
          hint: pid ? 'run: browser-cli stop && browser-cli start' : 'run: browser-cli start',
        },
  );

  // 3. WS port
  const wsPort = status?.wsPort ?? getWsPort();
  const wsHost = status?.wsHost ?? '127.0.0.1';
  const portOpen = await probePort(wsPort, wsHost === '0.0.0.0' ? '127.0.0.1' : wsHost);
  if (status) {
    // Daemon reports it owns this port — a successful probe just confirms it's up.
    checks.push({
      name: 'ws port',
      ok: portOpen,
      detail: portOpen
        ? `daemon listening on ${wsHost}:${wsPort}`
        : `daemon reports port ${wsPort} but it is not accepting connections`,
      hint: portOpen ? undefined : 'run: browser-cli stop && browser-cli start',
    });
  } else if (portOpen) {
    checks.push({
      name: 'ws port',
      ok: false,
      detail: `port ${wsPort} is in use by another process (daemon is not running)`,
      hint: `free the port, or run: browser-cli start --port <other-port>`,
    });
  } else {
    checks.push({
      name: 'ws port',
      ok: true,
      detail: `port ${wsPort} is free`,
    });
  }

  // 4. Extension connection
  const connections = status?.connections ?? [];
  checks.push(
    connections.length > 0
      ? { name: 'extension', ok: true, detail: `${connections.length} connection(s)` }
      : {
          name: 'extension',
          ok: false,
          detail: 'no extension connected',
          hint: 'check that the browser extension is installed and enabled, and that a browser window is open',
        },
  );

  // 5. Version
  const cliVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';
  const browserInfo = connections[0]?.browser;
  const browserDesc = browserInfo ? `${browserInfo.name} ${browserInfo.version}` : 'unknown';
  checks.push({
    name: 'version',
    ok: true,
    detail: `cli=${cliVersion} extension-browser=${browserDesc}`,
  });

  return checks;
}

/** Render a single check as a text line (plus an optional hint line). */
export function renderCheck(check: DoctorCheck): string[] {
  const lines = [`${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`];
  if (!check.ok && check.hint) {
    lines.push(`  → ${check.hint}`);
  }
  return lines;
}

/** Summarize pass/fail counts across checks. */
export function summarize(checks: DoctorCheck[]): DoctorSummary {
  const failed = checks.filter((c) => !c.ok).length;
  return { passed: checks.length - failed, failed };
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose daemon, socket, port, and extension connectivity')
  .option('--fix', 'Attempt to restart the daemon if it is not running or unreachable')
  .action(async (opts: { fix?: boolean }, cmd: Command) => {
    const rootOpts = getRootOpts(cmd);

    let checks = await runChecks();

    if (opts.fix) {
      const daemonCheck = checks.find((c) => c.name === 'daemon process');
      const socketCheck = checks.find((c) => c.name === 'socket');
      if (daemonCheck && !daemonCheck.ok) {
        // Nothing to stop; just start.
        await startDaemon().catch(() => undefined);
        checks = await runChecks();
      } else if (socketCheck && !socketCheck.ok) {
        await stopDaemon().catch(() => undefined);
        await startDaemon().catch(() => undefined);
        checks = await runChecks();
      }
    }

    const summary = summarize(checks);

    if (rootOpts.json) {
      console.log(
        JSON.stringify({
          success: summary.failed === 0,
          data: { checks, passed: summary.passed, failed: summary.failed },
        }),
      );
      process.exit(summary.failed === 0 ? 0 : 1);
    }

    for (const check of checks) {
      for (const line of renderCheck(check)) console.log(line);
    }
    console.log(`\n${summary.passed} passed, ${summary.failed} failed`);

    process.exit(summary.failed === 0 ? 0 : 1);
  });
