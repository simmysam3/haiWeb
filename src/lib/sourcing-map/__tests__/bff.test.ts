import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { smForward } from '../bff';

function res(status: number, body?: unknown) {
  return { status, text: async () => (body === undefined ? '' : JSON.stringify(body)) } as unknown as Response;
}

describe('smForward', () => {
  it('forwards the method, the query string and the JSON body, and relays status and body', async () => {
    const fetchRaw = vi.fn().mockResolvedValue(res(201, { ok: 1 }));
    const req = new NextRequest('http://localhost:3001/api/account/sourcing-map/x?cursor=3', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    const out = await smForward({ fetchRaw }, req, '/sourcing-map/x');
    expect(fetchRaw).toHaveBeenCalledWith('/sourcing-map/x?cursor=3', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    expect(out.status).toBe(201);
    expect(await out.json()).toEqual({ ok: 1 });
  });
});
