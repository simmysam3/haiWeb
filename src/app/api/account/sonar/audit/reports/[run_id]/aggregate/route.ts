import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ run_id: string }>(async ({ client, request, params }) => {
  const format = request.nextUrl.searchParams.get('format');

  if (format === 'csv') {
    // CSV passthrough: bypass HaiwaveClient.request<T>() (JSON-only).
    const haiCoreRes = await client.fetchRaw(
      `/sonar/audit/reports/${params.run_id}/aggregate`,
      { headers: { Accept: 'text/csv' } },
    );
    if (!haiCoreRes.ok) {
      return NextResponse.json(
        { error: `haiCore returned ${haiCoreRes.status}` },
        { status: haiCoreRes.status },
      );
    }
    const body = await haiCoreRes.text();
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="aggregate-${params.run_id}.csv"`,
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
        'Content-Disposition': `attachment; filename="aggregate-${params.run_id}.json"`,
      },
    });
  }

  // Default: inline JSON for the Server Component (no Content-Disposition).
  return report;
});
