import { NextResponse } from 'next/server';
import type { PhantomDemandRun } from '@/lib/haiwave-api';
import { withHaiCore } from '@/lib/with-hai-core';

// v.1.45 — Phantom Demand queue: one row per config (saved request) with its
// latest run summary + catalog source, powering /account/sonar/observations.
// Reads are cheap (two list calls), so the page can poll this directly.

interface QueueLastRun {
  run_id: string;
  status: string;
  // Run-level readiness roll-up (worst component). Null on non-alternates or
  // pre-Spec-3 runs. The queue surfaces this as the adopted SKU status.
  readiness_verdict: PhantomDemandRun['readiness_verdict'];
  created_at: string;
  completed_at: string | null;
}

interface QueueConfig {
  template_id: string;
  template_name: string;
  sku: string | null;
  // 'own' → Internal (the initiator's product / BOM explosion run).
  // 'counterparty' → Supplier SKU (single-item direct probe of that partner).
  source: 'own' | 'counterparty';
  counterparty_id: string | null;
  last_run: QueueLastRun | null;
}

interface PdBomScopeShape {
  sku?: unknown;
  catalog_source?: { kind?: unknown; counterparty_id?: unknown };
}

export const GET = withHaiCore(async ({ client }) => {
  const [templates, runs] = await Promise.all([
    client.listPhantomDemandTemplates({ limit: 200 }),
    client.listPhantomDemandRuns({ limit: 500 }),
  ]);

  // Runs come back newest-first; keep the first (latest) seen per template.
  const latestByTemplate = new Map<string, PhantomDemandRun>();
  for (const r of runs) {
    if (r.template_id && !latestByTemplate.has(r.template_id)) {
      latestByTemplate.set(r.template_id, r);
    }
  }

  // Defensive: the queue must only ever show phantom-demand configs. We pass
  // observation_class=phantom_demand to haiCore, but filter here too so a
  // watcher/audit template can never leak into the PD queue regardless of
  // server-side filtering.
  const pdTemplates = templates.filter(
    (t) => t.observation_class === 'phantom_demand',
  );

  const rows = pdTemplates.map((t) => {
    const scope = (t.scope ?? {}) as PdBomScopeShape;
    const isCounterparty = scope.catalog_source?.kind === 'counterparty';
    const lr = latestByTemplate.get(t.template_id);
    const config: QueueConfig = {
      template_id: t.template_id,
      template_name: t.template_name,
      sku: typeof scope.sku === 'string' ? scope.sku : null,
      source: isCounterparty ? 'counterparty' : 'own',
      counterparty_id:
        isCounterparty && typeof scope.catalog_source?.counterparty_id === 'string'
          ? scope.catalog_source.counterparty_id
          : null,
      last_run: lr
        ? {
            run_id: lr.run_id,
            status: lr.status,
            readiness_verdict: lr.readiness_verdict ?? null,
            created_at: lr.created_at,
            completed_at: lr.completed_at ?? null,
          }
        : null,
    };
    // Sort by latest run time, falling back to the config's own creation
    // time when it has never run.
    const sortTs = Date.parse(lr?.created_at ?? t.created_at) || 0;
    return { config, sortTs };
  });

  // Most-recent activity at the top, oldest at the bottom.
  rows.sort((a, b) => b.sortTs - a.sortTs);

  return NextResponse.json({ configs: rows.map((r) => r.config) });
});
