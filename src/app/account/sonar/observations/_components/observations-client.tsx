'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ObservationClass } from '@haiwave/protocol';
import { HelperBanner } from './helper-banner';

const TABS: { id: ObservationClass; label: string }[] = [
  { id: 'audit', label: 'Audit' },
  { id: 'watcher', label: 'Watcher' },
  { id: 'phantom_demand', label: 'Phantom Demand' },
];

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
  initialTab: ObservationClass;
  initialRuns: unknown[];
  initialTemplates: unknown[];
}

const STICKY_TAB_KEY = 'haiwave.observations.lastTab';

const ADD_HREF: Record<ObservationClass, string> = {
  audit: '/account/sonar/requests/new-nomination',
  watcher: '/account/sonar/templates/new?observation_class=watcher',
  phantom_demand: '/account/sonar/templates/new?observation_class=phantom_demand',
};

const EMPTY_CTA: Record<ObservationClass, { title: string; body: string }> = {
  audit: {
    title: 'Create your first audit nomination',
    body: 'Nominate a counterparty to verify origin or certifications.',
  },
  watcher: {
    title: 'Create your first Watch',
    body: 'Track signals from your trading partners on a cadence.',
  },
  phantom_demand: {
    title: 'Create your first Phantom Demand probe',
    body: 'Ask a trading partner about hypothetical delivery without committing.',
  },
};

function isObservationClass(value: string): value is ObservationClass {
  return value === 'audit' || value === 'watcher' || value === 'phantom_demand';
}

export function ObservationsClient({ initialTab, initialRuns, initialTemplates }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sticky-tab read (spec §8.3): on first mount, if the URL has no ?tab= and
  // localStorage holds a last-used tab that differs from the server's default,
  // replace the URL so the server re-fetches that modality. Querystring
  // always wins over localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlTab = searchParams.get('tab');
    if (urlTab) return;
    const stored = window.localStorage.getItem(STICKY_TAB_KEY);
    if (!stored || !isObservationClass(stored)) return;
    if (stored === initialTab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', stored);
    router.replace(`${pathname}?${params.toString()}`);
    // Intentionally run only on mount; subsequent tab changes are user-driven
    // via changeTab which writes the new tab to localStorage below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STICKY_TAB_KEY, initialTab);
    }
  }, [initialTab]);

  const runs = initialRuns as Run[];
  const templates = initialTemplates as Template[];

  function changeTab(next: ObservationClass) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    params.delete('status');
    params.delete('date_range');
    params.delete('search');
    params.delete('counterparty');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Observation modalities" className="flex border-b border-slate-200">
        {TABS.map((t) => {
          const selected = t.id === initialTab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => changeTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                selected ? 'border-teal text-teal' : 'border-transparent text-slate hover:text-charcoal'
              }`}
            >
              {t.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <Link
          href={ADD_HREF[initialTab]}
          className="ml-auto rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90 self-center"
        >
          Add
        </Link>
      </div>

      <HelperBanner modality={initialTab} />

      {runs.length === 0 && templates.length === 0 ? (
        <div className="border border-dashed rounded p-8 text-center">
          <h2 className="text-base font-semibold text-charcoal">{EMPTY_CTA[initialTab].title}</h2>
          <p className="text-sm text-slate mt-1">{EMPTY_CTA[initialTab].body}</p>
          <Link
            href={ADD_HREF[initialTab]}
            className="inline-block mt-3 rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
          >
            Get started
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {templates.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Configurations</h2>
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
              <h2 className="text-sm font-semibold text-charcoal uppercase tracking-wider">Recent Runs</h2>
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
