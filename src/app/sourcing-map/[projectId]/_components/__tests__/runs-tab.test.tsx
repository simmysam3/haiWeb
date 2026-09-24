import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vomeroRunList, vomeroRunTemplate, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { RunsTab } from '../runs-tab';

const { push, refresh, replace } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map/x',
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

describe('RunsTab', () => {
  it('lists each run with products, last execution, portfolio coverage and a status pill', () => {
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    const row = screen.getByRole('row', { name: /Line A base/ });
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('Sep 23, 2026')).toBeInTheDocument();
    expect(within(row).getByText('90%')).toBeInTheDocument();
    expect(within(row).getByText('Completed')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Open Line A base' })).toHaveAttribute('href', `/sourcing-map/${VOMERO_IDS.project}/runs/${VOMERO_IDS.template}`);
  });

  it('creates a new run with an empty draft scope and opens its workspace', async () => {
    fetchMock.mockResolvedValue(reply(201, { template: vomeroRunTemplate }));
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New run' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/sourcing-map/${VOMERO_IDS.project}/runs/${VOMERO_IDS.template}`));
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/account/sourcing-map/runs');
    expect(JSON.parse(init.body)).toEqual({
      template_name: 'Run 2',
      scope: { kind: 'sourcing_map', project_id: VOMERO_IDS.project, products: [], depth_cap: 5, seat_weekly_capacity: null },
    });
  });

  it('shows a failed new run on the page: no dialog is open, so the alert is the tab-level one (a-G4)', async () => {
    fetchMock.mockResolvedValue(reply(409, { error: { code: 'execution_in_progress', message: 'Cannot create a run right now.' } }));
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    fireEvent.click(screen.getByRole('button', { name: '+ New run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot create a run right now.');
    expect(push).not.toHaveBeenCalled();
  });

  it('deletes a run with the D-206 disposition; an execution in progress blocks with 409 (AC 19)', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(409, { error: { code: 'execution_in_progress', message: 'Execution of Line A base is running.' } }))
      .mockResolvedValueOnce(reply(200, { deleted: true, runs: { disposition: 'delete', affected: 2 } }));
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Line A base' }));
    fireEvent.click(screen.getByRole('radio', { name: /Delete them/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Execution of Line A base is running.');
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/account/sourcing-map/runs/${VOMERO_IDS.template}?runs=delete`);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('row', { name: /Line A base/ })).toBeNull());
  });


  it.each([
    ['archive', /Archive them/],
    ['keep', /Keep them/],
    ['delete', /Delete them/],
  ] as const)('a delete with disposition %s while an execution runs shows the 409 and keeps the run (contract §10)', async (d, radio) => {
    fetchMock.mockResolvedValueOnce(reply(409, { error: { code: 'execution_in_progress', message: 'Execution of Line A base is running.' } }));
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Line A base' }));
    fireEvent.click(screen.getByRole('radio', { name: radio }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Execution of Line A base is running.');
    expect(fetchMock.mock.calls[0]![0]).toBe(`/api/account/sourcing-map/runs/${VOMERO_IDS.template}?runs=${d}`);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('row', { name: /Line A base/ })).toBeInTheDocument();
  });

  it('clears a resolved delete failure when the dialog is cancelled (controller ruling, Task 21 findings 2a/2b)', async () => {
    fetchMock.mockResolvedValueOnce(reply(409, { error: { code: 'execution_in_progress', message: 'Execution of Line A base is running.' } }));
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Line A base' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Execution of Line A base is running.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps a fresh disposition per run: an earlier choice does not carry over (controller ruling, Task 21 finding 1)', () => {
    const second = { ...vomeroRunList.runs[0]!, template_id: VOMERO_IDS.executionOld, template_name: 'Line B base' };
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={[vomeroRunList.runs[0]!, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Line A base' }));
    fireEvent.click(screen.getByRole('radio', { name: /Delete them/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Line B base' }));
    expect(screen.getByRole('radio', { name: /Archive them/ })).toBeChecked();
  });

  it('keeps "+ New run" focusable while its request is in flight: aria-busy, and a second press sends nothing (LW-a)', async () => {
    let settle: (r: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    render(<RunsTab projectId={VOMERO_IDS.project} initialRuns={vomeroRunList.runs} />);
    const newRun = screen.getByRole('button', { name: '+ New run' });
    newRun.focus();
    fireEvent.click(newRun);
    expect(newRun).toHaveAttribute('aria-busy', 'true');
    expect(newRun).toHaveAttribute('aria-disabled', 'true');
    expect(newRun).not.toBeDisabled();
    expect(newRun).toHaveFocus();
    fireEvent.click(newRun);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    settle(reply(201, { template: vomeroRunTemplate }));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
  });
});

