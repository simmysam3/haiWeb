import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/phantom-demand/reports/[window_id]/counterparty/[counterparty_id]
 *
 * Proxies the v1.28 Phase 4 phantom-demand per-counterparty report. Supports
 * `?format=json|csv|pdf` for downloads.
 */
export const GET = withHaiCore<{ window_id: string; counterparty_id: string }>(
  async ({ client, request, params }) => {
    const format = request.nextUrl.searchParams.get('format');
    const filename = `phantom-demand-${params.window_id}-${params.counterparty_id}`;
    const haiCorePath = `/sonar/phantom-demand/reports/${params.window_id}/counterparty/${params.counterparty_id}`;

    if (format === 'csv') {
      const haiCoreRes = await client.fetchRaw(haiCorePath, {
        headers: { Accept: 'text/csv' },
      });
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
      const haiCoreRes = await client.fetchRaw(haiCorePath, {
        headers: { Accept: 'application/pdf' },
      });
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

    // JSON path.
    const haiCoreRes = await client.fetchRaw(haiCorePath, {
      headers: { Accept: 'application/json' },
    });
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
    const reportText = await haiCoreRes.text();
    const report = JSON.parse(reportText);

    if (format === 'json') {
      return new NextResponse(JSON.stringify(report, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        },
      });
    }

    return report;
  },
);
