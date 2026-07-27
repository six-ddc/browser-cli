import {
  BrowserCliError,
  COMMAND_TIMEOUT_MS,
  normalizeError,
  protocolError,
  socketTimeoutFor,
} from '@browser-cli/shared';
import type { DaemonRequest, DaemonResponse, RequestMessage } from '@browser-cli/shared';
import type { WsServer } from './ws-server.js';
import type { WatchManager } from './watch-manager.js';
import { logger } from '../util/logger.js';

/**
 * Bridge between CLI socket requests and Extension WebSocket.
 * Converts DaemonRequest → RequestMessage, sends to extension,
 * and converts ResponseMessage → DaemonResponse.
 */
export class Bridge {
  private watchManager: WatchManager | null = null;

  constructor(private wsServer: WsServer) {}

  /** Inject WatchManager (called from daemon/index.ts after construction) */
  setWatchManager(wm: WatchManager): void {
    this.watchManager = wm;
  }

  /** Helper to send a request to the extension via WsServer */
  private sendToExtension(msg: RequestMessage, sessionId?: string): Promise<unknown> {
    return this.wsServer.sendRequest(msg, COMMAND_TIMEOUT_MS, sessionId).then((resp) => {
      if (!resp.success) {
        throw new Error(resp.error?.message || 'Extension command failed');
      }
      return resp.data;
    });
  }

  async handleRequest(req: DaemonRequest): Promise<DaemonResponse> {
    // networkWatchFile reads local watch metadata/files — no extension round
    // trip needed, so this must be handled before the connectivity check
    // below (the extension may not even be connected).
    if (req.command.action === 'networkWatchFile' && this.watchManager) {
      try {
        const params = req.command.params as { watchId?: string };
        const result = this.watchManager.getWatchFile(params.watchId);
        return { id: req.id, success: true, data: result };
      } catch (err) {
        return { id: req.id, success: false, error: errorFrom(err) };
      }
    }

    // If a specific session is requested, check that connection
    if (req.sessionId) {
      const conn = this.wsServer.getConnection(req.sessionId);
      if (!conn) {
        const available = this.wsServer.allConnections.map((c) => c.sessionId).join(', ');
        return {
          id: req.id,
          success: false,
          error: protocolError(
            'SESSION_NOT_FOUND',
            `Browser session '${req.sessionId}' not found.${available ? ` Connected: ${available}` : ' No browsers connected.'}`,
            "Run 'browser-cli status' to see connected browsers, then use --session <sessionId> to target one.",
          ),
        };
      }
    } else if (!this.wsServer.isConnected) {
      return {
        id: req.id,
        success: false,
        error: protocolError(
          'EXTENSION_NOT_CONNECTED',
          'Extension is not connected to the daemon.',
          "Check that the Browser-CLI extension is installed, enabled, and the browser is open, then run 'browser-cli status' to verify.",
        ),
      };
    }

    // Intercept networkWatch / networkUnwatch — handled by WatchManager
    if (req.command.action === 'networkWatch' && this.watchManager) {
      try {
        const params = req.command.params as {
          pattern?: string;
          timeout?: number;
          body?: boolean;
          method?: string;
          json?: boolean;
        };
        const result = await this.watchManager.startWatch(req.tabId ?? 0, params, (msg) =>
          this.sendToExtension(msg, req.sessionId),
        );
        return { id: req.id, success: true, data: result };
      } catch (err) {
        return { id: req.id, success: false, error: errorFrom(err) };
      }
    }

    if (req.command.action === 'networkUnwatch' && this.watchManager) {
      try {
        const result = await this.watchManager.stopWatch(req.tabId, (msg) =>
          this.sendToExtension(msg, req.sessionId),
        );
        return { id: req.id, success: true, data: result };
      } catch (err) {
        return { id: req.id, success: false, error: errorFrom(err) };
      }
    }

    const wsRequest: RequestMessage = {
      id: req.id,
      type: 'request',
      command: req.command,
      tabId: req.tabId,
    };

    try {
      const response = await this.wsServer.sendRequest(
        wsRequest,
        socketTimeoutFor(req.command),
        req.sessionId,
      );
      return {
        id: req.id,
        success: response.success,
        data: response.data as DaemonResponse['data'],
        error: response.error ? normalizeError(response.error) : undefined,
      };
    } catch (err) {
      const error = errorFrom(err);
      logger.error(`Command ${req.command.action} failed:`, error.message);
      return {
        id: req.id,
        success: false,
        error,
      };
    }
  }
}

/** Daemon-side failures: timeouts get their own code, everything else is UNKNOWN. */
function errorFrom(err: unknown) {
  if (err instanceof BrowserCliError) return err.toProtocolError();
  const message = err instanceof Error ? err.message : String(err);
  if (/timed out/i.test(message)) {
    return protocolError(
      'TIMEOUT',
      message,
      'The extension did not answer in time. Check the browser is responsive and the page is not blocking on a dialog.',
    );
  }
  return normalizeError({ message });
}
