import { fetchBffJson } from '@/lib/server-fetch';
import type { AuditRun, RunTemplate } from '@haiwave/protocol';
import { AuditWizard, type SourceRunSummary } from './_components/audit-wizard';

interface RunPayload {
  run: AuditRun;
  dispatched_responses: unknown[];
}

interface TemplatePayload {
  template: RunTemplate;
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

  // If no linked template, we can't build a SourceRunSummary.
  if (!templateId) return null;

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
      <header>
        <h1 className="text-xl font-semibold text-charcoal">New Audit</h1>
        <p className="text-sm text-slate mt-1">
          {source
            ? `Starting from run ${source.run_id.slice(0, 8)}…${source.template_name ? ` (${source.template_name})` : ''}. Rename to fork into a new configuration.`
            : 'Configure a new audit. Choose a name and cadence — audit scope (vendors and SKUs) is managed from Requests.'}
        </p>
      </header>

      <AuditWizard source={source} />
    </div>
  );
}
