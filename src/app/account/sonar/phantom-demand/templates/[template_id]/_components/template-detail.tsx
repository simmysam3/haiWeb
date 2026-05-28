'use client';
import Link from 'next/link';
import type { RunTemplate } from '@haiwave/protocol';

interface TemplateDetailProps {
  template: RunTemplate;
}

export function TemplateDetail({ template }: TemplateDetailProps) {
  const scope = template.scope as Record<string, unknown>;
  return (
    <div className="space-y-6">
      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Defaults</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">SKU</dt>
          <dd className="font-mono">{String(scope.sku)}</dd>
          <dt className="text-slate-500">Default qty</dt>
          <dd>{String(scope.default_qty)}</dd>
          <dt className="text-slate-500">Default target date</dt>
          <dd>{String(scope.default_target_date)}</dd>
          <dt className="text-slate-500">Weeks to hold</dt>
          <dd>{String(scope.weeks_to_hold)}</dd>
        </dl>
        <div className="mt-4 flex gap-3">
          <button className="rounded bg-teal-600 px-4 py-2 text-sm text-white hover:bg-teal-700">
            Run now (use defaults)
          </button>
          <Link
            href={`/account/sonar/phantom-demand/templates/${template.template_id}/edit`}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Edit defaults
          </Link>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Run history</h2>
        <p className="text-sm text-slate-500">No runs yet.</p>
        {/* Placeholder; real run history fetched separately and rendered when populated. */}
      </section>
    </div>
  );
}
