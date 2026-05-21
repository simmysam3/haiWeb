import { NextResponse } from 'next/server';
import type { AuditRun, RunTemplate, WatcherRun } from '@haiwave/protocol';
import type { PhantomDemandRun } from '@/lib/haiwave-api';
import { withHaiCore } from '@/lib/with-hai-core';

type Modality = 'audit' | 'watcher' | 'phantom_demand';

interface ActivityEvent {
  run_id: string;
  modality: Modality;
  status: string;
  // Human label assembled at the BFF: template_name when the run was
  // template-driven, else 'Ad hoc <Modality>'. The dashboard can render
  // this directly without another lookup.
  title: string;
  // One-line scope summary (e.g. "5 products · 2 vendors · depth 2"),
  // modality-specific. Empty string when no useful detail can be derived.
  summary: string;
  // Optional outcome chip text (e.g. "3 gaps", "12 hops"). null when not
  // yet completed or not applicable.
  outcome: string | null;
  triggered_at: string;
  completed_at: string | null;
  // Wall-clock duration in seconds; null if still running.
  duration_seconds: number | null;
  run_origin: string;
  detail_href: string;
}

const MAX_EVENTS = 30;
const MODALITY_LIMIT = 20;

const MODALITY_LABEL: Record<Modality, string> = {
  audit: 'Audit',
  watcher: 'Watcher',
  phantom_demand: 'Phantom Demand',
};

function durationSeconds(triggeredAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const start = new Date(triggeredAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / 1000));
}

function titleFor(modality: Modality, templateName: string | null): string {
  if (templateName) return templateName;
  return `Ad hoc ${MODALITY_LABEL[modality]}`;
}

function joinSummary(parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => !!p && p.length > 0).join(' · ');
}

function summarizeAudit(r: AuditRun): string {
  const products = r.scope_snapshot?.resolved_products ?? [];
  const vendorIds = new Set(products.map((p) => p.vendor_id));
  const productLabel = products.length === 1 ? '1 product' : `${products.length} products`;
  const vendorLabel = vendorIds.size === 1 ? '1 vendor' : `${vendorIds.size} vendors`;
  return joinSummary([
    products.length > 0 ? productLabel : null,
    vendorIds.size > 0 ? vendorLabel : null,
    `depth ${r.depth_limit}`,
  ]);
}

function summarizeWatcher(r: WatcherRun): string {
  const signals = r.signal_types ?? [];
  const cps = r.counterparty_filter;
  const signalLabel = signals.length > 0 ? signals.map(prettySignal).join(', ') : null;
  const cpLabel = cps === null ? 'all counterparties' : cps.length === 1 ? '1 counterparty' : `${cps.length} counterparties`;
  return joinSummary([signalLabel, cpLabel, `depth ${r.depth_limit}`]);
}

function prettySignal(s: string): string {
  return s.replace(/_/g, ' ');
}

interface PhantomDemandScope {
  counterparty?: string;
  skus?: string[];
  hypothetical_quantity?: number;
}

function summarizePhantomDemand(r: PhantomDemandRun): string {
  const scope = (r.scope_snapshot ?? {}) as PhantomDemandScope;
  const skuCount = scope.skus?.length ?? 0;
  const skuLabel = skuCount === 1 ? '1 SKU' : skuCount > 0 ? `${skuCount} SKUs` : null;
  const qtyLabel =
    typeof scope.hypothetical_quantity === 'number'
      ? `qty ${scope.hypothetical_quantity.toLocaleString()}`
      : null;
  return joinSummary([skuLabel, qtyLabel]);
}

