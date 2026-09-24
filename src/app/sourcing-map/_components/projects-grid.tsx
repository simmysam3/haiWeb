'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SmProject, SmProjectListResponse } from '@/lib/sourcing-map/contract';
import { smFetch } from '@/lib/sourcing-map/client';
import { smProjectHref } from '@/lib/sourcing-map/routes';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { SmDialog } from './sm-dialog';
import { DispositionDialog, type Disposition } from './disposition-dialog';

const BASE = '/api/account/sourcing-map/projects';
const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Projects page body (spec §7.1): cards with run count and last activity, plus "+ New project" (AC 3). */
export function ProjectsGrid({ initialProjects }: { initialProjects: SmProject[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [renaming, setRenaming] = useState<SmProject | null>(null);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<SmProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = projects.filter((p) => showArchived || p.archived_at === null);

  async function create() {
    setBusy(true);
    setError(null);
    const out = await smFetch<SmProject>(BASE, { method: 'POST', body: { name: name.trim(), description: description.trim() || null } });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    router.push(smProjectHref(out.data.project_id));
  }

  async function patch(p: SmProject, body: { name?: string; archived?: boolean }) {
    setBusy(true);
    setError(null);
    const out = await smFetch<SmProject>(`${BASE}/${p.project_id}`, { method: 'PATCH', body });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return false;
    }
    setProjects((all) => all.map((x) => (x.project_id === p.project_id ? out.data : x)));
    return true;
  }

  async function remove(p: SmProject, d: Disposition) {
    setBusy(true);
    setError(null);
    const out = await smFetch(`${BASE}/${p.project_id}?disposition=${d}`, { method: 'DELETE' });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setProjects((all) => all.filter((x) => x.project_id !== p.project_id));
    setDeleting(null);
  }

  // The list endpoint hides archived projects unless ?include_archived=true is passed (a-G7), so "Show archived" reloads.
  async function toggleArchived(on: boolean) {
    setShowArchived(on);
    if (!on) return;
    const out = await smFetch<SmProjectListResponse>(`${BASE}?include_archived=true`);
    if (out.ok) setProjects(out.data.projects);
    else setError(out.message);
  }

  return (
    <section className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="sm-heading text-2xl font-bold">Projects</h1>
        <label className="sm-muted flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showArchived} onChange={(e) => void toggleArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((p) => (
          <li key={p.project_id} aria-label={p.name} className="sm-card p-5">
            <Link href={smProjectHref(p.project_id)} aria-label={`Open ${p.name}`} className="group flex items-center justify-between gap-3">
              <span className="sm-heading text-lg font-semibold">{p.name}</span>
              <DetailChevron />
            </Link>
            <p className="sm-muted mt-2 text-sm">{`${plural(p.run_count, 'run')} · ${plural(p.product_count, 'product')}`}</p>
            <p className="sm-muted mt-1 text-xs">
              Last activity {DATE.format(new Date(p.last_activity_at))}
              {p.archived_at && ` · Archived ${DATE.format(new Date(p.archived_at))}`}
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Rename ${p.name}`} onClick={() => { setRenaming(p); setNewName(p.name); }}>Rename</button>
              {p.archived_at === null && (
                <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Archive ${p.name}`} disabled={busy} onClick={() => void patch(p, { archived: true })}>Archive</button>
              )}
              <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Delete ${p.name}`} onClick={() => { setError(null); setDeleting(p); }}>Delete</button>
            </div>
          </li>
        ))}
        <li>
          <button type="button" className="sm-card flex h-full w-full items-center justify-center p-5 text-sm" onClick={() => setCreating(true)}>
            + New project
          </button>
        </li>
      </ul>
      <SmDialog
        title="New project"
        open={creating}
        onClose={() => setCreating(false)}
        footer={
          <>
            <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button type="button" className="sm-btn sm-btn-primary" disabled={busy || name.trim() === ''} onClick={create}>Create project</button>
          </>
        }
      >
        <label className="block text-sm">
          Project name
          <input className="sm-input mt-1 w-full" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mt-3 block text-sm">
          Description (optional)
          <textarea className="sm-input mt-1 w-full" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
      </SmDialog>
      <SmDialog
        title="Rename project"
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        footer={
          <>
            <button type="button" className="sm-btn sm-btn-ghost" onClick={() => setRenaming(null)}>Cancel</button>
            <button
              type="button"
              className="sm-btn sm-btn-primary"
              disabled={busy || newName.trim() === ''}
              onClick={async () => {
                if (renaming && (await patch(renaming, { name: newName.trim() }))) setRenaming(null);
              }}
            >
              Save name
            </button>
          </>
        }
      >
        <label className="block text-sm">
          New name
          <input className="sm-input mt-1 w-full" value={newName} maxLength={200} onChange={(e) => setNewName(e.target.value)} />
        </label>
        {error && <p role="alert" className="sm-error mt-3 text-sm">{error}</p>}
      </SmDialog>
      {deleting && (
        <DispositionDialog
          key={deleting.project_id}
          open
          title={`Delete ${deleting.name}`}
          onCancel={() => setDeleting(null)}
          onConfirm={(d) => void remove(deleting, d)}
          busy={busy}
          error={error}
        />
      )}
    </section>
  );
}
