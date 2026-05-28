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
  'http://localhost/api/account/admin/agent-config/sku-picker-scope';

const validAgentId = '00000000-0000-0000-0000-000000000042';

const mockConfig = {
  agent_id: validAgentId,
  sku_picker_scope: 'published_only' as const,
  mes_enabled: false,
  mes_config: null,
};

describe('sku-picker-scope BFF routes', () => {
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
      expect(json.error).toBe('agent_id required');
      expect(getAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 200 with sku_picker_scope subset on valid call', async () => {
      getAgentConfig.mockResolvedValueOnce(mockConfig);
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        agent_id: validAgentId,
        sku_picker_scope: 'published_only',
      });
      expect(getAgentConfig).toHaveBeenCalledWith(validAgentId);
    });

    it('does not leak mes_enabled or mes_config fields', async () => {
      getAgentConfig.mockResolvedValueOnce(mockConfig);
      const res = await GET(new NextRequest(`${baseUrl}?agent_id=${validAgentId}`), {
        params: Promise.resolve({}),
      });
      const json = await res.json();
      expect(json).not.toHaveProperty('mes_enabled');
      expect(json).not.toHaveProperty('mes_config');
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
      sku_picker_scope: 'full_catalog',
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
          body: JSON.stringify({ sku_picker_scope: 'published_only' }),
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
          body: JSON.stringify({ agent_id: 'not-a-uuid', sku_picker_scope: 'published_only' }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 400 when sku_picker_scope is not a valid enum value', async () => {
      const res = await PUT(
        new NextRequest(baseUrl, {
          method: 'PUT',
          body: JSON.stringify({ agent_id: validAgentId, sku_picker_scope: 'everything' }),
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(patchAgentConfig).not.toHaveBeenCalled();
    });

    it('returns 200 and roundtrips sku_picker_scope through patchAgentConfig', async () => {
      const updated = { ...mockConfig, sku_picker_scope: 'full_catalog' as const };
      patchAgentConfig.mockResolvedValueOnce(updated);
      const res = await PUT(
        new NextRequest(baseUrl, { method: 'PUT', body: JSON.stringify(validBody) }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        agent_id: validAgentId,
        sku_picker_scope: 'full_catalog',
      });
      expect(patchAgentConfig).toHaveBeenCalledWith(validAgentId, {
        sku_picker_scope: 'full_catalog',
      });
    });

    it('forwards a 422 from haiCore verbatim', async () => {
      patchAgentConfig.mockRejectedValueOnce(
        Object.assign(new Error('haiCore 422'), {
          status: 422,
          haiCoreBody: { error: { code: 'INVALID_SCOPE', message: 'Scope not permitted' } },
        }),
      );
      const res = await PUT(
        new NextRequest(baseUrl, { method: 'PUT', body: JSON.stringify(validBody) }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({
        error: { code: 'INVALID_SCOPE', message: 'Scope not permitted' },
      });
    });
  });
});
