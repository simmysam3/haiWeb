import { NextResponse } from 'next/server';
import type { AuditRun, Type2Run } from '@haiwave/protocol';
import { withHaiCore } from '@/lib/with-hai-core';

type RouteParams = Record<string, string> & { id: string };

interface RunRow {
  run_id: string;
  status: string;
  triggered_at: string;
  completed_at: string | null;
  run_origin: string;
}

const PAGE_LIMIT = 25;
const FETCH_LIMIT = 200;

function normalizeAuditRun(r: AuditRun): RunRow {
  return {
    run_id: r.run_id,
    status: r.status,
    triggered_at: r.triggered_at,
    completed_at: (r as { completed_at?: string | null }).completed_at ?? null,
    run_origin: (r as { run_origin?: string }).run_origin ?? 'ad_hoc',
  };
}

function normalizeType2Run(r: Type2Run): RunRow {
  return {
    run_id: r.run_id,
    status: r.status,
    triggered_at: r.triggered_at,
    completed_at: (r as { completed_at?: string | null }).completed_at ?? null,
    run_origin: (r as { run_origin?: string }).run_origin ?? 'ad_hoc',
  };
}

export const GET = withHaiCore<RouteParams>(async ({ client, params }) => {
  const { template } = await client.getRunTemplate(params.id);
  if (template.observation_class === 'audit') {
    const { runs } = await client.listAuditRuns({ template_id: params.id, limit: FETCH_LIMIT });
    return NextResponse.json({ runs: runs.slice(0, PAGE_LIMIT).map(normalizeAuditRun) });
  }
  if (template.observation_class === 'type2') {
    const { runs } = await client.listType2Runs({ template_id: params.id, limit: FETCH_LIMIT });
    return NextResponse.json({ runs: runs.slice(0, PAGE_LIMIT).map(normalizeType2Run) });
  }
  return NextResponse.json({ runs: [] });
});
