import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/phantom-demand/reports/latest
 *
 * Resolves the caller's latest phantom-demand window via haiCore, creating
 * a default 30-day rolling window if none exists. Returns `{ window_id }`
 * for the page redirect to consume.
 */
export const GET = withHaiCore(async ({ client }) => {
  const haiCoreRes = await client.fetchRaw('/sonar/phantom-demand/reports/latest', {
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
  const body = (await haiCoreRes.json()) as { window_id: string };
  return body;
});
