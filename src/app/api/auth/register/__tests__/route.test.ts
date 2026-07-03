import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// These collaborators implemented the retired instant-provision bypass.
// After D-19 the BFF must NOT touch any of them — provisioning lives in
// haiCore behind the admin gatekeeper. (The Stripe client the old flow also
// called has since been removed entirely, so there is nothing left to mock.)
const { createUser, deleteUser, registerParticipant } =
  vi.hoisted(() => ({
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    registerParticipant: vi.fn(),
  }));

vi.mock('@/lib/keycloak', () => ({ createUser, deleteUser }));
vi.mock('@/lib/haiwave-api', () => ({ registerParticipant }));

import { POST } from '../route';

const post = (body: unknown) =>
  POST(
    new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

const validSignup = {
  email: 'a@b.com',
  password: 'a-very-strong-pw',
  first_name: 'A',
  last_name: 'B',
  company: {
    name: 'Acme',
    business_type: 'LLC',
    phone: '555',
    email: 'a@b.com',
    address: { line1: '1', city: 'X', state: 'CA', postal_code: '9' },
  },
  payment_method: 'invoice',
};

describe('POST /api/auth/register (retired open self-signup)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not provision a Keycloak user or participant', async () => {
    await post(validSignup);
    expect(createUser).not.toHaveBeenCalled();
    expect(registerParticipant).not.toHaveBeenCalled();
  });

  it('returns 410 Gone and never issues a session cookie', async () => {
    const res = await post(validSignup);
    expect(res.status).toBe(410);
    expect(res.cookies.get('haiwave_session')).toBeUndefined();
  });
});
