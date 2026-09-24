import { forbidden } from 'next/navigation';
import { getSession, hasRole } from '@/lib/auth';

/**
 * The Sourcing Map is a launched app with its own shell (spec §9.1), the
 * /admin precedent (src/app/admin/layout.tsx). proxy.ts sends a request
 * with no session cookie to login; a stale cookie with no session also
 * gets 403 here. Roles outside hasRole(…,'account_admin') get 403
 * (spec §9.2, §10, AC 1).
 */
export default async function SourcingMapLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !hasRole(session.user.role, 'account_admin')) forbidden();
  return <>{children}</>;
}
