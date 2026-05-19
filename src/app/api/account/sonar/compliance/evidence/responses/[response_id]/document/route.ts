import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/** GET BFF → haiCore GET /sonar/compliance/evidence/responses/:id/document?format= (v1.34 P9). */
export const GET = withHaiCore<{ response_id: string }>(async ({ client, request, params }) => {
  const format = request.nextUrl.searchParams.get('format') ?? 'pdf';
  const upstream = await client.fetchRaw(
    `/sonar/compliance/evidence/responses/${encodeURIComponent(params.response_id)}/document?format=${encodeURIComponent(format)}`,
  );
  if (!upstream.ok) {
    const text = await upstream.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = { error: `haiCore returned ${upstream.status}` }; }
    return NextResponse.json(body, { status: upstream.status });
  }
  const ct = upstream.headers.get('Content-Type') ?? 'application/octet-stream';
  const hash = upstream.headers.get('X-Document-Hash') ?? '';
  const matches = upstream.headers.get('X-Document-Hash-Matches') ?? '';
  const ext = format === 'pdf' ? 'pdf' : format === 'html' ? 'html' : 'json';
  const filename = `evidence-response-${params.response_id}.${ext}`;
  const body = format === 'pdf' ? await upstream.arrayBuffer() : await upstream.text();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': ct,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Document-Hash': hash,
      'X-Document-Hash-Matches': matches,
    },
  });
});
