import { describe, it, expect, vi } from 'vitest';
import { Bridge } from '../src/daemon/bridge.js';
import type { WsServer } from '../src/daemon/ws-server.js';
import type { DaemonRequest } from '@browser-cli/shared';

vi.mock('../src/util/logger.js', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function createErrorBridge(error: { message: string }) {
  const ws = {
    isConnected: true,
    sendRequest: vi.fn().mockResolvedValue({
      id: 'err-id',
      success: false,
      error,
    }),
  } as unknown as WsServer;
  return new Bridge(ws);
}

function makeRequest(id = 'err-id'): DaemonRequest {
  return {
    id,
    command: { action: 'click', params: { selector: '#btn' } },
  } as DaemonRequest;
}

describe('error propagation through Bridge', () => {
  it('error message is preserved', async () => {
    const bridge = createErrorBridge({
      message: 'Command timed out after 30s',
    });

    const res = await bridge.handleRequest(makeRequest());

    expect(res.error?.message).toBe('Command timed out after 30s');
  });

  it('sequential errors maintain independence (no state leakage)', async () => {
    const sendRequest = vi.fn();
    const ws = {
      isConnected: true,
      sendRequest,
    } as unknown as WsServer;
    const bridge = new Bridge(ws);

    // First error
    sendRequest.mockResolvedValueOnce({
      id: 'req-1',
      success: false,
      error: { message: 'first error' },
    });

    // Second error
    sendRequest.mockResolvedValueOnce({
      id: 'req-2',
      success: false,
      error: { message: 'second error' },
    });

    const res1 = await bridge.handleRequest(makeRequest('req-1'));
    const res2 = await bridge.handleRequest(makeRequest('req-2'));

    expect(res1.error?.message).toBe('first error');
    expect(res2.error?.message).toBe('second error');
  });
});
