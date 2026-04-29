import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

export const GET = withHaiCore<{ run_id: string; vendor_id: string }>(
  async ({ client, request, params }) => {
    const format = request.nextUrl.searchParams.get('format');
    const filename = `per-vendor-${params.run_id}-${params.vendor_id}`;

    if (format === 'csv') {
      // CSV passthrough: bypass HaiwaveClient.request<T>() (JSON-only).
      // URL rewrite: HaiWeb /vendor/{id} → haiCore /company/{id} (same UUID).
      const haiCoreRes = await client.fetchRaw(
        `/sonar/audit/reports/${params.run_id}/company/${params.vendor_id}`,
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

    // JSON path (default for inline; explicit format=json for download).
    const report = await client.getPerVendorReport(params.run_id, params.vendor_id);

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
  },
);
