import { describe, it, expect } from 'vitest';
import { resolveUserRole, hasRole } from '../auth';

describe('resolveUserRole', () => {
  it('resolves account_admin from the realm roles (regression: it was missing from the priority list)', () => {
    expect(resolveUserRole(['account_admin'])).toBe('account_admin');
  });

  it('maps haiwave_admin to account_owner', () => {
    expect(resolveUserRole(['offline_access', 'haiwave_admin'])).toBe('account_owner');
  });

  it('prefers account_owner over account_admin when both are present', () => {
    expect(resolveUserRole(['account_admin', 'account_owner'])).toBe('account_owner');
  });

  it('prefers account_admin over lower-priority roles', () => {
    expect(resolveUserRole(['buyer_view_only', 'account_admin'])).toBe('account_admin');
  });

  it('defaults to buyer_view_only when no assignable role is present', () => {
    expect(resolveUserRole([])).toBe('buyer_view_only');
    expect(resolveUserRole(['offline_access', 'uma_authorization'])).toBe('buyer_view_only');
  });
});

describe('hasRole with account_admin', () => {
  it('grants an account_admin gate to an account_admin user', () => {
    expect(hasRole('account_admin', 'account_admin')).toBe(true);
  });

  it('grants an account_admin gate to account_owner', () => {
    expect(hasRole('account_owner', 'account_admin')).toBe(true);
  });

  it('denies an account_admin gate to buyer_view_only', () => {
    expect(hasRole('buyer_view_only', 'account_admin')).toBe(false);
  });
});
