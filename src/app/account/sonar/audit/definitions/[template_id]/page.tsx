// src/app/account/sonar/audit/definitions/[template_id]/page.tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { RunTemplate } from '@haiwave/protocol';
import { fetchBffJson } from '@/lib/server-fetch';
import { formatCadence } from '../../../templates/_lib/format-cadence';
import { AuditDefinitionEditor } from './_components/audit-definition-editor';

interface DetailPageProps {
  params: Promise<{ template_id: string }>;
}

export default async function AuditDefinitionDetailPage({ params }: DetailPageProps) {
  const { template_id } = await params;
  const result = await fetchBffJson<{ template: RunTemplate }>(
    `/api/account/sonar/audit/definitions/${template_id}`,
  );

  if (result.kind === 'error') {
    notFound();
  }

  const tpl = result.data.template;

  if (tpl.observation_class !== 'audit') {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href="/account/sonar/audit"
            className="text-sm text-teal hover:underline"
          >
            ← Audits
          </Link>
          <h1 className="text-xl font-semibold text-charcoal mt-2">
            {tpl.template_name}
          </h1>
          <p className="text-sm text-slate mt-1">
            Audit · {formatCadence(tpl.cadence)} · Last run{' '}
            {tpl.last_run_at
              ? new Date(tpl.last_run_at).toLocaleString()
              : '—'}
          </p>
        </div>
      </header>

      <AuditDefinitionEditor template={tpl} />
    </div>
  );
}
