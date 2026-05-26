import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import type { AuditRun, RunTemplate, RunTemplateScope } from '@haiwave/protocol';
import { AuditWizard, type SourceRunSummary } from './_components/audit-wizard';

interface RunPayload {
  run: AuditRun;
  dispatched_responses: unknown[];
}

interface TemplatePayload {
  template: RunTemplate;
}

/**
 * Reconstruct an audit RunTemplateScope from a run's pinned scope_snapshot.
 *
 * Used for ad-hoc (template_id null) re-runs, where there is no source
 * definition to fork from. The snapshot pins enough to reproduce the run's
 * scope: a provenance_key_id (→ key_scoped basis) or resolved vendor/product
 * pairs (→ bilateral basis). depth_limit comes off the run envelope directly;
 * signal_types and hop_budget aren't pinned in the snapshot so we fall back to
 * sensible defaults (empty / system-managed).
 */
function scopeFromRun(run: AuditRun): RunTemplateScope {
  const snapshot = run.scope_snapshot;
  const depthLimit = run.depth_limit;

  if (snapshot.provenance_key_id) {
    return {
      kind: 'audit',
      authorization_basis: 'key_scoped',
      provenance_key_id: snapshot.provenance_key_id,
      depth_limit: depthLimit,
    };
  }

  const counterparties = Array.from(
    new Set(snapshot.resolved_products.map((p) => p.vendor_id)),
  );
  const skus = Array.from(
    new Set(snapshot.resolved_products.map((p) => p.product_id)),
  );

  return {
    kind: 'audit',
    authorization_basis: 'bilateral',
    counterparties,
    signal_types: [],
    skus,
    depth_limit: depthLimit,
  };
}

async function resolveSource(
  fromRun: string | undefined,
): Promise<SourceRunSummary | null> {
  if (!fromRun) return null;

  // Load the source run.
  const runResult = await fetchBffJson<RunPayload>(
    `/api/account/sonar/audit/runs/${fromRun}`,
  );
  if (runResult.kind === 'error') return null;

  const run = runResult.data.run;
  const templateId = run.template_id;

  // No linked template (every ad-hoc run): there is no definition to fork
  // from, so reconstruct the source from the run's own pinned scope so that
  // "Run again" reproduces the original scope instead of opening a blank
  // wizard. Re-run mode (not fork): template_id stays null, name is prefilled
  // from a sensible default.
  if (!templateId) {
    const enriched = run as AuditRun & { template_name?: string | null };
    return {
      run_id: run.run_id,
      template_id: null,
      template_name:
        enriched.template_name ?? `Audit ${run.run_id.slice(0, 8)}`,
      scope: scopeFromRun(run),
      cadence: { kind: 'manual_only' },
      enabled: true,
      retention_days: 365,
    };
  }

  // Load the template via the shared templates GET endpoint (definitions/[id]
  // does not expose a GET handler; /api/account/sonar/templates/[id] does).
  const tmplResult = await fetchBffJson<TemplatePayload>(
    `/api/account/sonar/templates/${templateId}`,
  );
  if (tmplResult.kind === 'error') return null;

  const template = tmplResult.data.template;

  // Only audit templates are handled by this wizard.
  if (template.observation_class !== 'audit') return null;

  return {
    run_id: run.run_id,
    template_id: templateId,
    template_name: template.template_name,
    scope: template.scope,
    cadence: template.cadence,
    enabled: template.enabled,
    retention_days: template.retention_days,
  };
}

export default async function NewAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const fromRun =
    typeof params.from_run === 'string' ? params.from_run : undefined;

  const source = await resolveSource(fromRun);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        eyebrow="Audit"
        title="New Audit"
        description={
          source
            ? source.template_id
              ? `Starting from run ${source.run_id.slice(0, 8)}…${source.template_name ? ` (${source.template_name})` : ''}. Rename to fork into a new configuration.`
              : `Re-running ad-hoc run ${source.run_id.slice(0, 8)}… — its scope has been pre-filled below. Adjust anything and run again.`
            : 'Configure a new audit. Choose a name and cadence — audit scope (vendors and SKUs) is managed from Requests.'
        }
      />

      <AuditWizard source={source} />
    </div>
  );
}
