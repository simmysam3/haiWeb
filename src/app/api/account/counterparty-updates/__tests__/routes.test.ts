import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken, hasRole, client } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
  hasRole: vi.fn(),
  client: {
    listCounterpartyUpdates: vi.fn(),
    decideCounterpartyUpdate: vi.fn(),
    syncCounterpartyUpdatesNow: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => client,
}));

const JWT = 'header.payload.signature';

describe('/api/account/counterparty-updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'account_admin' },
      participant: { id: 'pid' },
    });
    getToken.mockResolvedValue(JWT);
    hasRole.mockReturnValue(true);
  });

  describe('GET / (list)', () => {
    it('forwards status/counterparty query and returns the list', async () => {
      const list = { rows: [], sync_state: null, counterparties: [] };
      client.listCounterpartyUpdates.mockResolvedValueOnce(list);
      const { GET } = await import('../route');
      const res = await GET(
        new NextRequest('http://localhost/x?status=pending&counterparty=cp1', { method: 'GET' }),
        { params: Promise.resolve({}) },
      );
      expect(client.listCounterpartyUpdates).toHaveBeenCalledWith({
        status: 'pending',
        counterparty: 'cp1',
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(list);
    });

    it('omits unset query params (defaults applied upstream)', async () => {
      client.listCounterpartyUpdates.mockResolvedValueOnce({ rows: [], sync_state: null, counterparties: [] });
      const { GET } = await import('../route');
      await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(client.listCounterpartyUpdates).toHaveBeenCalledWith({
        status: undefined,
        counterparty: undefined,
      });
    });

    it('returns 403 without account_admin and never calls the client', async () => {
      hasRole.mockReturnValue(false);
      const { GET } = await import('../route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(403);
      expect(client.listCounterpartyUpdates).not.toHaveBeenCalled();
    });

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const { GET } = await import('../route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
      expect(client.listCounterpartyUpdates).not.toHaveBeenCalled();
    });
  });

  describe('POST /[id]/decide', () => {
    function makeReq(body: unknown) {
      return new NextRequest('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    }

    it('forwards a { keep } decision verbatim and returns the updated row', async () => {
      const row = { id: 'u1', status: 'kept' };
      client.decideCounterpartyUpdate.mockResolvedValueOnce(row);
      const { POST } = await import('../[id]/decide/route');
      const res = await POST(makeReq({ keep: 'mine' }), { params: Promise.resolve({ id: 'u1' }) });
      expect(client.decideCounterpartyUpdate).toHaveBeenCalledWith('u1', { keep: 'mine' });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(row);
    });

    it('forwards a { link } decision verbatim', async () => {
      client.decideCounterpartyUpdate.mockResolvedValueOnce({ id: 'u2', status: 'approved' });
      const { POST } = await import('../[id]/decide/route');
      const res = await POST(makeReq({ link: 7 }), { params: Promise.resolve({ id: 'u2' }) });
      expect(client.decideCounterpartyUpdate).toHaveBeenCalledWith('u2', { link: 7 });
      expect(res.status).toBe(200);
    });

    it('rejects an invalid decision shape with 400, never calling haiCore', async () => {
      const { POST } = await import('../[id]/decide/route');
      const res = await POST(makeReq({ keep: 'nobody' }), { params: Promise.resolve({ id: 'u3' }) });
      expect(res.status).toBe(400);
      expect(client.decideCounterpartyUpdate).not.toHaveBeenCalled();
    });

    it('rejects a body carrying neither keep nor link with 400', async () => {
      const { POST } = await import('../[id]/decide/route');
      const res = await POST(makeReq({ foo: 'bar' }), { params: Promise.resolve({ id: 'u4' }) });
      expect(res.status).toBe(400);
      expect(client.decideCounterpartyUpdate).not.toHaveBeenCalled();
    });

    it('propagates a haiCore 409 conflict verbatim', async () => {
      const err = new Error('haiCore POST decide: 409') as Error & { status?: number; haiCoreBody?: unknown };
      err.status = 409;
      err.haiCoreBody = { error: { code: 'CONFLICT' } };
      client.decideCounterpartyUpdate.mockRejectedValueOnce(err);
      const { POST } = await import('../[id]/decide/route');
      const res = await POST(makeReq({ keep: 'theirs' }), { params: Promise.resolve({ id: 'u5' }) });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('CONFLICT');
    });

    it('returns 403 without account_admin and never calls the client', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../[id]/decide/route');
      const res = await POST(makeReq({ keep: 'mine' }), { params: Promise.resolve({ id: 'u6' }) });
      expect(res.status).toBe(403);
      expect(client.decideCounterpartyUpdate).not.toHaveBeenCalled();
    });
  });

  describe('POST /sync-now', () => {
    it('calls syncCounterpartyUpdatesNow and returns its response', async () => {
      client.syncCounterpartyUpdatesNow.mockResolvedValueOnce({ status: 'started', run_id: 'r1' });
      const { POST } = await import('../sync-now/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(client.syncCounterpartyUpdatesNow).toHaveBeenCalledWith();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ status: 'started', run_id: 'r1' });
    });

    it('returns a response with no run_id when already_running', async () => {
      client.syncCounterpartyUpdatesNow.mockResolvedValueOnce({ status: 'already_running' });
      const { POST } = await import('../sync-now/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      const json = await res.json();
      expect(json).toEqual({ status: 'already_running' });
    });

    it('returns 403 without account_admin and never calls the client', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../sync-now/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(403);
      expect(client.syncCounterpartyUpdatesNow).not.toHaveBeenCalled();
    });

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const { POST } = await import('../sync-now/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
      expect(client.syncCounterpartyUpdatesNow).not.toHaveBeenCalled();
    });
  });
});
