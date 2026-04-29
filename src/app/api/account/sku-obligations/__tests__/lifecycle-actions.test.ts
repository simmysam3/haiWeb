import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let acknowledgeObligation: ReturnType<typeof vi.fn>;
let declineObligation: ReturnType<typeof vi.fn>;
let deferObligation: ReturnType<typeof vi.fn>;
let getSession: ReturnType<typeof vi.fn>;
let getToken: ReturnType<typeof vi.fn>;

vi.mock('@/lib/auth', () => ({
  getSession: (...args: unknown[]) => getSession(...args),
  getToken: (...args: unknown[]) => getToken(...args),
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({
    acknowledgeObligation: (...args: unknown[]) => acknowledgeObligation(...args),
    declineObligation: (...args: unknown[]) => declineObligation(...args),
    deferObligation: (...args: unknown[]) => deferObligation(...args),
  }),
}));

import { POST as ack } from '../[id]/acknowledge/route';
import { POST as decline } from '../[id]/decline/route';
import { POST as defer } from '../[id]/defer/route';

beforeEach(() => {
  vi.clearAllMocks();
  acknowledgeObligation = vi.fn();
  declineObligation = vi.fn();
  deferObligation = vi.fn();
  getSession = vi.fn().mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
  getToken = vi.fn().mockResolvedValue('header.payload.signature');
});

describe('POST /sku-obligations/[id]/acknowledge', () => {
  it('forwards id, ignores body', async () => {
    acknowledgeObligation.mockResolvedValue({ obligation_id: 'obl-1', status: 'acknowledged' });
    const res = await ack(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1/acknowledge', { method: 'POST' }),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(acknowledgeObligation).toHaveBeenCalledWith('obl-1');
    expect(res.status).toBe(200);
  });

  it('propagates 4xx body verbatim from haiCore', async () => {
    const haiCoreErr = Object.assign(new Error('haiCore 409'), {
      status: 409,
      haiCoreBody: { error: { code: 'OBLIGATION_ALREADY_TERMINAL', message: 'too late' } },
    });
    acknowledgeObligation.mockRejectedValueOnce(haiCoreErr);
    const res = await ack(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1/acknowledge', { method: 'POST' }),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'OBLIGATION_ALREADY_TERMINAL', message: 'too late' } });
  });

  it('returns 500 when haiCore raises a non-4xx error', async () => {
    acknowledgeObligation.mockRejectedValueOnce(new Error('boom'));
    const res = await ack(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1/acknowledge', { method: 'POST' }),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(res.status).toBe(500);
  });
});

describe('POST /sku-obligations/[id]/decline', () => {
  it('forwards id and notes', async () => {
    declineObligation.mockResolvedValue({ obligation_id: 'obl-1', status: 'declined' });
    const res = await decline(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1/decline', {
        method: 'POST',
        body: JSON.stringify({ notes: 'wrong product' }),
      }),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(declineObligation).toHaveBeenCalledWith('obl-1', 'wrong product');
    expect(res.status).toBe(200);
  });

  it('forwards id with no notes when body is empty', async () => {
    declineObligation.mockResolvedValue({ obligation_id: 'obl-1', status: 'declined' });
    const res = await decline(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1/decline', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(declineObligation).toHaveBeenCalledWith('obl-1', undefined);
    expect(res.status).toBe(200);
  });
});

describe('POST /sku-obligations/[id]/defer', () => {
  it('forwards id and notes', async () => {
    deferObligation.mockResolvedValue({ obligation_id: 'obl-1', status: 'outstanding' });
    const res = await defer(
      new NextRequest('http://localhost/api/account/sku-obligations/obl-1/defer', {
        method: 'POST',
        body: JSON.stringify({ notes: 'reviewing' }),
      }),
      { params: Promise.resolve({ id: 'obl-1' }) },
    );
    expect(deferObligation).toHaveBeenCalledWith('obl-1', 'reviewing');
    expect(res.status).toBe(200);
  });
});
