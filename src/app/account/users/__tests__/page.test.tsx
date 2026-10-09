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
// The table fetches the roster on mount; a marker stands in for it.
vi.mock('../users-table', () => ({ UsersTable: () => <div data-testid="users-table" /> }));

import UsersPage from '../page';

beforeEach(() => {
  getSession.mockReset();
  redirect.mockClear();
});

describe('UsersPage: who may open it', () => {
  it('opens for an account_admin', async () => {
    getSession.mockResolvedValue(sessionFor('account_admin'));
    render(await UsersPage());
    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByTestId('users-table')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('opens for an account_owner', async () => {
    getSession.mockResolvedValue(sessionFor('account_owner'));
    render(await UsersPage());
    expect(screen.getByTestId('users-table')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each(NON_ADMINISTERING_ROLES)('sends a %s to the dashboard', async (role) => {
    getSession.mockResolvedValue(sessionFor(role));
    await expect(UsersPage()).rejects.toThrow('REDIRECT:/account');
    expect(redirect).toHaveBeenCalledWith('/account');
  });

  it('sends a visitor with no session to the dashboard', async () => {
    getSession.mockResolvedValue(null);
    await expect(UsersPage()).rejects.toThrow('REDIRECT:/account');
    expect(redirect).toHaveBeenCalledWith('/account');
  });
});
