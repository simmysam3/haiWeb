import { describe, it, expect } from 'vitest';
import { forwardHaiCoreResponse } from '../forward-haicore-response';

describe('forwardHaiCoreResponse', () => {
  it('returns a bodyless 204 without reading the upstream body', async () => {
    let read = false;
    const res = await forwardHaiCoreResponse({ status: 204, text: async () => { read = true; return ''; } });
    expect(res.status).toBe(204);
    expect(read).toBe(false);
    expect(await res.text()).toBe('');
  });

  it('parses a JSON body and keeps the upstream status', async () => {
    const res = await forwardHaiCoreResponse({ status: 409, text: async () => JSON.stringify({ error: { code: 'NOT_A_TRADING_PAIR' } }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'NOT_A_TRADING_PAIR' } });
  });
});
