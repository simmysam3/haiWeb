import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { RunTemplate } from '@haiwave/protocol';
import { TemplateEditor } from '../_components/template-editor';
import { ManualTriggerButton } from './_components/manual-trigger-button';
import { TemplateRunHistory } from './_components/template-run-history';
import { configNoun } from '../_lib/config-noun';
import { formatCadence } from '../_lib/format-cadence';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

async function loadTemplate(templateId: string): Promise<RunTemplate | null> {
  // D-62: origin from the configured PORTAL_BASE_URL, never the request's
  // Host header; `fetchBffJson` forwards the cookie and never throws. A 404
  // is "no such template"; any other failure is surfaced to the error
  // boundary exactly as before.
  const result = await fetchBffJson<{ template: RunTemplate }>(
    `/api/account/sonar/templates/${templateId}`,
  );
  if (result.kind === 'error') {
    if (result.status === 404) return null;
    const err = new Error(`template detail fetch failed: ${result.status}`);
    console.error('[template detail] fetch failed', err);
    throw err;
  }
  return result.data.template;
}

export default async function TemplateDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) notFound();
  if (template.observation_class === 'watcher') {
    redirect(`/account/sonar/watchers/definitions/${template.template_id}`);
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={configNoun(template.observation_class)}
        title={template.template_name}
        description={
          <>
            {/* PD is manual-only — omit cadence (matches the create wizard). */}
            {template.observation_class !== 'phantom_demand' && (
              <>{formatCadence(template.cadence)} · </>
            )}
            Last run{' '}
            {template.last_run_at
              ? new Date(template.last_run_at).toLocaleString()
              : '—'}
          </>
        }
        actions={
          <ManualTriggerButton
            templateId={template.template_id}
            enabled={template.enabled}
            observationClass={template.observation_class}
          />
        }
      />

      <div className="space-y-2">
        <Link
          href="/account/sonar/templates"
          className="text-sm text-teal hover:underline"
        >
          ← Configurations
        </Link>
        <TemplateEditor template={template} />
      </div>

      <section id="step-history" className="space-y-3 scroll-mt-6">
        <h2 className="text-sm font-semibold text-charcoal">Run history</h2>
        <TemplateRunHistory
          templateId={template.template_id}
          observationClass={template.observation_class}
        />
      </section>
    </div>
  );
}
