import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { RunTemplate } from '@haiwave/protocol';
import { TemplateForm } from '../_components/template-form';
import { ManualTriggerButton } from './_components/manual-trigger-button';
import { TemplateRunHistory } from './_components/template-run-history';
import { formatCadence } from '../_lib/format-cadence';

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

async function loadTemplate(templateId: string): Promise<RunTemplate | null> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(
      `${proto}://${host}/api/account/sonar/templates/${templateId}`,
      { headers: { cookie: cookieHeader }, cache: 'no-store' },
    );
    if (res.status === 404) return null; // genuinely not found → notFound()
    if (!res.ok) {
      // Auth / 5xx / contract failure — a real error, not "not found".
      throw new Error(`template detail fetch failed: ${res.status}`);
    }
    const payload = (await res.json()) as { template: RunTemplate };
    return payload.template;
  } catch (err) {
    console.error('[template detail] fetch failed', { templateId, err });
    throw err;
  }
}

export default async function TemplateDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) notFound();
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href="/account/sonar/templates"
            className="text-sm text-teal hover:underline"
          >
            ← Configurations
          </Link>
          <h1 className="text-xl font-semibold text-charcoal mt-2">
            {template.template_name}
          </h1>
          <p className="text-sm text-slate mt-1">
            {template.observation_class === 'audit' ? 'Audit' : 'Watcher'} ·{' '}
            {formatCadence(template.cadence)} · Last run{' '}
            {template.last_run_at
              ? new Date(template.last_run_at).toLocaleString()
              : '—'}
          </p>
        </div>
        <ManualTriggerButton
          templateId={template.template_id}
          enabled={template.enabled}
          observationClass={template.observation_class}
        />
      </header>

      <div className="bg-white rounded-xl border border-slate/15 p-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-charcoal mb-4">Edit configuration</h2>
        <TemplateForm initial={template} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-charcoal">Run history</h2>
        <TemplateRunHistory
          templateId={template.template_id}
          observationClass={template.observation_class}
        />
      </section>
    </div>
  );
}
