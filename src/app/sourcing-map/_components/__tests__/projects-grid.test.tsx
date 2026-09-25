import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroProject, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { ProjectsGrid } from '../projects-grid';

const { push, refresh, replace } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map',
  useSearchParams: () => new URLSearchParams(),
}));
// next/link renders an <a> in tests (the house idiom, src/components/__tests__/account-nav.test.tsx:16-20)
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

describe('ProjectsGrid', () => {
  it('shows each project card with its run count, last activity and a drill-down, plus "+ New project"', () => {
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    const card = screen.getByRole('listitem', { name: 'Spring 2027' });
    expect(within(card).getByText('1 run · 3 products')).toBeInTheDocument();
    expect(within(card).getByText(/Last activity Sep 23, 2026/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Open Spring 2027' })).toHaveAttribute('href', `/sourcing-map/${VOMERO_IDS.project}`);
    expect(screen.getByRole('button', { name: '+ New project' })).toBeInTheDocument();
  });

  it('creates a project and opens it', async () => {
    fetchMock.mockResolvedValue(reply(201, { ...vomeroProject, project_id: VOMERO_IDS.project, name: 'Fall 2027' }));
    render(<ProjectsGrid initialProjects={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New project' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Fall 2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/sourcing-map/${VOMERO_IDS.project}`));
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/account/sourcing-map/projects');
    expect(JSON.parse(init.body)).toEqual({ name: 'Fall 2027', description: null });
  });


  it('renames a project in place', async () => {
    fetchMock.mockResolvedValue(reply(200, { ...vomeroProject, name: 'Spring 2027 (v2)' }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename Spring 2027' }));
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'Spring 2027 (v2)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    await waitFor(() => expect(screen.getByRole('listitem', { name: 'Spring 2027 (v2)' })).toBeInTheDocument());
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe(`/api/account/sourcing-map/projects/${VOMERO_IDS.project}`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ name: 'Spring 2027 (v2)' });
  });


  it('archives a project, which then hides until "Show archived" reloads with include_archived (a-G7)', async () => {
    const archived = { ...vomeroProject, archived_at: '2026-09-23T12:00:00.000Z' };
    fetchMock
      .mockResolvedValueOnce(reply(200, archived))
      .mockResolvedValueOnce(reply(200, { projects: [archived] }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive Spring 2027' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Spring 2027' })).toBeNull());
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ archived: true });
    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(await screen.findByRole('listitem', { name: 'Spring 2027' })).toHaveTextContent('Archived Sep 23, 2026');
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/account/sourcing-map/projects?include_archived=true');
  });

  it('deletes a project with the chosen disposition; a 409 names the execution in progress (AC 3)', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(409, { error: { code: 'execution_in_progress', message: 'Line A base has an execution running.' } }))
      .mockResolvedValueOnce(reply(204));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Spring 2027' }));
    fireEvent.click(screen.getByRole('radio', { name: /Keep them/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Line A base has an execution running.');
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/account/sourcing-map/projects/${VOMERO_IDS.project}?disposition=keep`);
    expect(fetchMock.mock.calls[0]![1].method).toBe('DELETE');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Spring 2027' })).toBeNull());
  });

  it('resets the disposition choice to archive for each new delete target (no carryover between projects)', () => {
    const other = { ...vomeroProject, project_id: VOMERO_IDS.pegasus, name: 'Other Project' };
    render(<ProjectsGrid initialProjects={[vomeroProject, other]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Spring 2027' }));
    fireEvent.click(screen.getByRole('radio', { name: /Delete them/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Other Project' }));
    expect(screen.getByRole('radio', { name: /Archive them/ })).toBeChecked();
  });

  it('does not leak a stale error between dialogs (a failed create does not show in a later rename)', async () => {
    fetchMock.mockResolvedValueOnce(reply(400, { error: { message: 'Name already used.' } }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New project' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Spring 2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name already used.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename Spring 2027' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the "Show archived" reload failure as a page-level alert (a-G4: the UI shows error.message)', async () => {
    fetchMock.mockResolvedValueOnce(reply(500, { error: { message: 'Could not load archived projects.' } }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load archived projects.');
  });

  it('shows an Archive failure as a page-level alert (a-G4: the UI shows error.message)', async () => {
    fetchMock.mockResolvedValueOnce(reply(500, { error: { message: 'Could not archive the project.' } }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive Spring 2027' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not archive the project.');
  });

  it('keeps Create project focusable while its request is in flight: aria-busy, and a second press sends nothing (LW-a)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    render(<ProjectsGrid initialProjects={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New project' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Fall 2027' } });
    const create = screen.getByRole('button', { name: 'Create project' });
    create.focus();
    fireEvent.click(create);
    expect(create).toHaveAttribute('aria-busy', 'true');
    expect(create).toHaveAttribute('aria-disabled', 'true');
    expect(create).not.toBeDisabled();
    expect(create).toHaveFocus();
    fireEvent.click(create);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    settle(reply(201, { ...vomeroProject, name: 'Fall 2027' }));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });

  it('keeps Save name focusable while its request is in flight: aria-busy, and a second press sends nothing (LW-a)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename Spring 2027' }));
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'Spring 2027 (v2)' } });
    const save = screen.getByRole('button', { name: 'Save name' });
    save.focus();
    fireEvent.click(save);
    expect(save).toHaveAttribute('aria-busy', 'true');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).not.toBeDisabled();
    expect(save).toHaveFocus();
    fireEvent.click(save);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    settle(reply(200, { ...vomeroProject, name: 'Spring 2027 (v2)' }));
    await waitFor(() => expect(screen.getByRole('listitem', { name: 'Spring 2027 (v2)' })).toBeInTheDocument());
  });

  it("keeps the pressed Archive focusable while its request is in flight: aria-busy, a second press sends nothing, and the other cards' Archive waits (LW-a)", async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const other = { ...vomeroProject, project_id: VOMERO_IDS.pegasus, name: 'Other Project' };
    render(<ProjectsGrid initialProjects={[vomeroProject, other]} />);
    const archive = screen.getByRole('button', { name: 'Archive Spring 2027' });
    archive.focus();
    fireEvent.click(archive);
    expect(archive).toHaveAttribute('aria-busy', 'true');
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    expect(archive).not.toBeDisabled();
    expect(archive).toHaveFocus();
    fireEvent.click(archive);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Archive Other Project' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive Other Project' })).not.toHaveAttribute('aria-busy');
    settle(reply(200, { ...vomeroProject, archived_at: '2026-09-23T12:00:00.000Z' }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Spring 2027' })).toBeNull());
  });

  it('after a successful archive, whose card left the list with its Archive, focus goes to "+ New project", never <body> (F-c)', async () => {
    fetchMock.mockResolvedValue(reply(200, { ...vomeroProject, archived_at: '2026-09-23T12:00:00.000Z' }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    const archive = screen.getByRole('button', { name: 'Archive Spring 2027' });
    archive.focus();
    fireEvent.click(archive);
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Spring 2027' })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+ New project' }));
  });

  it('with "Show archived" on, an archived card stays but shows no Archive, so focus goes to "+ New project" there too (F-c)', async () => {
    const archived = { ...vomeroProject, archived_at: '2026-09-23T12:00:00.000Z' };
    const older = { ...vomeroProject, project_id: VOMERO_IDS.pegasus, name: 'Fall 2026', archived_at: '2026-06-01T00:00:00.000Z' };
    fetchMock
      .mockResolvedValueOnce(reply(200, { projects: [vomeroProject, older] }))
      .mockResolvedValueOnce(reply(200, archived));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByLabelText('Show archived'));
    expect(await screen.findByRole('listitem', { name: 'Fall 2026' })).toBeInTheDocument();
    const archive = screen.getByRole('button', { name: 'Archive Spring 2027' });
    archive.focus();
    fireEvent.click(archive);
    await waitFor(() => expect(archive).not.toBeInTheDocument());
    expect(screen.getByRole('listitem', { name: 'Spring 2027' })).toHaveTextContent('Archived Sep 23, 2026');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+ New project' }));
  });

  it('after a successful delete, whose card took its Delete button, focus goes to "+ New project", never <body> (L141)', async () => {
    fetchMock.mockResolvedValue(reply(204));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    const opener = screen.getByRole('button', { name: 'Delete Spring 2027' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('listitem', { name: 'Spring 2027' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '+ New project' }));
  });

  it('a pending delete cannot be dismissed: Escape, the backdrop and Cancel wait, and its 409 then shows (A5-M1, a-G4)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Spring 2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Spring 2027' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Delete Spring 2027' })).toBeInTheDocument();
    fireEvent.click(dialog.previousElementSibling as HTMLElement);
    expect(screen.getByRole('dialog', { name: 'Delete Spring 2027' })).toBeInTheDocument();
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    expect(screen.getByRole('dialog', { name: 'Delete Spring 2027' })).toBeInTheDocument();
    settle(reply(409, { error: { code: 'execution_in_progress', message: 'Line A base has an execution running.' } }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Line A base has an execution running.');
    expect(cancel).toBeEnabled();
  });

  it('a pending create cannot be dismissed: Escape, the backdrop and Cancel wait, and its refusal then shows (A5-m9, a-G4)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    render(<ProjectsGrid initialProjects={[]} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New project' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Fall 2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    const dialog = screen.getByRole('dialog', { name: 'New project' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
    fireEvent.click(dialog.previousElementSibling as HTMLElement);
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument();
    settle(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'Name already used.' } }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Name already used.');
    expect(cancel).toBeEnabled();
  });

  it('a pending rename cannot be dismissed: Escape, the backdrop and Cancel wait, and its refusal then shows (A5-m9, a-G4)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    render(<ProjectsGrid initialProjects={[vomeroProject]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename Spring 2027' }));
    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'Spring 2027 (v2)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename project' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Rename project' })).toBeInTheDocument();
    fireEvent.click(dialog.previousElementSibling as HTMLElement);
    expect(screen.getByRole('dialog', { name: 'Rename project' })).toBeInTheDocument();
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    expect(screen.getByRole('dialog', { name: 'Rename project' })).toBeInTheDocument();
    settle(reply(400, { error: { code: 'VALIDATION_ERROR', message: 'Name already used.' } }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Name already used.');
    expect(cancel).toBeEnabled();
  });
});

