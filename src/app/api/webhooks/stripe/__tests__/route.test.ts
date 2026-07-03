import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/config/env', () => ({ loadEnv: () => ({ STRIPE_WEBHOOK_SECRET: 'whsec_test' }) }));

import { POST } from '../route';

const nowSec = () => Math.floor(Date.now() / 1000);
function signed(body: string, secret = 'whsec_test') {
  const t = nowSec();
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${sig}`;
}
function req(body: string, header?: string) {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: header ? { 'stripe-signature': header } : {},
  });
}

afterEach(() => vi.restoreAllMocks());

describe('POST /api/webhooks/stripe', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

  it('accepts a validly signed event', async () => {
    const res = await POST(req(body, signed(body)));
    expect(res.status).toBe(200);
  });

  it('rejects an event with no signature header', async () => {
    const res = await POST(req(body));
    expect(res.status).toBe(400);
  });

  it('rejects an event signed with the wrong secret', async () => {
    const res = await POST(req(body, signed(body, 'whsec_attacker')));
    expect(res.status).toBe(400);
  });

  it('rejects a body that does not match its signature', async () => {
    const header = signed(body);
    const res = await POST(req(JSON.stringify({ id: 'evt_2', type: 'x' }), header));
    expect(res.status).toBe(400);
  });
});
