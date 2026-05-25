'use client';

import Link from 'next/link';
import type { ObservationClass } from '@haiwave/protocol';

interface Run {
  id?: string;
  run_id?: string;
  scope_summary?: string;
  status?: string;
  hops_consumed?: number;
  started_at?: string;
}

interface Template {
  template_id: string;
  template_name: string;
  observation_class: ObservationClass;
  cadence?: { kind?: string };
  enabled?: boolean;
}

interface Props {
  initialRuns: unknown[];
  initialTemplates: unknown[];
}

const ADD_HREF = '/account/sonar/templates/new?observation_class=phantom_demand';

export function ObservationsClient({ initialRuns, initialTemplates }: Props) {
  const runs = initialRuns as Run[];
  const templates = initialTemplates as Template[];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={ADD_HREF}
          className="rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
        >
          Add
        </Link>
      </div>

      {runs.length === 0 && templates.length === 0 ? (
        <div className="border border-dashed rounded p-8 text-center">
          <h2 className="text-base font-semibold text-charcoal">
            Create your first Phantom Demand probe
          </h2>
          <p className="text-sm text-slate mt-1">
            Ask a trading partner about hypothetical delivery without committing.
          </p>
          <Link
            href={ADD_HREF}
            className="inline-block mt-3 rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
          >
            Get started
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {templates.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Configurations
              </h2>
              <table className="w-full mt-2 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate">
                    <th className="py-2">Name</th>
                    <th className="py-2">Cadence</th>
                    <th className="py-2">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.template_id} className="border-b border-slate-100">
                      <td className="py-2">
                        <Link
                          href={`/account/sonar/templates/${t.template_id}`}
                          className="text-teal hover:underline"
                        >
                          {t.template_name}
                        </Link>
                      </td>
                      <td className="py-2">{t.cadence?.kind ?? 'manual'}</td>
                      <td className="py-2">{t.enabled ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {runs.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">
                Recent Runs
              </h2>
              <table className="w-full mt-2 border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate">
                    <th className="py-2">Scope</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Hops</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r, idx) => {
                    const rid = r.run_id ?? r.id ?? `row-${idx}`;
                    return (
                      <tr key={rid} className="border-b border-slate-100">
                        <td className="py-2">{r.scope_summary ?? '—'}</td>
                        <td className="py-2">{r.status ?? '—'}</td>
                        <td className="py-2">{r.hops_consumed ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
