import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Bridge } from '../src/daemon/bridge.js';
import type { WsServer } from '../src/daemon/ws-server.js';
import { ErrorCode } from '@browser-cli/shared';
import type { DaemonRequest } from '@browser-cli/shared';

vi.mock('../src/util/logger.js', () => ({
  logger: { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function createMockWsServer(connected = true) {
  return {
    isConnected: connected,
    sendRequest: vi.fn(),
  } as unknown as WsServer;
}

function makeRequest(overrides: Partial<DaemonRequest> = {}): DaemonRequest {
  return {
    id: 'test-id-1',
    command: { action: 'navigate', params: { url: 'https://example.com' } },
    ...overrides,
  } as DaemonRequest;
}

describe('Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns EXTENSION_NOT_CONNECTED error when not connected', async () => {
    const ws = createMockWsServer(false);
    const bridge = new Bridge(ws);
    const req = makeRequest();

    const res = await bridge.handleRequest(req);

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(ErrorCode.EXTENSION_NOT_CONNECTED);
    expect(ws.sendRequest).not.toHaveBeenCalled();
  });

  it('converts DaemonRequest to RequestMessage with type:request', async () => {
    const ws = createMockWsServer(true);
    ws.sendRequest.mockResolvedValue({ id: 'test-id-1', success: true, data: {} });
    const bridge = new Bridge(ws);
    const req = makeRequest();

    await bridge.handleRequest(req);

    const sentMsg = ws.sendRequest.mock.calls[0][0];
    expect(sentMsg.type).toBe('request');
    expect(sentMsg.id).toBe('test-id-1');
    expect(sentMsg.command).toEqual(req.command);
  });

  it('returns success response from extension', async () => {
    const ws = createMockWsServer(true);
    ws.sendRequest.mockResolvedValue({ id: 'test-id-1', success: true, data: {} });
    const bridge = new Bridge(ws);

    const res = await bridge.handleRequest(makeRequest());

    expect(res.success).toBe(true);
  });

  it('preserves response data in success case', async () => {
    const ws = createMockWsServer(true);
    const responseData = { url: 'https://example.com', title: 'Example' };
    ws.sendRequest.mockResolvedValue({ id: 'test-id-1', success: true, data: responseData });
    const bridge = new Bridge(ws);

    const res = await bridge.handleRequest(makeRequest());

    expect(res.data).toEqual(responseData);
  });

  it('preserves error info in error response', async () => {
    const ws = createMockWsServer(true);
    ws.sendRequest.mockResolvedValue({
      id: 'test-id-1',
      success: false,
      error: { code: ErrorCode.ELEMENT_NOT_FOUND, message: 'not found', hint: 'check selector' },
    });
    const bridge = new Bridge(ws);

    const res = await bridge.handleRequest(makeRequest());

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(ErrorCode.ELEMENT_NOT_FOUND);
    expect(res.error?.message).toBe('not found');
    expect(res.error?.hint).toBe('check selector');
  });

  it('returns TIMEOUT error when sendRequest throws', async () => {
    const ws = createMockWsServer(true);
    ws.sendRequest.mockRejectedValue(new Error('Request timed out after 30000ms'));
    const bridge = new Bridge(ws);

    const res = await bridge.handleRequest(makeRequest());

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe(ErrorCode.TIMEOUT);
    expect(res.error?.message).toBe('Request timed out after 30000ms');
  });

  it('preserves request id in all responses', async () => {
    const ws = createMockWsServer(true);
    ws.sendRequest.mockResolvedValue({ id: 'my-unique-id', success: true, data: {} });
    const bridge = new Bridge(ws);

    const res = await bridge.handleRequest(makeRequest({ id: 'my-unique-id' }));

    expect(res.id).toBe('my-unique-id');
  });

  it('passes tabId through to RequestMessage', async () => {
    const ws = createMockWsServer(true);
    ws.sendRequest.mockResolvedValue({ id: 'test-id-1', success: true, data: {} });
    const bridge = new Bridge(ws);

    await bridge.handleRequest(makeRequest({ tabId: 99 }));

    const sentMsg = ws.sendRequest.mock.calls[0][0];
    expect(sentMsg.tabId).toBe(99);
  });
});
