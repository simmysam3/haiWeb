import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken, hasRole, client } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
  hasRole: vi.fn(),
  client: {
    entityApprovalsQueue: vi.fn(),
    entityApprovalScorecard: vi.fn(),
    counterpartyScorecard: vi.fn(),
    approveEntity: vi.fn(),
    approveCounterparty: vi.fn(),
    revokeCounterparty: vi.fn(),
    counterpartyEvidenceFile: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
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

describe('/api/account/entity-approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'account_admin' },
      participant: { id: 'pid' },
    });
    getToken.mockResolvedValue(JWT);
    hasRole.mockReturnValue(true);
  });

  describe('GET / (queue)', () => {
    it('forwards status/search/sort query and returns the queue', async () => {
      const queue = [{ request_id: 'r1', counterparty: { id: 'c1', name: 'Acme' }, gap_count: 2 }];
      client.entityApprovalsQueue.mockResolvedValueOnce(queue);
      const { GET } = await import('../route');
      const res = await GET(
        new NextRequest('http://localhost/x?status=approved&search=ac&sort=date_asc', { method: 'GET' }),
        { params: Promise.resolve({}) },
      );
      expect(client.entityApprovalsQueue).toHaveBeenCalledWith({
        status: 'approved',
        search: 'ac',
        sort: 'date_asc',
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json[0].counterparty.name).toBe('Acme');
    });

    it('omits unset query params (defaults applied upstream)', async () => {
      client.entityApprovalsQueue.mockResolvedValueOnce([]);
      const { GET } = await import('../route');
      await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(client.entityApprovalsQueue).toHaveBeenCalledWith({
        status: undefined,
        search: undefined,
        sort: undefined,
      });
    });

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const { GET } = await import('../route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /[requestId]/scorecard', () => {
    it('forwards requestId + tier and returns the scorecard', async () => {
      const sc = { tier: 'trading_pair', rows: [], gap_count: 0, counts: {} };
      client.entityApprovalScorecard.mockResolvedValueOnce(sc);
      const { GET } = await import('../[requestId]/scorecard/route');
      const res = await GET(
        new NextRequest('http://localhost/x?tier=premier', { method: 'GET' }),
        { params: Promise.resolve({ requestId: 'r1' }) },
      );
      expect(client.entityApprovalScorecard).toHaveBeenCalledWith('r1', 'premier');
      expect(res.status).toBe(200);
    });

    it('forwards undefined tier when absent', async () => {
      client.entityApprovalScorecard.mockResolvedValueOnce({});
      const { GET } = await import('../[requestId]/scorecard/route');
      await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({ requestId: 'r2' }),
      });
      expect(client.entityApprovalScorecard).toHaveBeenCalledWith('r2', undefined);
    });
  });

  describe('POST /[requestId]/approve', () => {
    const body = { tier: 'trading_pair', reason: 'established relationship' };
    function makeReq() {
      return new NextRequest('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    }

    it('exports no GET handler', async () => {
      const mod = await import('../[requestId]/approve/route');
      expect((mod as Record<string, unknown>).GET).toBeUndefined();
    });

    it('returns 403 without account_admin', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../[requestId]/approve/route');
      const res = await POST(makeReq(), { params: Promise.resolve({ requestId: 'r1' }) });
      expect(res.status).toBe(403);
      expect(client.approveEntity).not.toHaveBeenCalled();
    });

    it('forwards requestId + body and passes haiCore 201 through', async () => {
      client.approveEntity.mockResolvedValueOnce({ decision: { id: 'd1' } });
      const { POST } = await import('../[requestId]/approve/route');
      const res = await POST(makeReq(), { params: Promise.resolve({ requestId: 'r1' }) });
      expect(client.approveEntity).toHaveBeenCalledWith('r1', body);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.decision.id).toBe('d1');
    });

    it('propagates a haiCore 400 REASON_REQUIRED verbatim', async () => {
      const err = new Error('haiCore POST approve: 400') as Error & { status?: number; haiCoreBody?: unknown };
      err.status = 400;
      err.haiCoreBody = { error: { code: 'REASON_REQUIRED' } };
      client.approveEntity.mockRejectedValueOnce(err);
      const { POST } = await import('../[requestId]/approve/route');
      const res = await POST(makeReq(), { params: Promise.resolve({ requestId: 'r1' }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('REASON_REQUIRED');
    });

    it('propagates a haiCore 404 foreign request verbatim', async () => {
      const err = new Error('haiCore POST approve: 404') as Error & { status?: number; haiCoreBody?: unknown };
      err.status = 404;
      err.haiCoreBody = { error: { code: 'NOT_FOUND' } };
      client.approveEntity.mockRejectedValueOnce(err);
      const { POST } = await import('../[requestId]/approve/route');
      const res = await POST(makeReq(), { params: Promise.resolve({ requestId: 'rX' }) });
      expect(res.status).toBe(404);
    });
  });

  describe('counterparty routes', () => {
    it('GET /counterparty/[id]/scorecard forwards participantId + tier', async () => {
      client.counterpartyScorecard.mockResolvedValueOnce({ tier: 'connection', rows: [], gap_count: 0, counts: {} });
      const { GET } = await import('../counterparty/[id]/scorecard/route');
      const res = await GET(
        new NextRequest('http://localhost/x?tier=connection', { method: 'GET' }),
        { params: Promise.resolve({ id: 'cp1' }) },
      );
      expect(client.counterpartyScorecard).toHaveBeenCalledWith('cp1', 'connection');
      expect(res.status).toBe(200);
    });

    it('POST /counterparty/[id]/approve is admin-gated and forwards body, 201 through', async () => {
      client.approveCounterparty.mockResolvedValueOnce({ decision: { id: 'd2' } });
      const { POST } = await import('../counterparty/[id]/approve/route');
      const body = { tier: 'premier' };
      const res = await POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'cp2' }) },
      );
      expect(client.approveCounterparty).toHaveBeenCalledWith('cp2', body);
      expect(res.status).toBe(201);
    });

    it('POST /counterparty/[id]/approve returns 403 without account_admin', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../counterparty/[id]/approve/route');
      const res = await POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ tier: 'premier' }),
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'cp2' }) },
      );
      expect(res.status).toBe(403);
      expect(client.approveCounterparty).not.toHaveBeenCalled();
    });

    it('POST /counterparty/[id]/revoke is admin-gated and forwards body', async () => {
      client.revokeCounterparty.mockResolvedValueOnce({ decision: { id: 'd3' } });
      const { POST } = await import('../counterparty/[id]/revoke/route');
      const body = { reason: 'insurance coverage lapsed, please re-submit' };
      const res = await POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'cp3' }) },
      );
      expect(client.revokeCounterparty).toHaveBeenCalledWith('cp3', body);
      expect(res.status).toBe(200);
    });

    it('POST /counterparty/[id]/revoke returns 403 without account_admin', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../counterparty/[id]/revoke/route');
      const res = await POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ reason: 'a sufficiently long reason' }),
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({ id: 'cp3' }) },
      );
      expect(res.status).toBe(403);
      expect(client.revokeCounterparty).not.toHaveBeenCalled();
    });
  });

  describe('GET /evidence/[ownerId]/[artifactId]/file', () => {
    it('streams upstream body + sanitized content headers', async () => {
      client.counterpartyEvidenceFile.mockResolvedValueOnce(
        new Response(Buffer.from('%PDF test'), {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'content-disposition': 'inline; filename="coi.pdf"',
            'cache-control': 'private, no-store',
          },
        }),
      );
      const { GET } = await import('../evidence/[ownerId]/[artifactId]/file/route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({ ownerId: 'o1', artifactId: 'a1' }),
      });
      expect(client.counterpartyEvidenceFile).toHaveBeenCalledWith('o1', 'a1');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('content-security-policy')).toBe("sandbox; default-src 'none'");
    });

    it('neutralizes a non-allowlisted content type to an octet-stream attachment', async () => {
      client.counterpartyEvidenceFile.mockResolvedValueOnce(
        new Response(Buffer.from('<script>alert(1)</script>'), {
          status: 200,
          headers: { 'content-type': 'text/html', 'content-disposition': 'inline; filename="x.html"' },
        }),
      );
      const { GET } = await import('../evidence/[ownerId]/[artifactId]/file/route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({ ownerId: 'o1', artifactId: 'a2' }),
      });
      expect(res.headers.get('content-type')).toBe('application/octet-stream');
      expect(res.headers.get('content-disposition')).toContain('attachment');
    });

    it('propagates an upstream 404 (undisclosed/foreign artifact)', async () => {
      client.counterpartyEvidenceFile.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: {} }), { status: 404 }),
      );
      const { GET } = await import('../evidence/[ownerId]/[artifactId]/file/route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({ ownerId: 'o1', artifactId: 'missing' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 401 without a session and never reaches haiCore (no cross-participant leak)', async () => {
      getSession.mockResolvedValue(null);
      const { GET } = await import('../evidence/[ownerId]/[artifactId]/file/route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({ ownerId: 'o1', artifactId: 'a1' }),
      });
      expect(res.status).toBe(401);
      expect(client.counterpartyEvidenceFile).not.toHaveBeenCalled();
    });
  });
});