export const GET = withHaiCore(async ({ client }) => {
  const auditP = client
    .listAuditRuns({ limit: MODALITY_LIMIT })
    .then((r: { runs: AuditRun[] }) => r.runs)
    .catch((err) => {
      console.error('[dashboard/activity] auditP failed:', err);
      return [] as AuditRun[];
    });

  const watcherP = client
    .listWatcherRuns()
    .then((r: { runs: WatcherRun[] }) => r.runs.slice(0, MODALITY_LIMIT))
    .catch((err) => {
      console.error('[dashboard/activity] watcherP failed:', err);
      return [] as WatcherRun[];
    });

  // v1.30 §7.7 — PD activity now sourced from phantom_demand_runs (not v1.21 windows/reports).
  const pdP = client
    .listPhantomDemandRuns({ limit: MODALITY_LIMIT })
    .catch((err) => {
      console.error('[dashboard/activity] pdP failed:', err);
      return [] as PhantomDemandRun[];
    });

  const templatesP = client
    .listRunTemplates()
    .then((r: { templates: RunTemplate[] }) =>
      new Map(r.templates.map((t) => [t.template_id, t.template_name])),
    )
    .catch((err) => {
      console.error('[dashboard/activity] templatesP failed:', err);
      return new Map<string, string>();
    });

  const [audits, watchers, pds, templateNames] = await Promise.all([auditP, watcherP, pdP, templatesP]);

  const auditEvents: ActivityEvent[] = audits.map((r) => {
    const templateId = (r as { template_id?: string | null }).template_id ?? null;
    const templateName = templateId ? templateNames.get(templateId) ?? null : null;
    const completedAt = (r as { completed_at?: string | null }).completed_at ?? null;
    const gapCount = (r as { gap_count?: number | null }).gap_count;
    return {
      run_id: r.run_id,
      modality: 'audit',
      status: r.status,
      title: titleFor('audit', templateName),
      summary: summarizeAudit(r),
      outcome:
        typeof gapCount === 'number'
          ? gapCount === 1
            ? '1 gap'
            : `${gapCount} gaps`
          : null,
      triggered_at: r.triggered_at,
      completed_at: completedAt,
      duration_seconds: durationSeconds(r.triggered_at, completedAt),
      run_origin: (r as { run_origin?: string }).run_origin ?? 'ad_hoc',
      detail_href: `/account/sonar/posture/runs/${r.run_id}`,
    };
  });

  const watcherEvents: ActivityEvent[] = watchers.map((r) => {
    const templateId = (r as { template_id?: string | null }).template_id ?? null;
    const templateName = templateId ? templateNames.get(templateId) ?? null : null;
    const completedAt = (r as { completed_at?: string | null }).completed_at ?? null;
    return {
      run_id: r.run_id,
      modality: 'watcher',
      status: r.status,
      title: titleFor('watcher', templateName),
      summary: summarizeWatcher(r),
      outcome: null,
      triggered_at: r.triggered_at,
      completed_at: completedAt,
      duration_seconds: durationSeconds(r.triggered_at, completedAt),
      run_origin: (r as { run_origin?: string }).run_origin ?? 'ad_hoc',
      detail_href: `/account/sonar/watcher/dashboard`,
    };
  });

  const pdEvents: ActivityEvent[] = pds.map((r) => {
    const templateName = r.template_id ? templateNames.get(r.template_id) ?? null : null;
    return {
      run_id: r.run_id,
      modality: 'phantom_demand',
      status: r.status,
      title: titleFor('phantom_demand', templateName),
      summary: summarizePhantomDemand(r),
      outcome:
        typeof r.hops_consumed === 'number'
          ? r.hops_consumed === 1
            ? '1 hop'
            : `${r.hops_consumed} hops`
          : null,
      triggered_at: r.created_at,
      completed_at: r.completed_at ?? null,
      duration_seconds: durationSeconds(r.created_at, r.completed_at),
      run_origin: r.run_origin ?? 'ad_hoc',
      detail_href: `/account/sonar/phantom-demand/runs/${r.run_id}`,
    };
  });

  const all = [...auditEvents, ...watcherEvents, ...pdEvents].sort((a, b) =>
    a.triggered_at < b.triggered_at ? 1 : a.triggered_at > b.triggered_at ? -1 : 0,
  );

  return NextResponse.json({
    events: all.slice(0, MAX_EVENTS),
    generated_at: new Date().toISOString(),
  });
});
