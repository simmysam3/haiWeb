import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ run_id: string }>(async ({ client, request, params }) => {
  const format = request.nextUrl.searchParams.get('format');
  const filename = `aggregate-${params.run_id}`;

  if (format === 'csv') {
    // CSV passthrough: bypass HaiwaveClient.request<T>() (JSON-only).
    const haiCoreRes = await client.fetchRaw(
      `/sonar/audit/reports/${params.run_id}/aggregate`,
      { headers: { Accept: 'text/csv' } },
    );
    // fetchRaw returns the raw Response and does not throw on non-OK status,
    // unlike request<T>() in the JSON path. Check ok manually here.
    if (!haiCoreRes.ok) {
      const text = await haiCoreRes.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: `haiCore returned ${haiCoreRes.status}` };
      }
      return NextResponse.json(body, { status: haiCoreRes.status });
    }
    const body = await haiCoreRes.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  if (format === 'pdf') {
    // PDF passthrough: binary body via arrayBuffer(), not text(). Mirrors the
    // CSV branch but preserves the raw bytes for the browser download.
    const haiCoreRes = await client.fetchRaw(
      `/sonar/audit/reports/${params.run_id}/aggregate`,
      { headers: { Accept: 'application/pdf' } },
    );
    if (!haiCoreRes.ok) {
      const text = await haiCoreRes.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        body = { error: `haiCore returned ${haiCoreRes.status}` };
      }
      return NextResponse.json(body, { status: haiCoreRes.status });
    }
    const body = await haiCoreRes.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    });
  }

  // JSON path (default for inline; explicit format=json for download).
  const report = await client.getAggregateReport(params.run_id);

  if (format === 'json') {
    return new NextResponse(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    });
  }

  // Default: inline JSON for the Server Component (no Content-Disposition).
  return report;
});
