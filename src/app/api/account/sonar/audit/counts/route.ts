import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/audit/counts — aggregate counts for the Sonar Audit IA header.
 *
 * Returns:
 *   scheduled_count  — number of run templates with observation_class='audit' and enabled=true
 *   in_flight_count  — number of audit runs currently in 'running' status
 *
 * Both client calls run in parallel. If either rejects, its count falls back to 0;
 * the response is always 200 (no 500 on transient haiCore errors).
 */
export const GET = withHaiCore(async ({ client }) => {
  const [scheduledResult, inFlightResult] = await Promise.allSettled([
    client.listRunTemplates(),
    client.listAuditRuns({ status: 'running' }),
  ]);

  const scheduled_count =
    scheduledResult.status === 'fulfilled'
      ? scheduledResult.value.templates.filter(
          (t) => t.observation_class === 'audit' && t.enabled === true,
        ).length
      : 0;

  const in_flight_count =
    inFlightResult.status === 'fulfilled' ? inFlightResult.value.runs.length : 0;

  return NextResponse.json({ scheduled_count, in_flight_count });
});
