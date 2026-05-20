import { headers } from 'next/headers';
import type { EvidenceResponse } from '@haiwave/protocol';
import { ResponseDetail } from './response-detail';

type LoadResult = EvidenceResponse | 'not_found' | { error: string; status: number };

async function loadResponse(responseId: string): Promise<LoadResult> {
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sonar/compliance/evidence/responses/${encodeURIComponent(responseId)}`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (res.status === 404) return 'not_found';
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[response-detail/page] haiCore ${res.status}:`, body);
      return { error: body || `HTTP ${res.status}`, status: res.status };
    }
    return (await res.json()) as EvidenceResponse;
  } catch (e) {
    console.error('[response-detail/page] fetch threw:', e);
    return { error: e instanceof Error ? e.message : 'Network error', status: 0 };
  }
}

interface PageProps {
  params: Promise<{ response_id: string }>;
}

export default async function ResponseDetailPage({ params }: PageProps) {
  const { response_id } = await params;
  const data = await loadResponse(response_id);
  if (data === 'not_found') {
    return (
      <div className="p-6 text-sm text-slate">
        Evidence response not found.
      </div>
    );
  }
  if (typeof data === 'object' && 'error' in data) {
    return (
      <div className="p-6">
        <p className="text-problem text-sm">Failed to load evidence response (HTTP {data.status}).</p>
        {data.error && <pre className="text-xs text-slate mt-2 whitespace-pre-wrap">{data.error.slice(0, 500)}</pre>}
      </div>
    );
  }
  return <ResponseDetail response={data} />;
}
