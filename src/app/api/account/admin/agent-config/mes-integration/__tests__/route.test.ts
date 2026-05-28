import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getAgentConfig, patchAgentConfig, getSession, getToken } = vi.hoisted(() => ({
  getAgentConfig: vi.fn(),
  patchAgentConfig: vi.fn(),
  getSession: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getSession,
  getToken,
  hasRole: () => true,
}));

vi.mock('@/lib/haiwave-api', () => ({
  createHaiwaveClient: () => ({ getAgentConfig, patchAgentConfig }),
}));

import { GET, PUT } from '../route';

const baseUrl =
  'http://localhost/api/account/admin/agent-config/mes-integration';

const validAgentId = '00000000-0000-0000-0000-000000000099';

const validMesConfig = {
  endpoint_url: 'https://mes.example.com/api',
  auth_scheme: 'bearer',
  credential_ref: 'secret/mes-token',
  work_center_mapping: { WC01: 'line-a', WC02: 'line-b' },
};

const mockConfig = {
  agent_id: validAgentId,
  sku_picker_scope: 'published_only' as const,
  mes_enabled: true,
  mes_config: validMesConfig,
};

describe('mes-integration BFF routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      is_admin: true,
      user: { role: 'owner' },
      participant: { id: 'p-self' },
    });
    getToken.mockResolvedValue('header.payload.signature');
  });

  // ─── GET ──────────────────────────────────────────────────────────────────

  describe('GET', () => {
    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(401);
      expect(getAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 403 when caller is not admin', async () => {
      getSession.mockResolvedValue({
        is_admin: false,
        user: { role: 'member' },
        participant: { id: 'p-self' },
      });
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(403);
      expect(getAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 400 when agent_id query param is missing', async () => {
      const res = await GET(new NextRequest(baseUrl), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('MISSING_PARAMETER');
      expect(getAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 200 with mes_enabled + mes_config on valid call', async () => {
      getAgentConfig.mockResolvedValueOnce(mockConfig);
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        agent_id: validAgentId,
        mes_enabled: true,
        mes_config: validMesConfig,
      });
      expect(getAgentConfig).toHaveBeenCalledWith(validAgentId);
    });

    it('returns null mes_config when MES is not configured', async () => {
      getAgentConfig.mockResolvedValueOnce({
        ...mockConfig,
        mes_enabled: false,
        mes_config: null,
      });
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mes_enabled).toBe(false);
      expect(json.mes_config).toBeNull();
    });

    it('does not leak sku_picker_scope field', async () => {
      getAgentConfig.mockResolvedValueOnce(mockConfig);
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      const json = await res.json();
      expect(json).not.toHaveProperty('sku_picker_scope');
    });

    it('forwards a 404 from haiCore verbatim', async () => {
      getAgentConfig.mockRejectedValueOnce(
        Object.assign(new Error('haiCore 404'), {
          status: 404,
          haiCoreBody: { error: { code: 'NOT_FOUND', message: 'Agent not found' } },
        }),
      );
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });
    });
  });

  // ─── PUT ──────────────────────────────────────────────────────────────────

  describe('PUT', () => {
    const validBody = {
      agent_id: validAgentId,
      mes_enabled: true,
      mes_config: validMesConfig,
    };

    it('returns 401 without a session', async () => {
      getSession.mockResolvedValue(null);
      const res = await PUT(
        new NextRequest(baseUrl, { method: 'PUT', body: JSON.stringify(validBody) }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(401);
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 403 when caller is not admin', async () => {
      getSession.mockResolvedValue({
        is_admin: false,
        user: { role: 'member' },
        participant: { id: 'p-self' },
      });
      const res = await PUT(
        new NextRequest(baseUrl, { method: 'PUT', body: JSON.stringify(validBody) }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(403);
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 400 when body is not parseable JSON', async () => {
      const res = await PUT(
        new NextRequest(baseUrl, {
          method: 'PUT',
          body: 'not-json',
          headers: { 'content-type': 'application/json' },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 400 when agent_id is missing', async () => {
      const res = await PUT(
        new NextRequest(baseUrl, {
          method: 'PUT',
          body: JSON.stringify({ mes_enabled: true, mes_config: null }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 400 when agent_id is not a UUID', async () => {
      const res = await PUT(
        new NextRequest(baseUrl, {
          method: 'PUT',
          body: JSON.stringify({ agent_id: 'bad-id', mes_enabled: false, mes_config: null }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 400 when mes_enabled is missing', async () => {
      const res = await PUT(
        new NextRequest(baseUrl, {
          method: 'PUT',
          body: JSON.stringify({ agent_id: validAgentId, mes_config: null }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 400 when mes_config has an invalid endpoint_url', async () => {
      const res = await PUT(
        new NextRequest(baseUrl, {
          method: 'PUT',
          body: JSON.stringify({
            agent_id: validAgentId,
            mes_enabled: true,
            mes_config: { ...validMesConfig, endpoint_url: 'not-a-url' },
          }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 200 with mes fields roundtripped through patchAgentConfig', async () => {
      patchAgentConfig.mockResolvedValueOnce(mockConfig);
      const res = await PUT(
        new NextRequest(baseUrl, { method: 'PUT', body: JSON.stringify(validBody) }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        agent_id: validAgentId,
        mes_enabled: true,
        mes_config: validMesConfig,
      });
      expect(patchAgentConfig).toHaveBeenCalledWith(validAgentId, {
        mes_enabled: true,
        mes_config: validMesConfig,
      });
    });

    it('returns 200 when mes_config is null (disabling MES)', async () => {
      const disabledConfig = { ...mockConfig, mes_enabled: false, mes_config: null };
      patchAgentConfig.mockResolvedValueOnce(disabledConfig);
      const body = { agent_id: validAgentId, mes_enabled: false, mes_config: null };
      const res = await PUT(
        new NextRequest(baseUrl, { method: 'PUT', body: JSON.stringify(body) }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.mes_enabled).toBe(false);
      expect(json.mes_config).toBeNull();
      expect(patchAgentConfig).toHaveBeenCalledWith(validAgentId, {
        mes_enabled: false,
        mes_config: null,
      });
    });

    it('forwards a 422 from haiCore verbatim', async () => {
      patchAgentConfig.mockRejectedValueOnce(
        Object.assign(new Error('haiCore 422'), {
          status: 422,
          haiCoreBody: { error: { code: 'MES_UNREACHABLE', message: 'Endpoint did not respond' } },
        }),
      );
      const res = await PUT(
        new NextRequest(baseUrl, { method: 'PUT', body: JSON.stringify(validBody) }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({
        error: { code: 'MES_UNREACHABLE', message: 'Endpoint did not respond' },
      });
    });
  });
});
