import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { sessionFor, NON_ADMINISTERING_ROLES } from '@/test/role-gate';

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  // next/navigation's redirect never returns: it throws.
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));
// Only the session is doubled; the role check is the real one.
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, getSession };
});
vi.mock('next/navigation', () => ({ redirect }));

import BillingPage from '../page';

beforeEach(() => {
  getSession.mockReset();
  redirect.mockClear();
});

describe('BillingPage: who may open it', () => {
  it('opens for an account_admin', async () => {
    getSession.mockResolvedValue(sessionFor('account_admin'));
    render(await BillingPage());
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('opens for an account_owner', async () => {
    getSession.mockResolvedValue(sessionFor('account_owner'));
    render(await BillingPage());
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(NON_ADMINISTERING_ROLES)('sends a %s to the dashboard', async (role) => {
    getSession.mockResolvedValue(sessionFor(role));
    await expect(BillingPage()).rejects.toThrow('REDIRECT:/account');
    expect(redirect).toHaveBeenCalledWith('/account');
  });

  it('sends a visitor with no session to the dashboard', async () => {
    getSession.mockResolvedValue(null);
    await expect(BillingPage()).rejects.toThrow('REDIRECT:/account');
    expect(redirect).toHaveBeenCalledWith('/account');
  });
});
