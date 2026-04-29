import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let getObligation: ReturnType<typeof vi.fn>;
let getSession: ReturnType<typeof vi.fn>;
let getToken: ReturnType<typeof vi.fn>;

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => getSession(...args),
  getToken: (...args: unknown[]) => getToken(...args),
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({
    getObligation: (...args: unknown[]) => getObligation(...args),
  }),
}));

import { GET } from '../[id]/route';

describe('GET /api/account/sku-obligations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getObligation = vi.fn();
    getSession = vi.fn().mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken = vi.fn().mockResolvedValue('header.payload.signature');
  });

  it('returns 401 when no session', async () => {
    getSession.mockResolvedValue(null);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1'),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('forwards id to client and returns body', async () => {
    const obligation = { obligation_id: 'obl-1', status: 'outstanding' };
    getObligation.mockResolvedValue(obligation);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1'),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(getObligation).toHaveBeenCalledWith('obl-1');
    expect(await res.json()).toEqual(obligation);
  });

  it('propagates 4xx body verbatim from haiCore', async () => {
    const haiCoreErr = Object.assign(new Error('haiCore 404'), {
      status: 404,
      haiCoreBody: { error: { code: 'OBLIGATION_NOT_FOUND', message: 'gone' } },
    });
    getObligation.mockRejectedValueOnce(haiCoreErr);
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1'),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'OBLIGATION_NOT_FOUND', message: 'gone' } });
  });

  it('returns 500 when haiCore raises a non-4xx error', async () => {
    getObligation.mockRejectedValueOnce(new Error('boom'));
    const res = await GET(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1'),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(res.status).toBe(500);
  });
});
