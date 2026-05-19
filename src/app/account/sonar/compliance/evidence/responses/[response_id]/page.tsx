import { headers } from 'next/headers';
import type { EvidenceResponse } from '@haiwave/protocol';
import { ResponseDetail } from './response-detail';

async function loadResponse(responseId: string): Promise<EvidenceResponse | null | 'not_found'> {
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sonar/compliance/evidence/responses/${encodeURIComponent(responseId)}`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (res.status === 404) return 'not_found';
    if (!res.ok) return null;
    return (await res.json()) as EvidenceResponse;
  } catch (e) {
    console.error('[response-detail/page] fetch threw:', e);
    return null;
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
  if (!data) {
    return (
      <div className="p-6 text-problem text-sm">
        Failed to load evidence response.
      </div>
    );
  }
  return <ResponseDetail response={data} />;
}
