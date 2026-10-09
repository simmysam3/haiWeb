import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { sessionFor, ADMINISTERING_ROLES, NON_ADMINISTERING_ROLES } from '@/test/role-gate';

const { getSession, navProps, helpProps } = vi.hoisted(() => ({
  getSession: vi.fn(),
  navProps: [] as Array<Record<string, unknown>>,
  helpProps: [] as Array<{ enabled: boolean; ownerKey: string | null }>,
}));
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, getSession };
});
// Each mock renders a marker, so a test can see whether AccountNav sits inside the provider.
vi.mock('@/components/account-nav', () => ({
  AccountNav: (p: Record<string, unknown>) => {
    navProps.push(p);
    return <nav data-testid="account-nav" />;
  },
}));
vi.mock('@/components/throttle-header-indicator', () => ({ ThrottleHeaderIndicator: () => null }));
vi.mock('@/components/global-search', () => ({ GlobalSearch: () => null }));
vi.mock('@/components/help', () => ({
  HelpProvider: ({ enabled, ownerKey, children }: { enabled: boolean; ownerKey: string | null; children: React.ReactNode }) => {
    helpProps.push({ enabled, ownerKey });
    return <div data-testid="help-provider">{children}</div>;
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

  it('grants the Users and Billing nav items to account_admin', async () => {
    const { default: AccountLayout } = await import('../layout');
    getSession.mockResolvedValueOnce(sessionFor('account_admin'));
    render(await AccountLayout({ children: null }));
    expect(navProps.map((p) => p.canAdministerAccount)).toEqual([true]);
  });

  it('grants them to the two administering roles and to no other role, nor without a session', async () => {
    const { default: AccountLayout } = await import('../layout');
    for (const role of [...ADMINISTERING_ROLES, ...NON_ADMINISTERING_ROLES]) {
      getSession.mockResolvedValueOnce(sessionFor(role));
      render(await AccountLayout({ children: null }));
    }
    getSession.mockResolvedValueOnce(null);
    render(await AccountLayout({ children: null }));
    expect(navProps.map((p) => p.canAdministerAccount)).toEqual([
      true, true, // account_owner, account_admin
      false, false, false, false, false, false, false, // the three transact roles and the four others
      false, // no session
    ]);
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

  it('renders AccountNav, which holds the Help button, inside the help provider (Task 3.9 review)', async () => {
    const { default: AccountLayout } = await import('../layout');
    getSession.mockResolvedValueOnce(sessionFor('account_admin'));
    render(await AccountLayout({ children: null }));
    // HelpButton renders nothing outside the provider's context, so a nav outside it has no Help button.
    expect(screen.getByTestId('help-provider')).toContainElement(screen.getByTestId('account-nav'));
  });
});
