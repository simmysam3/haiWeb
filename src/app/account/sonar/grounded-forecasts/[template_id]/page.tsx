import { notFound } from 'next/navigation';
import type { RunTemplate } from '@haiwave/protocol';
import { getServerHaiwaveClient } from '@/lib/server-haiwave-client';
import { PageHeader } from '@/components';
import {
  ForecastResultShell,
  type ForecastResultEnvelope,
} from './_components/forecast-result-shell';

// v1.62 — the forecast result page. A grounded forecast keeps only its latest
// result, keyed by template, so this page IS the run surface: the server shell
// fetches the template and whatever stored result exists, and the client shell
// polls any in-flight run to completion (PD run-detail precedent).
export default async function Page({
  params,
}: {
  params: Promise<{ template_id: string }>;
}) {
  const { template_id } = await params;
  const client = await getServerHaiwaveClient();

  let template: RunTemplate;
  try {
    ({ template } = await client.getRunTemplate(template_id));
  } catch (err) {
    if ((err as { status?: number }).status === 404) notFound();
    console.error('[grounded-forecast] template fetch failed', { template_id, err });
    throw err;
  }
  // A template of another observation class has no forecast surface — absent,
  // not half-rendered.
  if (template.observation_class !== 'grounded_forecast') notFound();

  let initialResult: ForecastResultEnvelope | null = null;
  try {
    initialResult = await client.getGroundedForecastResult(template_id);
  } catch (err) {
    // 404 = no completed run yet — the shell renders the empty/running state.
    if ((err as { status?: number }).status !== 404) {
      console.error('[grounded-forecast] result fetch failed', { template_id, err });
      throw err;
    }
  }

  const { profile } = template.scope;
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Grounded Forecasts"
        title={template.template_name}
        description={`${template.scope.product_name} · ${profile.monthly_qty.toLocaleString('en-US')}/mo · ${profile.start_month} → ${profile.end_month}`}
      />
      <ForecastResultShell
        templateId={template_id}
        lastRunId={template.last_run_id}
        initialResult={initialResult}
      />
    </div>
  );
}
