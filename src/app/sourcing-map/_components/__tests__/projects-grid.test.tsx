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
});
