import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession }));

import { POST } from '../route';

const url = 'http://localhost/api/aliases/suggest';
const post = (body: unknown) =>
  POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/aliases/suggest', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      user: { role: 'buyer_view_only' },
      participant: { id: 'p-self' },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ suggestions: ['Acme'], grounded: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Regression pin: this route is a publicly reachable, unauthenticated
  // trigger for a per-request model call upstream — a cost-burn/DoS vector.
  // The pre-auth registration flow that once justified public access was
  // retired in v1.47; the only live caller is the authenticated profile form.
  it('401 when unauthenticated', async () => {
    getSession.mockResolvedValue(null);
    const res = await post({ legal_name: 'Acme Corp' });
    expect(res.status).toBe(401);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('200 with the real suggestions on a valid authenticated request', async () => {
    const res = await post({ legal_name: 'Acme Corp', dba_name: 'Acme' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: ['Acme'], grounded: true });
  });

  it('400 when legal_name is missing', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('400 when legal_name is blank/whitespace-only', async () => {
    const res = await post({ legal_name: '   ' });
    expect(res.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('400 when a field is not a string (e.g. an object)', async () => {
    const res = await post({ legal_name: 'Acme', vendor_description: { a: 1 } });
    expect(res.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('400 when a field exceeds the 500-char cap', async () => {
    const res = await post({ legal_name: 'Acme', vendor_description: 'x'.repeat(501) });
    expect(res.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
