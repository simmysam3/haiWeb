import Link from 'next/link';
import type {
  SearchCounterpartyHit,
  SearchResponse,
  SearchScopeHit,
  SearchSkuHit,
} from '@haiwave/protocol';
import { Pill } from '@/components/pill';
import { PageHeader } from '@/components/page-header';
import { fetchBffJson } from '@/lib/server-fetch';

/**
 * v1.37 — Full search results page.
 *
 * Server component. Reads `q` from searchParams, fetches once against the
 * BFF (which proxies to haiCore), and renders all three categorized
 * sections with per-section pagination via `page_counterparties`,
 * `page_skus`, `page_scopes` query params.
 *
 * The full-page surface uses a larger per-category limit than the dropdown
 * (5 → 25) so the user has room to overflow without bouncing back and
 * forth. Pagination is client-side-via-query-string only — server fetches
 * the full slice and walks the offset locally. For datasets large enough
 * to require true server pagination we'd need a paginated haiCore
 * endpoint; that's a follow-up.
 */

const PAGE_SIZE = 25;
const FETCH_LIMIT = 50; // headroom for two pages on the same fetch.
const MIN_QUERY_LEN = 2;

async function loadSearch(q: string): Promise<SearchResponse | null> {
  if (q.trim().length < MIN_QUERY_LEN) return null;
  // v1.37 follow-up #4: routed through the shared `fetchBffJson` helper so
  // search speaks the same fetch dialect as the dashboard (cookie
  // forwarding, base-URL resolution, and `cache: 'no-store'` all
  // centralized). The page surface stays best-effort: on a transport
  // failure we collapse to `null` and the caller renders the
  // "temporarily unavailable" copy — the discriminated `FetchResult`'s
  // status/message are logged for diagnostics.
  const result = await fetchBffJson<SearchResponse>(
    `/api/search?q=${encodeURIComponent(q)}&limit=${FETCH_LIMIT}`,
  );
  if (result.kind === 'error') {
    console.error('[search page] fetch failed', {
      status: result.status,
      message: result.message,
    });
    return null;
  }
  return result.data;
}

