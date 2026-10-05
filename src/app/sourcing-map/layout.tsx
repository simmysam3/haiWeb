import { forbidden } from 'next/navigation';
import { getSession, hasRole } from '@/lib/auth';
import { fetchBffJson } from '@/lib/server-fetch';
import { loadEnv } from '@/config/env';
import { HelpProvider } from '@/components/help';
import { helpOwnerKey } from '@/lib/help-owner';
import type { SmSupplyRiskListResponse } from '@/lib/sourcing-map/types';
import { OpenRisksProvider } from './_components/open-risks';
import { SmThemeRoot } from './_components/theme-root';
import './sourcing-map.css';

/**
 * The Sourcing Map is a launched app with its own shell (spec §9.1), the
 * /admin precedent (src/app/admin/layout.tsx). proxy.ts sends a request
 * with no session cookie to login; a stale cookie with no session also
 * gets 403 here. Roles outside hasRole(…,'account_admin') get 403
 * (spec §9.2, §10, AC 1). After that check it reads the header's open supply-risk
 * count once for every page under it; a failed read leaves the plain link.
 */
export default async function SourcingMapLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !hasRole(session.user.role, 'account_admin')) forbidden();
  const risks = await fetchBffJson<SmSupplyRiskListResponse>(
    '/api/account/sourcing-map/supply-risks?status=open&status=contacted&status=resolving',
  );
  const openCount = risks.kind === 'ok' && Number.isInteger(risks.data.open_count) ? risks.data.open_count : null;
  return (
    // HAIWAVE Help (spec §7.1): the same panel as /account, restored from sessionStorage
    // for the same signed-in user only (amendment P3-7).
    <HelpProvider enabled={loadEnv().HELP_AGENT_ENABLED} ownerKey={helpOwnerKey(session)}>
      <SmThemeRoot>
        <OpenRisksProvider count={openCount}>{children}</OpenRisksProvider>
      </SmThemeRoot>
    </HelpProvider>
  );
}
