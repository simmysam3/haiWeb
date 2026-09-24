'use client';
import Link from 'next/link';
import type { SmProject } from '@/lib/sourcing-map/contract';
import { smProjectHref } from '@/lib/sourcing-map/routes';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Projects page body (spec §7.1): cards with run count and last activity, plus "+ New project" (AC 3). Cycle 21.4 adds the lifecycle. */
export function ProjectsGrid({ initialProjects }: { initialProjects: SmProject[] }) {
  return (
    <section className="p-8">
      <h1 className="sm-heading text-2xl font-bold">Projects</h1>
      <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {initialProjects.map((p) => (
          <li key={p.project_id} aria-label={p.name} className="sm-card p-5">
            <Link href={smProjectHref(p.project_id)} aria-label={`Open ${p.name}`} className="group flex items-center justify-between gap-3">
              <span className="sm-heading text-lg font-semibold">{p.name}</span>
              <DetailChevron />
            </Link>
            <p className="sm-muted mt-2 text-sm">{`${plural(p.run_count, 'run')} · ${plural(p.product_count, 'product')}`}</p>
            <p className="sm-muted mt-1 text-xs">Last activity {DATE.format(new Date(p.last_activity_at))}</p>
          </li>
        ))}
        <li>
          <button type="button" className="sm-card flex h-full w-full items-center justify-center p-5 text-sm">+ New project</button>
        </li>
      </ul>
    </section>
  );
}
