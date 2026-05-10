import { NextResponse } from 'next/server';
import type { AuditRun, WatcherRun } from '@haiwave/protocol';
import type { PhantomDemandRun } from '@/lib/haiwave-api';
import { withHaiCore } from '@/lib/with-hai-core';

type Modality = 'audit' | 'watcher' | 'phantom_demand';

interface ActivityEvent {
  run_id: string;
  modality: Modality;
  status: string;
  partner_id: string | null;
  partner_name: string | null;
  triggered_at: string;
  completed_at: string | null;
  run_origin: string;
  detail_href: string;
}

const MAX_EVENTS = 30;
const MODALITY_LIMIT = 20;

function normalizeAudit(r: AuditRun): ActivityEvent {
  return {
    run_id: r.run_id,
    modality: 'audit',
    status: r.status,
    partner_id: null,
    partner_name: null,
    triggered_at: r.triggered_at,
    completed_at: (r as { completed_at?: string | null }).completed_at ?? null,
    run_origin: (r as { run_origin?: string }).run_origin ?? 'ad_hoc',
    detail_href: `/account/sonar/audit/runs/${r.run_id}`,
  };
}

function normalizeWatcher(r: WatcherRun): ActivityEvent {
  return {
    run_id: r.run_id,
    modality: 'watcher',
    status: r.status,
    partner_id: null,
    partner_name: null,
    triggered_at: r.triggered_at,
    completed_at: (r as { completed_at?: string | null }).completed_at ?? null,
    run_origin: (r as { run_origin?: string }).run_origin ?? 'ad_hoc',
    detail_href: `/account/sonar/watcher/dashboard`,
  };
}

export const GET = withHaiCore(async ({ client }) => {
  const auditP = client
    .listAuditRuns({ limit: MODALITY_LIMIT })
    .then((r: { runs: AuditRun[] }) => r.runs.map(normalizeAudit))
    .catch((err) => {
      console.error('[dashboard/activity] auditP failed:', err);
      return [] as ActivityEvent[];
    });

  const watcherP = client
    .listWatcherRuns()
    .then((r: { runs: WatcherRun[] }) => r.runs.slice(0, MODALITY_LIMIT).map(normalizeWatcher))
    .catch((err) => {
      console.error('[dashboard/activity] watcherP failed:', err);
      return [] as ActivityEvent[];
    });

  // v1.30 §7.7 — PD activity now sourced from phantom_demand_runs (not v1.21 windows/reports).
  const pdP = client
    .listPhantomDemandRuns({ limit: MODALITY_LIMIT })
    .then((runs: PhantomDemandRun[]) =>
      runs.map(
        (r): ActivityEvent => ({
          run_id: r.run_id,
          modality: 'phantom_demand',
          status: r.status,
          partner_id: null,
          partner_name: null,
          triggered_at: r.created_at,
          completed_at: r.completed_at ?? null,
          run_origin: r.run_origin ?? 'ad_hoc',
          detail_href: `/account/sonar/phantom-demand/runs/${r.run_id}`,
        }),
      ),
    )
    .catch((err) => {
      console.error('[dashboard/activity] pdP failed:', err);
      return [] as ActivityEvent[];
    });

  const [auditEvents, watcherEvents, pdEvents] = await Promise.all([auditP, watcherP, pdP]);

  const all = [...auditEvents, ...watcherEvents, ...pdEvents].sort((a, b) =>
    a.triggered_at < b.triggered_at ? 1 : a.triggered_at > b.triggered_at ? -1 : 0,
  );

  return NextResponse.json({
    events: all.slice(0, MAX_EVENTS),
    generated_at: new Date().toISOString(),
  });
});