describe('/api/account/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'pid' } });
    getToken.mockResolvedValue(JWT);
    hasRole.mockReturnValue(true);
  });

  it('GET forwards the unread flag and returns notifications', async () => {
    client.listNotifications.mockResolvedValueOnce([{ id: 'n1', class: 'entity_approval' }]);
    const { GET } = await import('../../notifications/route');
    const res = await GET(
      new NextRequest('http://localhost/x?unread=true', { method: 'GET' }),
      { params: Promise.resolve({}) },
    );
    expect(client.listNotifications).toHaveBeenCalledWith(true);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json[0].id).toBe('n1');
  });

  it('GET passes unread=false through', async () => {
    client.listNotifications.mockResolvedValueOnce([]);
    const { GET } = await import('../../notifications/route');
    await GET(new NextRequest('http://localhost/x?unread=false', { method: 'GET' }), {
      params: Promise.resolve({}),
    });
    expect(client.listNotifications).toHaveBeenCalledWith(false);
  });

  it('GET defaults unread to false when absent', async () => {
    client.listNotifications.mockResolvedValueOnce([]);
    const { GET } = await import('../../notifications/route');
    await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
      params: Promise.resolve({}),
    });
    expect(client.listNotifications).toHaveBeenCalledWith(false);
  });

  it('GET returns 401 without a session', async () => {
    getSession.mockResolvedValue(null);
    const { GET } = await import('../../notifications/route');
    const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(401);
  });

  it('POST /[id]/read marks read and exports no GET', async () => {
    const mod = await import('../../notifications/[id]/read/route');
    expect((mod as Record<string, unknown>).GET).toBeUndefined();
    client.markNotificationRead.mockResolvedValueOnce({ ok: true });
    const res = await mod.POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
      params: Promise.resolve({ id: 'n1' }),
    });
    expect(client.markNotificationRead).toHaveBeenCalledWith('n1');
    expect(res.status).toBe(200);
  });

  it('POST /[id]/read returns 401 without a session', async () => {
    getSession.mockResolvedValue(null);
    const { POST } = await import('../../notifications/[id]/read/route');
    const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
      params: Promise.resolve({ id: 'n1' }),
    });
    expect(res.status).toBe(401);
    expect(client.markNotificationRead).not.toHaveBeenCalled();
  });
});
