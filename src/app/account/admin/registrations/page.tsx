import { redirect } from 'next/navigation';
import { PageHeader } from '@/components';
import { isAdmin } from '@/lib/admin-guard';
import { fetchBffJson } from '@/lib/server-fetch';
import { RegistrationsTable } from './registrations-table';
import { RegistrationsFilters } from './registrations-filters';
import { riskTierMatches } from './registration-filter-logic';
import type {
  RegistrationListItem,
  RegistrationStatus,
} from '@/lib/registration-types';

interface ListPayload {
  requests: RegistrationListItem[];
}

function asStatus(v: string | undefined): RegistrationStatus | undefined {
  return v === 'pending_approval' || v === 'approved' || v === 'rejected'
    ? v
    : undefined;
}

// Admin gatekeeper queue — supplier registration requests awaiting (or past)
// adjudication. RSC: gate on isAdmin(), read the URL filters, fetch the list
// through the BFF (which forwards the status param to haiCore), and hand plain
// rows to the client table adapter (no render closures cross the RSC boundary).
//
// BUG-3: the queue is filterable by status and risk_tier. `status` defaults to
// `pending_approval` (preserving today's landing) — the "All" tab omits the
// param. The `<RegistrationsFilters>` client bar drives the URL so this RSC
// re-fetches on every change.
//
// BUG-4: the risk-tier filter is NON-EXCLUSIVE and display-aligned (Foreign
// covers elevated AND blocked; sanctioned IS foreign). The backend can only do
// an exact single-tier match, so we no longer forward `risk_tier` to the BFF —
// status alone is filtered server-side, and the risk-tier display token
// (standard|foreign|sanctioned) is applied as a predicate over the returned
// rows via `riskTierMatches`. "All" omits the param.
export default async function RegistrationsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; risk_tier?: string }>;
}) {
  if (!(await isAdmin())) redirect('/account');

  const sp = await searchParams;
  // No `status` param = the default landing (pending). An explicit `status=all`
  // sentinel (and anything else non-canonical) means "no status filter" → show
  // every status. Otherwise honor the literal pending_approval/approved/rejected.
  const status =
    sp.status === undefined ? 'pending_approval' : asStatus(sp.status);
  // BUG-4: the risk-tier display token (standard|foreign|sanctioned, or absent
  // for All) is NOT forwarded to the BFF — it's applied as a predicate below.
  const riskTierToken = sp.risk_tier;

  // Only `status` is filtered server-side (the BFF/backend exact-match contract
  // is unchanged).
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  const qs = query.toString();

  const result = await fetchBffJson<ListPayload>(
    `/api/admin/registration-requests${qs ? `?${qs}` : ''}`,
  );
  const fetched = result.kind === 'ok' ? result.data.requests : [];
  // Non-exclusive, display-aligned risk-tier match over the returned rows.
  const rows = fetched.filter((r) => riskTierMatches(r.risk_tier, riskTierToken));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Registration requests"
        description="Review and adjudicate supplier registrations."
      />
      <RegistrationsFilters />
      {result.kind === 'error' && (
        <p className="text-sm text-problem">
          Could not load registration requests ({result.message}).
        </p>
      )}
      <RegistrationsTable rows={rows} />
    </div>
  );
}
