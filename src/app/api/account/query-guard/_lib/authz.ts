import { NextResponse } from 'next/server';
import type { Session, UserRole } from '@/lib/auth';

/**
 * Roles allowed to edit query-guard configuration and enforcement states.
 * The spec (§9) restricts editing to account_owner / account_admin; every
 * other role is read-only. Deliberately stricter than
 * `hasRole(role, 'account_admin')`, whose ladder also grants the transact
 * roles (procurement_transact, buyer_full_transact, inside_sales_transact) —
 * outbound purchasing authority must not confer control over inbound
 * anti-probing defenses.
 */
const QUERY_GUARD_EDIT_ROLES: readonly UserRole[] = ['account_owner', 'account_admin'];

/**
 * Returns a 403 response when the session's role may not edit query-guard
 * state, or null when the caller is an owner/admin. Call at the top of every
 * mutating query-guard route handler.
 */
export function forbidNonEditor(session: Session): NextResponse | null {
  if (QUERY_GUARD_EDIT_ROLES.includes(session.user.role)) return null;
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
