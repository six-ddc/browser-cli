import { describe, it, expect, vi } from 'vitest';
import { Bridge } from '../src/daemon/bridge.js';
import type { WsServer } from '../src/daemon/ws-server.js';
import { ErrorCode } from '@browser-cli/shared';
import type { DaemonRequest } from '@browser-cli/shared';

vi.mock('../src/util/logger.js', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function createErrorBridge(error: {
  code: string;
  message: string;
  hint?: string;
  details?: unknown;
}) {
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
  it('error code is preserved', async () => {
    const bridge = createErrorBridge({
      code: ErrorCode.ELEMENT_NOT_FOUND,
      message: 'not found',
    });

    const res = await bridge.handleRequest(makeRequest());

    expect(res.error?.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
  });

  it('error message is preserved', async () => {
    const bridge = createErrorBridge({
      code: ErrorCode.TIMEOUT,
      message: 'Command timed out after 30s',
    });

    const res = await bridge.handleRequest(makeRequest());

    expect(res.error?.message).toBe('Command timed out after 30s');
  });

  it('error hint is preserved', async () => {
    const bridge = createErrorBridge({
      code: ErrorCode.ELEMENT_NOT_FOUND,
      message: 'not found',
      hint: 'Use snapshot to find valid selectors',
    });

    const res = await bridge.handleRequest(makeRequest());

    expect(res.error?.hint).toBe('Use snapshot to find valid selectors');
  });

  it('error without hint does not have hint field', async () => {
    const bridge = createErrorBridge({
      code: ErrorCode.TIMEOUT,
      message: 'timed out',
    });

    const res = await bridge.handleRequest(makeRequest());

    expect(res.error).toBeDefined();
    expect('hint' in res.error!).toBe(false);
  });

  it('error details are preserved', async () => {
    const details = { selector: '#missing', candidates: ['#btn1', '#btn2'] };
    const bridge = createErrorBridge({
      code: ErrorCode.ELEMENT_NOT_FOUND,
      message: 'not found',
      details,
    });

    const res = await bridge.handleRequest(makeRequest());

    expect(res.error?.details).toEqual(details);
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
      error: { code: ErrorCode.ELEMENT_NOT_FOUND, message: 'first error', hint: 'hint-1' },
    });

    // Second error
    sendRequest.mockResolvedValueOnce({
      id: 'req-2',
      success: false,
      error: { code: ErrorCode.TIMEOUT, message: 'second error' },
    });

    const res1 = await bridge.handleRequest(makeRequest('req-1'));
    const res2 = await bridge.handleRequest(makeRequest('req-2'));

    expect(res1.error?.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    expect(res1.error?.hint).toBe('hint-1');

    expect(res2.error?.code).toBe(ErrorCode.TIMEOUT);
    expect(res2.error?.message).toBe('second error');
    expect('hint' in res2.error!).toBe(false);
  });
});
