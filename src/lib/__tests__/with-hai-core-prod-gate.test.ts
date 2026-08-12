import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as authModule from '../auth';
import { withHaiCore } from '../with-hai-core';

// Mock the auth module with the correct import path and structure.
// Session is nested (user.role, participant.id), not flat.
vi.mock('../auth', () => ({
  getSession: vi.fn(),
  getToken: vi.fn(),
  hasRole: vi.fn(() => true),
}));

// Default valid session for all tests
const mockValidSession = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'buyer_full_transact' as const,
    job_title: 'Procurement',
  },
  participant: {
    id: 'p-1',
    company_name: 'Test Company',
    status: 'active',
  },
  is_admin: false,
};

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  // Default: valid session, JWT-like token
  vi.mocked(authModule.getSession).mockResolvedValue(mockValidSession);
  vi.mocked(authModule.getToken).mockResolvedValue('aaa.bbb.ccc');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('withHaiCore production mock gate', () => {
  it('production: non-JWT token (line 118-119 guard) returns 401, never serves fallback', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const FALLBACK = [{ company_name: 'MidWest Fastener Corp' }];

    // Override getToken to return a non-JWT token (no dots)
    vi.mocked(authModule.getToken).mockResolvedValue('dev-mode-cookie');

    const handler = withHaiCore(
      async () => {
        return { data: 'success' };
      },
      { fallback: FALLBACK },
    );

    const res = await handler(
      new NextRequest('http://localhost/api/account/partners'),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('MidWest Fastener Corp');
    expect(res.headers.get('x-haiwave-data-source')).toBeNull();
  });

  it('development: non-JWT token (line 118-119 guard) returns fallback with header', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const FALLBACK = [{ company_name: 'MidWest Fastener Corp' }];

    // Override getToken to return a non-JWT token
    vi.mocked(authModule.getToken).mockResolvedValue('dev-mode-cookie');

    const handler = withHaiCore(
      async () => {
        return { data: 'success' };
      },
      { fallback: FALLBACK },
    );

    const res = await handler(
      new NextRequest('http://localhost/api/account/partners'),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('x-haiwave-data-source')).toBe('fallback');
    const body = await res.json();
    expect(body).toEqual(FALLBACK);
  });

  it('production: haiCore error (line 146 guard) returns 500, never serves fallback', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const FALLBACK = [{ company_name: 'MidWest Fastener Corp' }];

    const handler = withHaiCore(
      async () => {
        throw new Error('ECONNREFUSED haiCore');
      },
      { fallback: FALLBACK },
    );

    const res = await handler(
      new NextRequest('http://localhost/api/account/partners'),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('MidWest Fastener Corp');
    expect(res.headers.get('x-haiwave-data-source')).toBeNull();
  });

  it('development: haiCore error (line 146 guard) returns fallback with header', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const FALLBACK = [{ company_name: 'MidWest Fastener Corp' }];

    const handler = withHaiCore(
      async () => {
        throw new Error('ECONNREFUSED haiCore');
      },
      { fallback: FALLBACK },
    );

    const res = await handler(
      new NextRequest('http://localhost/api/account/partners'),
      { params: Promise.resolve({}) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('x-haiwave-data-source')).toBe('fallback');
    const body = await res.json();
    expect(body).toEqual(FALLBACK);
  });
});
