import { test, expect } from '../fixtures';
import { PAGES, E2E_DIR } from '../helpers/constants';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_BIN = path.resolve(__dirname, '../../../apps/cli/bin/cli.js');

interface JsonRpcResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface ToolInfo {
  name: string;
  description: string;
  inputSchema: { properties?: Record<string, unknown>; required?: string[] };
}

interface ToolCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

/**
 * Minimal MCP stdio client: the `bcli` fixture uses execFileSync and cannot
 * hold a session open, so the server is driven as a long-lived child process.
 */
class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private pending = new Map<number, (res: JsonRpcResponse) => void>();
  private buffer = '';
  private nextId = 1;
  stderr = '';

  constructor(args: string[]) {
    this.child = spawn('node', [CLI_BIN, 'mcp', ...args], {
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', BROWSER_CLI_DIR: E2E_DIR },
    });
    this.child.stderr.on('data', (chunk: Buffer) => {
      this.stderr += chunk.toString();
    });
    this.child.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const message = JSON.parse(line) as JsonRpcResponse;
        const resolve = this.pending.get(message.id);
        if (resolve) {
          this.pending.delete(message.id);
          resolve(message);
        }
      }
    });
  }

  request(method: string, params: unknown, timeoutMs = 30_000): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`MCP request '${method}' timed out\nstderr: ${this.stderr}`));
      }, timeoutMs);
      this.pending.set(id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  notify(method: string, params: unknown): void {
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  async initialize(): Promise<Record<string, unknown>> {
    const res = await this.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'browser-cli-e2e', version: '0.0.0' },
    });
    expect(res.error, `initialize failed: ${JSON.stringify(res.error)}`).toBeUndefined();
    this.notify('notifications/initialized', {});
    return res.result ?? {};
  }

  async listTools(): Promise<ToolInfo[]> {
    const res = await this.request('tools/list', {});
    expect(res.error).toBeUndefined();
    return (res.result?.tools ?? []) as ToolInfo[];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const res = await this.request('tools/call', { name, arguments: args });
    expect(res.error, `tools/call ${name} failed: ${JSON.stringify(res.error)}`).toBeUndefined();
    return res.result as unknown as ToolCallResult;
  }

  close(): void {
    this.child.kill('SIGTERM');
  }
}

function textOf(result: ToolCallResult): string {
  return result.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n');
}

test.describe('mcp stdio server', () => {
  test('initialize, tools/list and a live tools/call round trip', async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const client = new McpClient(['--tools', 'core']);
    try {
      const init = await client.initialize();
      expect(init.protocolVersion).toBeTruthy();
      expect(init.serverInfo).toMatchObject({ name: 'browser-cli' });

      const tools = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('snapshot');
      expect(names).toContain('get_url');
      expect(names).toContain('click');
      // debug-profile tools stay hidden with --tools core
      expect(names).not.toContain('cdp');

      const snapshotTool = tools.find((t) => t.name === 'snapshot');
      expect(snapshotTool?.description).toContain('@e');
      expect(tools.find((t) => t.name === 'click')?.inputSchema.required).toContain('selector');

      const url = await client.callTool('get_url', {});
      expect(url.isError).toBeFalsy();
      expect(textOf(url)).toContain(PAGES.HOME);

      const title = await client.callTool('get_title', {});
      expect(title.isError).toBeFalsy();
      expect(textOf(title).length).toBeGreaterThan(0);

      // Nothing but JSON-RPC may reach stdout; logs belong on stderr.
      expect(client.stderr).toContain('MCP server ready');
    } finally {
      client.close();
    }
  });

  test('snapshot refs feed straight back into click', async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.CHECKBOXES);

    const client = new McpClient(['--tools', 'core']);
    try {
      await client.initialize();

      const snapshot = await client.callTool('snapshot', { interactive: true });
      expect(snapshot.isError).toBeFalsy();
      const ref = /@e\d+/.exec(textOf(snapshot))?.[0];
      expect(ref, 'snapshot should expose at least one @eN ref').toBeTruthy();

      const click = await client.callTool('click', { selector: ref });
      expect(click.isError).toBeFalsy();
    } finally {
      client.close();
    }
  });

  test('a failed tool call reports the error code and a hint', async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HOME);

    const client = new McpClient(['--tools', 'core']);
    try {
      await client.initialize();

      const result = await client.callTool('click', { selector: '#definitely-not-here' });
      expect(result.isError).toBe(true);
      const message = textOf(result);
      expect(message).toMatch(/^\[[A-Z_]+\]/);
      expect(message).toContain('hint:');
    } finally {
      client.close();
    }
  });

  test('--tools all exposes every profile', async () => {
    const client = new McpClient(['--tools', 'all']);
    try {
      await client.initialize();
      const names = (await client.listTools()).map((t) => t.name);
      for (const expected of [
        'snapshot',
        'network_requests',
        'cookies_get',
        'get_console',
        'cdp',
        'tab_close',
        'window_list',
      ]) {
        expect(names).toContain(expected);
      }
    } finally {
      client.close();
    }
  });
});
