import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { sessionFor } from '@/test/role-gate';

const { getSession, navProps, helpProps } = vi.hoisted(() => ({
  getSession: vi.fn(),
  navProps: [] as Array<Record<string, unknown>>,
  helpProps: [] as Array<{ enabled: boolean; ownerKey: string | null }>,
}));
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
vi.mock('@/components/help', () => ({
  HelpProvider: ({ enabled, ownerKey, children }: { enabled: boolean; ownerKey: string | null; children: React.ReactNode }) => {
    helpProps.push({ enabled, ownerKey });
    return <>{children}</>;
  },
}));

beforeEach(() => {
  navProps.length = 0;
  helpProps.length = 0;
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

  it('mounts the help provider, enabled only when HELP_AGENT_ENABLED=true', async () => {
    const { default: AccountLayout } = await import('../layout');
    getSession.mockResolvedValue(sessionFor('account_admin'));
    render(await AccountLayout({ children: null }));
    process.env.HELP_AGENT_ENABLED = 'true';
    try {
      render(await AccountLayout({ children: null }));
    } finally {
      delete process.env.HELP_AGENT_ENABLED;
    }
    expect(helpProps.map((p) => p.enabled)).toEqual([false, true]);
  });

  it("hands the provider the signed-in user's owner key, and null without a session (amendment P3-7)", async () => {
    const { default: AccountLayout } = await import('../layout');
    getSession.mockResolvedValueOnce(sessionFor('account_admin'));
    render(await AccountLayout({ children: null }));
    getSession.mockResolvedValueOnce(null);
    render(await AccountLayout({ children: null }));
    // The key of participant-1:user-1, computed once outside the test (P3-7).
    expect(helpProps.map((p) => p.ownerKey)).toEqual([
      'b161539033611f261ba7bcd678a2474a0b0235073d8c96352ba1e92c62179c57',
      null,
    ]);
  });
});
