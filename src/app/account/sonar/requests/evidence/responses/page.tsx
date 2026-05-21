import { headers } from 'next/headers';
import type { EvidenceResponseListResponse } from '@haiwave/protocol';
import { ResponsesTable } from './responses-table';

type LoadResult = EvidenceResponseListResponse | { error: string; status: number };

async function loadResponses(): Promise<LoadResult> {
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sonar/compliance/evidence/responses`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[responses/page] haiCore ${res.status}:`, body);
      return { error: body || `HTTP ${res.status}`, status: res.status };
    }
    return (await res.json()) as EvidenceResponseListResponse;
  } catch (e) {
    console.error('[responses/page] fetch threw:', e);
    return { error: e instanceof Error ? e.message : 'Network error', status: 0 };
  }
}

export default async function ResponsesPage() {
  const data = await loadResponses();
  if ('error' in data) {
    return (
      <div className="p-6">
        <p className="text-problem text-sm">Failed to load evidence responses (HTTP {data.status}).</p>
        {data.error && <pre className="text-xs text-slate mt-2 whitespace-pre-wrap">{data.error.slice(0, 500)}</pre>}
      </div>
    );
  }
  return (
    <div className="p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl font-semibold text-charcoal">Evidence Responses</h1>
      </div>
      <p className="text-sm text-slate mb-4">
        Immutable exported evidence packages. Each row is a finalized, hash-verified Trust Report.
      </p>
      <ResponsesTable rows={data.responses} />
    </div>
  );
}
