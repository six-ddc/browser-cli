import { COMMAND_TIMEOUT_MS, ErrorCode, createError } from '@browser-cli/shared';
import type {
  DaemonRequest,
  DaemonResponse,
  RequestMessage,
} from '@browser-cli/shared';
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
    if (!this.wsServer.isConnected) {
      return {
        id: req.id,
        success: false,
        error: createError(
          ErrorCode.EXTENSION_NOT_CONNECTED,
          'Extension is not connected. Please ensure the Browser-CLI extension is installed and enabled.',
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
      const response = await this.wsServer.sendRequest(wsRequest, COMMAND_TIMEOUT_MS);
      return {
        id: req.id,
        success: response.success,
        data: response.data,
        error: response.error,
      };
    } catch (err) {
      logger.error(`Command ${req.command.action} failed:`, (err as Error).message);
      return {
        id: req.id,
        success: false,
        error: createError(
          ErrorCode.TIMEOUT,
          (err as Error).message,
        ),
      };
    }
  }
}
