import { COMMAND_TIMEOUT_MS } from '@browser-cli/shared';
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
    // If a specific session is requested, check that connection
    if (req.sessionId) {
      const conn = this.wsServer.getConnection(req.sessionId);
      if (!conn) {
        const available = this.wsServer.allConnections.map((c) => c.sessionId).join(', ');
        return {
          id: req.id,
          success: false,
          error: {
            message: `Browser session '${req.sessionId}' not found.${available ? ` Connected: ${available}` : ' No browsers connected.'} Run 'browser-cli status' to see connected browsers, then use --session <sessionId> to target one.`,
          },
        };
      }
    } else if (!this.wsServer.isConnected) {
      return {
        id: req.id,
        success: false,
        error: {
          message:
            "Extension is not connected. Please ensure the Browser-CLI extension is installed and enabled. Check that the Browser-CLI extension is installed, enabled, and the browser is open. Run 'browser-cli status' to verify.",
        },
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
        };
        const result = await this.watchManager.startWatch(req.tabId ?? 0, params, (msg) =>
          this.sendToExtension(msg, req.sessionId),
        );
        return { id: req.id, success: true, data: result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { id: req.id, success: false, error: { message: msg } };
      }
    }

    if (req.command.action === 'networkUnwatch' && this.watchManager) {
      try {
        const result = await this.watchManager.stopWatch(req.tabId, (msg) =>
          this.sendToExtension(msg, req.sessionId),
        );
        return { id: req.id, success: true, data: result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { id: req.id, success: false, error: { message: msg } };
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
        COMMAND_TIMEOUT_MS,
        req.sessionId,
      );
      return {
        id: req.id,
        success: response.success,
        data: response.data as DaemonResponse['data'],
        error: response.error,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Command ${req.command.action} failed:`, msg);
      return {
        id: req.id,
        success: false,
        error: { message: msg },
      };
    }
  }
}
