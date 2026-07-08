import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken, hasRole, client } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
  hasRole: vi.fn(),
  client: {
    listAgents: vi.fn(),
    createAgent: vi.fn(),
    rotateAgentSecret: vi.fn(),
    revokeAgent: vi.fn(),
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

describe('/api/account/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'account_admin' },
      participant: { id: 'pid' },
    });
    getToken.mockResolvedValue(JWT);
    hasRole.mockReturnValue(true);
  });

  describe('GET /', () => {
    it('returns 403 when the session role does not satisfy account_admin, without calling upstream', async () => {
      getSession.mockResolvedValue({
        user: { role: 'buyer_view_only' },
        participant: { id: 'pid' },
      });
      hasRole.mockReturnValue(false);
      const { GET } = await import('../route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(403);
      expect(client.listAgents).not.toHaveBeenCalled();
    });

    it('returns 200 and the upstream agents body for account_admin', async () => {
      client.listAgents.mockResolvedValueOnce({ agents: [] });
      const { GET } = await import('../route');
      const res = await GET(new NextRequest('http://localhost/x', { method: 'GET' }), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ agents: [] });
      expect(client.listAgents).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('returns 201 with the credential body and forwards the trimmed name', async () => {
      const cred = {
        id: 'aid',
        name: 'Bot',
        client_id: 'agent-aid',
        participant_id: 'pid',
        status: 'active',
        registered_at: 'r',
        client_secret: 'sekret',
        auth_token_endpoint: 'https://auth/token',
        auth_issuer: 'https://auth/realm',
        auth_jwks_uri: 'https://auth/certs',
        api_base_url: 'https://api',
      };
      client.createAgent.mockResolvedValueOnce(cred);
      const { POST } = await import('../route');
      const res = await POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ name: '  Bot  ' }),
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({}) },
      );
      expect(client.createAgent).toHaveBeenCalledWith('Bot');
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.client_secret).toBe('sekret');
    });

    it('returns 403 without account_admin and does not call upstream', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../route');
      const res = await POST(
        new NextRequest('http://localhost/x', {
          method: 'POST',
          body: JSON.stringify({ name: 'Bot' }),
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(403);
      expect(client.createAgent).not.toHaveBeenCalled();
    });
  });

  /** An upstream haiCore 4xx as thrown by the haiwave-api client. */
  function upstream4xx(status: number, haiCoreBody: unknown): Error {
    const err = new Error(`haiCore error ${status}`) as Error & { status?: number; haiCoreBody?: unknown };
    err.status = status;
    err.haiCoreBody = haiCoreBody;
    return err;
  }

  describe('POST /[agentId]/rotate', () => {
    it('returns the upstream rotated credential for account_admin', async () => {
      client.rotateAgentSecret.mockResolvedValueOnce({ id: 'aid', client_secret: 'new-secret' });
      const { POST } = await import('../[agentId]/rotate/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ agentId: 'aid' }),
      });
      expect(client.rotateAgentSecret).toHaveBeenCalledWith('aid');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.client_secret).toBe('new-secret');
    });

    it('propagates an upstream 409 AGENT_REVOKED verbatim (not masked as 500)', async () => {
      const body = { error: { code: 'AGENT_REVOKED', message: 'Agent has been revoked' } };
      client.rotateAgentSecret.mockRejectedValueOnce(upstream4xx(409, body));
      const { POST } = await import('../[agentId]/rotate/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ agentId: 'aid' }),
      });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual(body);
    });

    it('returns 403 without account_admin and does not call upstream', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../[agentId]/rotate/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ agentId: 'aid' }),
      });
      expect(res.status).toBe(403);
      expect(client.rotateAgentSecret).not.toHaveBeenCalled();
    });
  });

  describe('POST /[agentId]/revoke', () => {
    it('returns the upstream revoked agent summary for account_admin', async () => {
      client.revokeAgent.mockResolvedValueOnce({ id: 'aid', status: 'revoked' });
      const { POST } = await import('../[agentId]/revoke/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ agentId: 'aid' }),
      });
      expect(client.revokeAgent).toHaveBeenCalledWith('aid');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('revoked');
    });

    it('propagates an upstream 404 NOT_FOUND verbatim (not masked as 500)', async () => {
      const body = { error: { code: 'NOT_FOUND', message: 'Agent not found' } };
      client.revokeAgent.mockRejectedValueOnce(upstream4xx(404, body));
      const { POST } = await import('../[agentId]/revoke/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ agentId: 'aid' }),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual(body);
    });

    it('returns 403 without account_admin and does not call upstream', async () => {
      hasRole.mockReturnValue(false);
      const { POST } = await import('../[agentId]/revoke/route');
      const res = await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
        params: Promise.resolve({ agentId: 'aid' }),
      });
      expect(res.status).toBe(403);
      expect(client.revokeAgent).not.toHaveBeenCalled();
    });
  });
});
