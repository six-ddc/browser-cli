import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BrowserCliError, normalizeError, socketTimeoutFor } from '@browser-cli/shared';
import type { Command as BrowserCommand } from '@browser-cli/shared';
import { SocketClient } from '../client/socket-client.js';
import { ensureDaemon } from '../daemon/process.js';
import { getSocketPath } from '../util/paths.js';
import { logger } from '../util/logger.js';
import { enforceActionNonInteractive } from '../lib/policy.js';
import type { ToolProfile } from './profiles.js';
import { toolsForProfiles, type McpTool, type ToolContent } from './tools.js';

const CONNECT_TIMEOUT_MS = 5000;

/**
 * Owns the single daemon connection shared by every tool call, and reconnects
 * when the daemon was restarted underneath us.
 */
class DaemonBridge {
  private client = new SocketClient();
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      await ensureDaemon();
    } catch (err) {
      throw new BrowserCliError(
        'EXTENSION_NOT_CONNECTED',
        `Failed to start the browser-cli daemon: ${(err as Error).message}`,
        'Start it manually with: browser-cli start',
      );
    }

    const socketPath = getSocketPath();
    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    let lastErr: Error | undefined;
    while (Date.now() < deadline) {
      try {
        await this.client.connect(socketPath);
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err as Error;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    if (lastErr) {
      throw new BrowserCliError(
        'EXTENSION_NOT_CONNECTED',
        `Failed to connect to the browser-cli daemon socket: ${lastErr.message}`,
        `Is the daemon running? Try: browser-cli start (socket: ${socketPath})`,
      );
    }
    this.connected = true;
  }

  disconnect(): void {
    this.client.disconnect();
    this.connected = false;
  }

  async send(command: BrowserCommand): Promise<unknown> {
    enforceActionNonInteractive(command.action, (command as { params?: unknown }).params);
    await this.connect();
    let response;
    try {
      response = await this.client.sendCommand(command, {
        timeout: socketTimeoutFor(command) + 5_000,
      });
    } catch (err) {
      this.reset();
      const message = (err as Error).message;
      throw new BrowserCliError(
        message.includes('timed out') ? 'TIMEOUT' : 'EXTENSION_NOT_CONNECTED',
        message,
        'The daemon did not answer. Check it is alive with: browser-cli status',
      );
    }
    if (!response.success) {
      const error = normalizeError(response.error ?? { message: 'Unknown error' });
      throw new BrowserCliError(error.code, error.message, error.hint, error.stack);
    }
    return response.data ?? {};
  }

  private reset(): void {
    this.client.disconnect();
    this.client = new SocketClient();
    this.connected = false;
  }
}

function errorContent(err: unknown): ToolContent[] {
  const error =
    err instanceof BrowserCliError
      ? err.toProtocolError()
      : normalizeError({ message: (err as Error).message });
  const lines = [`[${error.code}] ${error.message}`];
  if (error.hint) lines.push(`hint: ${error.hint}`);
  return [{ type: 'text', text: lines.join('\n') }];
}

function register(server: McpServer, tool: McpTool, bridge: DaemonBridge): void {
  server.registerTool(tool.name, tool.config, async (args: Record<string, unknown>) => {
    try {
      const content = await tool.run(args, (command) => bridge.send(command));
      return { content };
    } catch (err) {
      return { content: errorContent(err), isError: true };
    }
  });
}

export interface McpServerOptions {
  profiles: Set<ToolProfile>;
}

/** Build the MCP server with the tools of the selected profiles registered. */
export function createMcpServer(options: McpServerOptions): {
  server: McpServer;
  bridge: DaemonBridge;
  tools: McpTool[];
} {
  const server = new McpServer(
    { name: 'browser-cli', version: __APP_VERSION__ },
    {
      instructions:
        'Drives a real browser through the browser-cli extension. Start with `snapshot` to see the page: it returns an accessibility tree whose interactive nodes carry @eN refs, and those refs are what click/fill/type_text/press expect. Re-snapshot after any navigation or state change, because refs go stale. Use `screenshot` only when the visual layout matters.',
    },
  );

  const tools = toolsForProfiles(options.profiles);
  const bridge = new DaemonBridge();
  for (const tool of tools) register(server, tool, bridge);

  return { server, bridge, tools };
}

/** Run the MCP server over stdio until the client disconnects. */
export async function runMcpServer(options: McpServerOptions): Promise<void> {
  const { server, bridge, tools } = createMcpServer(options);

  await bridge.connect();
  logger.info(
    `MCP server ready — ${tools.length} tools from profiles: ${[...options.profiles].join(', ')}`,
  );

  const closed = new Promise<void>((resolve) => {
    server.server.onclose = () => {
      resolve();
    };
  });

  await server.connect(new StdioServerTransport());

  const shutdown = () => {
    void server.close().finally(() => {
      bridge.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await closed;
  bridge.disconnect();
}
