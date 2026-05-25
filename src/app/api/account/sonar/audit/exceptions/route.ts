import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/audit/exceptions — v.1.41 Audit Exceptions surface.
 *
 * Latest non-compliant audit result per (vendor, product) within a rolling
 * window (default 7d). Forwards the optional window_days query param to
 * haiCore so the UI can later expose a window selector without code changes.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const raw = url.searchParams.get('window_days');
  const parsed = raw !== null ? Number.parseInt(raw, 10) : null;
  const windowDays =
    parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  const data = await client.getAuditExceptions(
    windowDays !== undefined ? { windowDays } : undefined,
  );
  return NextResponse.json(data);
});
