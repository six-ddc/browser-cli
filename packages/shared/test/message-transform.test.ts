import { describe, it, expect } from 'vitest';
import {
  daemonRequestSchema,
  requestMessageSchema,
  responseMessageSchema,
  daemonResponseSchema,
} from '../src/protocol/schemas.js';

describe('DaemonRequest → RequestMessage transform', () => {
  it('DaemonRequest fields produce a valid RequestMessage when type is added', () => {
    const daemonReq = daemonRequestSchema.parse({
      id: 'req-1',
      command: { action: 'navigate', params: { url: 'https://example.com' } },
    });

    const requestMsg = requestMessageSchema.parse({
      ...daemonReq,
      type: 'request',
    });

    expect(requestMsg.id).toBe(daemonReq.id);
    expect(requestMsg.type).toBe('request');
    expect(requestMsg.command).toEqual(daemonReq.command);
  });

  it('RequestMessage is valid after adding type field', () => {
    const daemonReq = {
      id: 'req-2',
      command: { action: 'click', params: { selector: '#btn' } },
    };

    const result = requestMessageSchema.parse({
      ...daemonReq,
      type: 'request',
    });

    expect(result.type).toBe('request');
    expect(result.command.action).toBe('click');
  });

  it('optional fields preserved in DaemonRequest → RequestMessage', () => {
    const daemonReq = daemonRequestSchema.parse({
      id: 'req-3',
      command: { action: 'snapshot', params: { interactive: true, depth: 5 } },
      tabId: 7,
    });

    const requestMsg = requestMessageSchema.parse({
      ...daemonReq,
      type: 'request',
    });

    expect(requestMsg.tabId).toBe(7);
    expect(requestMsg.command).toEqual(daemonReq.command);
  });
});

describe('ResponseMessage → DaemonResponse transform', () => {
  it('success ResponseMessage maps to DaemonResponse by dropping type', () => {
    const responseMsg = responseMessageSchema.parse({
      id: 'res-1',
      type: 'response',
      success: true,
      data: { url: 'https://example.com' },
    });

    const { type: _, ...rest } = responseMsg;
    const daemonRes = daemonResponseSchema.parse(rest);

    expect(daemonRes.id).toBe('res-1');
    expect(daemonRes.success).toBe(true);
    expect(daemonRes.data).toEqual({ url: 'https://example.com' });
  });

  it('error ResponseMessage maps to DaemonResponse by dropping type', () => {
    const responseMsg = responseMessageSchema.parse({
      id: 'res-2',
      type: 'response',
      success: false,
      error: { code: 'ELEMENT_NOT_FOUND', message: 'not found' },
    });

    const { type: _, ...rest } = responseMsg;
    const daemonRes = daemonResponseSchema.parse(rest);

    expect(daemonRes.success).toBe(false);
    expect(daemonRes.error?.code).toBe('ELEMENT_NOT_FOUND');
  });

  it('error hint preserved through ResponseMessage → DaemonResponse', () => {
    const responseMsg = responseMessageSchema.parse({
      id: 'res-3',
      type: 'response',
      success: false,
      error: {
        code: 'TIMEOUT',
        message: 'timed out',
        hint: 'Try increasing the timeout',
      },
    });

    const { type: _, ...rest } = responseMsg;
    const daemonRes = daemonResponseSchema.parse(rest);

    expect(daemonRes.error?.hint).toBe('Try increasing the timeout');
  });
});
