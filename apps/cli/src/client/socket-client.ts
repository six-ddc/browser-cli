import { connect, Socket } from 'node:net';
import { randomUUID } from 'node:crypto';
import { COMMAND_TIMEOUT_MS } from '@browser-cli/shared';
import type { Command, DaemonRequest, DaemonResponse } from '@browser-cli/shared';

/**
 * CLI-side client that connects to the daemon's Unix socket.
 * Sends commands as NDJSON and reads responses.
 */
export class SocketClient {
  private socket: Socket | null = null;

  /** Connect to the daemon socket */
  connect(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = connect(socketPath);

      this.socket.on('connect', () => resolve());
      this.socket.on('error', (err) => reject(err));
    });
  }

  /** Send a command and wait for the response */
  sendCommand(
    command: Command,
    options?: { tabId?: number; timeout?: number; sessionId?: string },
  ): Promise<DaemonResponse> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected to daemon'));
        return;
      }

      const id = randomUUID();
      const request: DaemonRequest = {
        id,
        command,
        tabId: options?.tabId,
        sessionId: options?.sessionId,
      };

      const timeout = options?.timeout ?? COMMAND_TIMEOUT_MS;
      const timer = setTimeout(() => {
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      let buffer = '';
      const onData = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response = JSON.parse(line) as DaemonResponse;
            if (response.id === id) {
              clearTimeout(timer);
              this.socket?.off('data', onData);
              resolve(response);
            }
          } catch {
            // ignore parse errors
          }
        }
      };

      this.socket.on('data', onData);
      this.socket.write(JSON.stringify(request) + '\n');
    });
  }

  /** Disconnect from the daemon */
  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}
