import Link from 'next/link';
import type { RequestManagementListResponse } from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { fetchBffJson } from '@/lib/server-fetch';

interface SearchParams {
  all?: string;
}

async function fetchDeclined(includeAll: boolean) {
  const qs = includeAll ? 'all=true' : 'days=30';
  // BFF path mirrors the Task 18 contract used by the active queue
  // (`/api/sonar/compliance/requests`, no `/account/` prefix). The declined
  // sub-route is `/api/sonar/compliance/requests/declined`.
  return fetchBffJson<RequestManagementListResponse>(
    `/api/sonar/compliance/requests/declined?${qs}`,
  );
}

interface PageProps {
  // Next.js 15+ App Router: searchParams is a Promise.
  searchParams: Promise<SearchParams>;
}

/**
 * v1.35 Request Management — Declined history surface (Q7).
 *
 * Read-only audit-trail counterpart to the active queue at
 * `/account/sonar/compliance/requests`. Declined items cannot be
 * un-declined — the counterparty would need to re-nominate — so this page
 * surfaces no row actions.
 *
 * Default view: declined items from the last 30 days.
 * `?all=true` query string: full backlog of every declined item ever.
 *
 * Decision-reason note: `RequestManagementItem` (protocol 3.x) does not
 * yet expose `decision_reason`. Reasons are captured by the decline flow
 * and persisted to audit events on haiCore, but the list DTO does not
 * surface them. We render `—` in the Reason column for now and document
 * the follow-up to extend the protocol schema in a later cycle.
 */
export default async function DeclinedRequestsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const includeAll = params.all === 'true';
  const result = await fetchDeclined(includeAll);

  return (
    <div className="px-8 py-10">
      <header className="mb-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">
          Declined Requests
        </h1>
        {result.kind === 'ok' && (
          <p className="mt-2 text-slate">
            {includeAll
              ? `All ${result.data.total} declined items in your history.`
              : `Declined within the last 30 days (${result.data.total} ${result.data.total === 1 ? 'item' : 'items'}).`}
          </p>
        )}
        <div className="mt-3 flex items-center gap-4 text-sm">
          <Link
            href="/account/sonar/compliance/requests"
            className="text-teal hover:text-navy"
          >
            ← Back to active requests
          </Link>
          <Link
            href={
              includeAll
                ? '/account/sonar/compliance/requests/declined'
                : '/account/sonar/compliance/requests/declined?all=true'
            }
            className="text-teal hover:text-navy"
          >
            {includeAll ? 'Show 30-day default' : 'View all declines'}
          </Link>
        </div>
      </header>

      {result.kind === 'error' ? (
        <div role="alert" className="rounded-lg border border-slate/20 bg-white p-12 text-center">
          <p className="text-red-900">
            Couldn&apos;t load declined requests. The compliance service is temporarily
            unavailable.
          </p>
        </div>
      ) : result.data.items.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-sm text-slate">
            {includeAll
              ? 'No declined requests on record.'
              : 'No requests have been declined in the last 30 days.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate/5 text-xs uppercase tracking-wider text-slate">
                <th scope="col" className="px-4 py-2 font-medium">Counterparty</th>
                <th scope="col" className="px-4 py-2 font-medium">Subject</th>
                <th scope="col" className="px-4 py-2 font-medium">Type</th>
                <th scope="col" className="px-4 py-2 font-medium">Reason</th>
                <th scope="col" className="px-4 py-2 font-medium">Declined</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((item) => (
                <tr key={item.item_id} className="border-t border-slate/10">
                  <td className="px-4 py-3 text-sm text-navy">
                    {item.counterparty_legal_name ?? item.counterparty_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-charcoal">{item.subject}</td>
                  <td className="px-4 py-3">
                    <Pill category="request-type" value={item.item_type} />
                  </td>
                  <td
                    className="px-4 py-3 text-sm text-slate"
                    title="Decline reasons are stored in audit events; surfacing them in this view is a follow-up."
                  >
                    —
                  </td>
                  <td className="px-4 py-3 text-xs text-slate">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 px-4 text-xs text-slate">
            Decline reasons are captured in audit events; surfacing them inline is a follow-up.
          </p>
        </div>
      )}
    </div>
  );
}
