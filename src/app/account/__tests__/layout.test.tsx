import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { sessionFor } from '@/test/role-gate';

const { getSession, navProps } = vi.hoisted(() => ({ getSession: vi.fn(), navProps: [] as Array<Record<string, unknown>> }));
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, getSession };
});
vi.mock('@/components/account-nav', () => ({
  AccountNav: (p: Record<string, unknown>) => {
    navProps.push(p);
    return null;
  },
}));
vi.mock('@/components/throttle-header-indicator', () => ({ ThrottleHeaderIndicator: () => null }));
vi.mock('@/components/global-search', () => ({ GlobalSearch: () => null }));

beforeEach(() => {
  navProps.length = 0;
});

describe('AccountLayout', () => {
  it('grants the Sourcing Map nav item to the account_admin family only', async () => {
    const { default: AccountLayout } = await import('../layout');
    getSession.mockResolvedValueOnce(sessionFor('procurement_transact'));
    render(await AccountLayout({ children: null }));
    getSession.mockResolvedValueOnce(sessionFor('buyer_view_only'));
    render(await AccountLayout({ children: null }));
    expect(navProps.map((p) => p.canUseSourcingMap)).toEqual([true, false]);
  });
});
