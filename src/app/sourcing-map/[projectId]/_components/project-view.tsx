'use client';
import { useState } from 'react';
import type { SmProduct, SmProject, SmRunListResponse } from '@/lib/sourcing-map/contract';
import { SM_HOME } from '@/lib/sourcing-map/routes';
import { SmHeader } from '../../_components/sm-header';
import { RunsTab } from './runs-tab';
import { LibraryTab } from './library-tab';

type Tab = 'runs' | 'library';

export function ProjectView({ project, runs, runsError = null, products, productsError = null }: {
  project: SmProject; runs: SmRunListResponse['runs']; runsError?: string | null;
  products: SmProduct[]; productsError?: string | null;
}) {
  const [tab, setTab] = useState<Tab>('runs');
  return (
    <>
      <SmHeader crumbs={[{ label: 'Projects', href: SM_HOME }, { label: project.name }]} />
      <section className="p-8">
        <h1 className="sm-heading text-2xl font-bold">{project.name}</h1>
        {project.description && <p className="sm-muted mt-1 text-sm">{project.description}</p>}
        <div role="tablist" aria-label="Project" className="mt-6 flex gap-2 border-b border-[var(--sm-line)]">
          {([['runs', 'Runs'], ['library', 'Product library']] as const).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={tab === key ? 'border-b-2 border-[var(--sm-teal)] px-4 py-2 text-sm font-medium' : 'sm-muted px-4 py-2 text-sm'}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="mt-6">
          {tab === 'runs' ? (
            runsError ? (
              <p role="alert" className="sm-error text-sm">{runsError}</p>
            ) : (
              <RunsTab projectId={project.project_id} initialRuns={runs} />
            )
          ) : productsError ? (
            <p role="alert" className="sm-error text-sm">{productsError}</p>
          ) : (
            <LibraryTab projectId={project.project_id} initialProducts={products} />
          )}
        </div>
      </section>
    </>
  );
}
