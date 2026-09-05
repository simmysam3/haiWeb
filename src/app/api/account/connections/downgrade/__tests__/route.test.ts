import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { downgradeConnection, getSession, getToken } = vi.hoisted(() => ({
  downgradeConnection: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ downgradeConnection }),
}));

import { POST } from '../route';

const url = 'http://localhost/api/account/connections/downgrade';
const post = (body: unknown) =>
  POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({}),
  });

// haiCore's downgrade takes `target_state` ('approved' | 'none'); the BFF
// used to drop it, so the client could only ever send a bodiless request
// (owner ruling R-2, 2026-09-05).
describe('POST /api/account/connections/downgrade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'owner' }, participant: { id: 'p-self' } });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('passes target_state through to haiCore and returns its answer', async () => {
    downgradeConnection.mockResolvedValue({ connection_id: 'c-1', previous_state: 'trading_pair', new_state: 'approved' });
    const res = await post({ connection_id: 'c-1', target_state: 'approved' });
    expect(res.status).toBe(200);
    expect(downgradeConnection).toHaveBeenCalledWith('c-1', 'approved');
    expect(await res.json()).toEqual({ connection_id: 'c-1', previous_state: 'trading_pair', new_state: 'approved' });
  });
});
