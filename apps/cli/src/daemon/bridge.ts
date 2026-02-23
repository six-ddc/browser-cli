import { COMMAND_TIMEOUT_MS, ErrorCode, createError } from '@browser-cli/shared';
import type { DaemonRequest, DaemonResponse, RequestMessage } from '@browser-cli/shared';
import type { WsServer } from './ws-server.js';
import { logger } from '../util/logger.js';

/**
 * Bridge between CLI socket requests and Extension WebSocket.
 * Converts DaemonRequest → RequestMessage, sends to extension,
 * and converts ResponseMessage → DaemonResponse.
 */
export class Bridge {
  constructor(private wsServer: WsServer) {}

  async handleRequest(req: DaemonRequest): Promise<DaemonResponse> {
    // If a specific session is requested, check that connection
    if (req.sessionId) {
      const conn = this.wsServer.getConnection(req.sessionId);
      if (!conn) {
        const available = this.wsServer.allConnections.map((c) => c.sessionId).join(', ');
        return {
          id: req.id,
          success: false,
          error: createError(
            ErrorCode.EXTENSION_NOT_CONNECTED,
            `Browser session '${req.sessionId}' not found.${available ? ` Connected: ${available}` : ' No browsers connected.'}`,
            "Run 'browser-cli status' to see connected browsers, then use --session <sessionId> to target one.",
          ),
        };
      }
    } else if (!this.wsServer.isConnected) {
      return {
        id: req.id,
        success: false,
        error: createError(
          ErrorCode.EXTENSION_NOT_CONNECTED,
          'Extension is not connected. Please ensure the Browser-CLI extension is installed and enabled.',
          "Check that the Browser-CLI extension is installed, enabled, and the browser is open. Run 'browser-cli status' to verify.",
        ),
      };
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
      const code =
        msg.includes('disconnected') || msg.includes('not connected')
          ? ErrorCode.EXTENSION_NOT_CONNECTED
          : ErrorCode.TIMEOUT;
      return {
        id: req.id,
        success: false,
        error: createError(code, msg),
      };
    }
  }
}
