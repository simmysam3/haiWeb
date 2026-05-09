import { NextResponse } from 'next/server';
import type { AuditRun, Type2Run } from '@haiwave/protocol';
import { withHaiCore } from '@/lib/with-hai-core';

type Modality = 'audit' | 'type2' | 'phantom_demand';

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

function normalizeType2(r: Type2Run): ActivityEvent {
  return {
    run_id: r.run_id,
    modality: 'type2',
    status: r.status,
    partner_id: null,
    partner_name: null,
    triggered_at: r.triggered_at,
    completed_at: (r as { completed_at?: string | null }).completed_at ?? null,
    run_origin: (r as { run_origin?: string }).run_origin ?? 'ad_hoc',
    detail_href: `/account/sonar/type2/dashboard`,
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

  const type2P = client
    .listType2Runs()
    .then((r: { runs: Type2Run[] }) => r.runs.slice(0, MODALITY_LIMIT).map(normalizeType2))
    .catch((err) => {
      console.error('[dashboard/activity] type2P failed:', err);
      return [] as ActivityEvent[];
    });

  const pdP = (async (): Promise<ActivityEvent[]> => {
    try {
      const latestRes = await client.fetchRaw('/sonar/phantom-demand/reports/latest');
      if (!latestRes.ok) return [];
      const { window_id } = (await latestRes.json()) as { window_id: string };
      const aggRes = await client.fetchRaw(`/sonar/phantom-demand/reports/${window_id}/aggregate`);
      if (!aggRes.ok) return [];
      const agg = (await aggRes.json()) as { header: { generated_at: string; window_id: string } };
      return [
        {
          run_id: window_id,
          modality: 'phantom_demand',
          status: 'complete',
          partner_id: null,
          partner_name: null,
          triggered_at: agg.header.generated_at,
          completed_at: agg.header.generated_at,
          run_origin: 'ad_hoc',
          detail_href: `/account/sonar/phantom-demand/reports/${window_id}`,
        },
      ];
    } catch (err) {
      console.error('[dashboard/activity] pdP failed:', err);
      return [];
    }
  })();

  const [auditEvents, type2Events, pdEvents] = await Promise.all([auditP, type2P, pdP]);

  const all = [...auditEvents, ...type2Events, ...pdEvents].sort((a, b) =>
    a.triggered_at < b.triggered_at ? 1 : a.triggered_at > b.triggered_at ? -1 : 0,
  );

  return NextResponse.json({
    events: all.slice(0, MAX_EVENTS),
    generated_at: new Date().toISOString(),
  });
});
