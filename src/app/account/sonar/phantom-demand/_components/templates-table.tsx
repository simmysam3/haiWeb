'use client';
import Link from 'next/link';
import type { RunTemplate } from '@haiwave/protocol';
import { DetailChevron } from '@/components/sonar/observations';

interface TemplatesTableProps {
  templates: RunTemplate[];
}

export function TemplatesTable({ templates }: TemplatesTableProps) {
  if (templates.length === 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">No phantom demand configurations yet.</p>
      </div>
    );
  }

  return (
    <table className="w-full rounded border border-slate-200 bg-white">
      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
        <tr>
          <th className="px-4 py-2">Name</th>
          <th className="px-4 py-2">SKU</th>
          <th className="px-4 py-2">Default qty</th>
          <th className="px-4 py-2">Default target date</th>
          <th className="px-4 py-2">Weeks to hold</th>
          <th className="px-4 py-2">Last run</th>
          <th className="px-4 py-2">Verdict</th>
          <th className="w-12 px-4 py-2"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-sm">
        {templates.map((tpl) => {
          const scope = tpl.scope as Record<string, unknown>;
          return (
            <tr key={tpl.template_id} className="group hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link
                  href={`/account/sonar/phantom-demand/templates/${tpl.template_id}`}
                  className="font-medium text-slate-900 hover:text-teal-600"
                >
                  {tpl.template_name}
                </Link>
              </td>
              <td className="px-4 py-2 font-mono">{String(scope?.sku ?? '—')}</td>
              <td className="px-4 py-2">{String(scope?.default_qty ?? '—')}</td>
              <td className="px-4 py-2">{String(scope?.default_target_date ?? '—')}</td>
              <td className="px-4 py-2">{String(scope?.weeks_to_hold ?? '—')}</td>
              <td className="px-4 py-2 text-slate-500">—</td>
              <td className="px-4 py-2 text-slate-500">—</td>
              <td className="px-4 py-2">
                <Link
                  href={`/account/sonar/phantom-demand/templates/${tpl.template_id}`}
                  className="group"
                  aria-label="Open template"
                >
                  <DetailChevron />
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
