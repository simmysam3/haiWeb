'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SmProject, SmProjectListResponse } from '@haiwave/protocol';
import { smFetch } from '@/lib/sourcing-map/client';
import { smProjectHref } from '@/lib/sourcing-map/routes';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';
import { SmButton } from './sm-button';
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
  // The card whose Archive was pressed: that button stays focusable and busy (LW-a); the others wait, disabled.
  const [archiving, setArchiving] = useState<string | null>(null);
  // No dialog is open while the list reloads (a-G4: the UI shows error.message), so this failure
  // gets its own page-level alert rather than the dialogs' shared `error`.
  const [listError, setListError] = useState<string | null>(null);
  // A deleted project's card takes its Delete button with it; focus then goes to "+ New project" (L141).
  const newProjectRef = useRef<HTMLButtonElement | null>(null);

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

  // No dialog is open for a direct Archive click either (a-G4), so route its failure to the same
  // page-level alert as the "Show archived" reload, not the dialogs' shared `error`.
  async function archive(p: SmProject) {
    setBusy(true);
    setArchiving(p.project_id);
    setListError(null);
    const out = await smFetch<SmProject>(`${BASE}/${p.project_id}`, { method: 'PATCH', body: { archived: true } });
    setBusy(false);
    setArchiving(null);
    if (!out.ok) {
      setListError(out.message);
      return;
    }
    setProjects((all) => all.map((x) => (x.project_id === p.project_id ? out.data : x)));
    // F-c: an archived card shows no Archive, and with "Show archived" off the card leaves too, so the pressed button
    // goes; focus goes to "+ New project", as after a delete (L141), never to <body>.
    newProjectRef.current?.focus();
  }

  // The list endpoint hides archived projects unless ?include_archived=true is passed (a-G7), so "Show archived" reloads.
  async function toggleArchived(on: boolean) {
    setShowArchived(on);
    setListError(null);
    if (!on) return;
    const out = await smFetch<SmProjectListResponse>(`${BASE}?include_archived=true`);
    if (out.ok) setProjects(out.data.projects);
    else setListError(out.message);
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
      {listError && <p role="alert" className="sm-error mt-2 text-sm">{listError}</p>}
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
              <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Rename ${p.name}`} onClick={() => { setError(null); setRenaming(p); setNewName(p.name); }}>Rename</button>
              {p.archived_at === null && (
                <SmButton
                  className="sm-btn sm-btn-ghost text-xs"
                  aria-label={`Archive ${p.name}`}
                  busy={archiving === p.project_id}
                  disabled={busy && archiving !== p.project_id}
                  onClick={() => void archive(p)}
                >
                  Archive
                </SmButton>
              )}
              <button type="button" className="sm-btn sm-btn-ghost text-xs" aria-label={`Delete ${p.name}`} onClick={() => { setError(null); setDeleting(p); }}>Delete</button>
            </div>
          </li>
        ))}
        <li>
          <button ref={newProjectRef} type="button" className="sm-card flex h-full w-full items-center justify-center p-5 text-sm" onClick={() => { setError(null); setCreating(true); }}>
            + New project
          </button>
        </li>
      </ul>
      <SmDialog
        title="New project"
        open={creating}
        onClose={() => setCreating(false)}
        // A5-m9: a pending create answers in this dialog; Escape, the backdrop and Cancel wait for it.
        busy={busy}
        footer={
          <>
            <button type="button" className="sm-btn sm-btn-ghost" disabled={busy} onClick={() => setCreating(false)}>Cancel</button>
            <SmButton className="sm-btn sm-btn-primary" busy={busy} disabled={name.trim() === ''} onClick={create}>Create project</SmButton>
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
        // A5-m9: a pending rename answers in this dialog; Escape, the backdrop and Cancel wait for it.
        busy={busy}
        footer={
          <>
            <button type="button" className="sm-btn sm-btn-ghost" disabled={busy} onClick={() => setRenaming(null)}>Cancel</button>
            <SmButton
              className="sm-btn sm-btn-primary"
              busy={busy}
              disabled={newName.trim() === ''}
              onClick={async () => {
                if (renaming && (await patch(renaming, { name: newName.trim() }))) setRenaming(null);
              }}
            >
              Save name
            </SmButton>
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
          returnFocus={newProjectRef}
        />
      )}
    </section>
  );
}