function parsePage(raw: string | string[] | undefined): number {
  const c = Array.isArray(raw) ? raw[0] : raw;
  if (!c) return 1;
  const n = Number(c);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page_counterparties?: string;
    page_skus?: string;
    page_scopes?: string;
  }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const pageCp = parsePage(params.page_counterparties);
  const pageSku = parsePage(params.page_skus);
  const pageSc = parsePage(params.page_scopes);

  const isTooShort = q.length < MIN_QUERY_LEN;
  const data = isTooShort ? null : await loadSearch(q);

  return (
    <div>
      <PageHeader
        title="Search"
        description={
          q
            ? `Results for "${q}"`
            : 'Search counterparties, SKUs, and audit scopes across the network.'
        }
      />

      {isTooShort && q.length > 0 && (
        <EmptyMessage>Type at least {MIN_QUERY_LEN} characters to search.</EmptyMessage>
      )}

      {!isTooShort && data === null && (
        <EmptyMessage>Search is temporarily unavailable.</EmptyMessage>
      )}

      {!isTooShort && data !== null && (
        <div className="space-y-8">
          <CounterpartySection
            q={q}
            hits={data.counterparties}
            page={pageCp}
            pageSku={pageSku}
            pageSc={pageSc}
          />
          <SkuSection
            q={q}
            hits={data.skus}
            page={pageSku}
            pageCp={pageCp}
            pageSc={pageSc}
          />
          <ScopeSection
            q={q}
            hits={data.scopes}
            page={pageSc}
            pageCp={pageCp}
            pageSku={pageSku}
          />

          {data.counterparties.length === 0 &&
            data.skus.length === 0 &&
            data.scopes.length === 0 && (
              <EmptyMessage>
                No results for {`"${q}"`}. Try a different keyword.
              </EmptyMessage>
            )}
        </div>
      )}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate/10 bg-white px-6 py-8 text-center text-sm text-slate">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Counterparties
// ---------------------------------------------------------------------------

function CounterpartySection({
  q,
  hits,
  page,
  pageSku,
  pageSc,
}: {
  q: string;
  hits: SearchCounterpartyHit[];
  page: number;
  pageSku: number;
  pageSc: number;
}) {
  const slice = paginate(hits, page);
  return (
    <section>
      <SectionHeader label="Counterparties" total={hits.length} />
      {hits.length === 0 ? (
        <EmptyMessage>No counterparties match {`"${q}"`}.</EmptyMessage>
      ) : (
        <ul className="rounded-md border border-slate/10 bg-white divide-y divide-slate/10">
          {slice.map((c) => (
            <li key={c.participant_id}>
              <Link
                href={`/account/partners/${c.participant_id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-light-gray"
              >
                <span className="truncate text-navy">
                  {c.legal_name}
                  {c.dba_name && (
                    <span className="ml-2 text-xs text-slate">
                      (dba {c.dba_name})
                    </span>
                  )}
                </span>
                <Pill category="status" value={c.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PaginationLinks
        q={q}
        total={hits.length}
        page={page}
        otherParams={{ page_skus: pageSku, page_scopes: pageSc }}
        pageParamName="page_counterparties"
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// SKUs
// ---------------------------------------------------------------------------

function SkuSection({
  q,
  hits,
  page,
  pageCp,
  pageSc,
}: {
  q: string;
  hits: SearchSkuHit[];
  page: number;
  pageCp: number;
  pageSc: number;
}) {
  const slice = paginate(hits, page);
  return (
    <section>
      <SectionHeader label="SKUs" total={hits.length} />
      {hits.length === 0 ? (
        <EmptyMessage>No SKUs match {`"${q}"`}.</EmptyMessage>
      ) : (
        <ul className="rounded-md border border-slate/10 bg-white divide-y divide-slate/10">
          {slice.map((s) => (
            <li key={s.obligation_id}>
              <Link
                href={`/account/sonar/audit/gaps?sku=${encodeURIComponent(s.product_id)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-light-gray"
              >
                <span className="truncate text-navy">
                  {s.sku_label}
                  <span className="ml-2 text-xs text-slate">
                    {s.product_id}
                    {s.responder_legal_name && ` · ${s.responder_legal_name}`}
                  </span>
                </span>
                <Pill category="status" value={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PaginationLinks
        q={q}
        total={hits.length}
        page={page}
        otherParams={{ page_counterparties: pageCp, page_scopes: pageSc }}
        pageParamName="page_skus"
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

function ScopeSection({
  q,
  hits,
  page,
  pageCp,
  pageSku,
}: {
  q: string;
  hits: SearchScopeHit[];
  page: number;
  pageCp: number;
  pageSku: number;
}) {
  const slice = paginate(hits, page);
  return (
    <section>
      <SectionHeader label="Scopes / Requests" total={hits.length} />
      {hits.length === 0 ? (
        <EmptyMessage>No scopes match {`"${q}"`}.</EmptyMessage>
      ) : (
        <ul className="rounded-md border border-slate/10 bg-white divide-y divide-slate/10">
          {slice.map((s) => (
            <li key={s.scope_id}>
              <Link
                href={`/account/sonar/requests?scope_id=${encodeURIComponent(s.scope_id)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-light-gray"
              >
                <span className="truncate text-navy">
                  {s.subject}
                  <span className="ml-2 text-xs text-slate">
                    {s.scope_type}
                    {s.counterparty_legal_name &&
                      ` · ${s.counterparty_legal_name}`}
                  </span>
                </span>
                <Pill category="status" value={s.acceptance_status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PaginationLinks
        q={q}
        total={hits.length}
        page={page}
        otherParams={{ page_counterparties: pageCp, page_skus: pageSku }}
        pageParamName="page_scopes"
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function SectionHeader({ label, total }: { label: string; total: number }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-navy">
        {label}
      </h2>
      <span className="text-xs text-slate">
        {total} {total === 1 ? 'result' : 'results'}
      </span>
    </div>
  );
}

function paginate<T>(rows: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return rows.slice(start, start + PAGE_SIZE);
}

function PaginationLinks({
  q,
  total,
  page,
  otherParams,
  pageParamName,
}: {
  q: string;
  total: number;
  page: number;
  otherParams: Record<string, number>;
  pageParamName: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;

  function pageHref(p: number): string {
    const sp = new URLSearchParams();
    sp.set('q', q);
    sp.set(pageParamName, String(p));
    for (const [k, v] of Object.entries(otherParams)) {
      if (v !== 1) sp.set(k, String(v));
    }
    return `/account/search?${sp.toString()}`;
  }

  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs">
      {page > 1 && (
        <Link
          href={pageHref(page - 1)}
          className="text-teal-dark hover:underline"
        >
          ← Previous
        </Link>
      )}
      <span className="text-slate">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={pageHref(page + 1)}
          className="text-teal-dark hover:underline"
        >
          Next →
        </Link>
      )}
    </div>
  );
}
