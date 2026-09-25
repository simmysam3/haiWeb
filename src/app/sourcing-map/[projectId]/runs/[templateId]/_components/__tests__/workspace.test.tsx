import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  runningDetail, vomeroDetail, vomeroEstimate, vomeroExecution, vomeroProducts, vomeroRunTemplate, VOMERO_IDS,
} from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmExecutionDetail } from '@/lib/sourcing-map/contract';
import { Workspace } from '../workspace';

const { push, refresh, replace, search } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), search: { value: '' } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace }),
  usePathname: () => '/sourcing-map/p/runs/t',
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock('next/image', () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));
// The Configure tray's drop charts (the configure-tray.test.tsx mock): jsdom has no layout to measure.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});
// SWR never answers here; the latest key and options are kept so a test can deliver a poll failure itself.
type SwrOptions = { onError?(e: unknown, key: string): void; onSuccess?(s: unknown, key: string): void };
const { swr } = vi.hoisted(() => ({ swr: { key: null as string | null, options: {} as SwrOptions } }));
vi.mock('swr', () => ({
  default: (key: string | null, _fetcher: unknown, options: SwrOptions) => {
    swr.key = key;
    swr.options = options;
    return { data: undefined, error: undefined };
  },
}));

const fetchMock = vi.fn();
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  search.value = '';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => (url.endsWith('/estimate') ? reply(200, vomeroEstimate) : reply(404, { error: `unexpected ${url}` })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mount(detail = vomeroDetail, executions = [vomeroExecution]) {
  return render(
    <Workspace projectName="Spring 2027" template={vomeroRunTemplate} library={vomeroProducts} executions={executions} initialDetail={detail} />,
  );
}

/** An earlier execution of the same run, with its own id and start. */
function earlier(id: string, startedAt: string): SmExecutionDetail {
  return { ...vomeroDetail, execution: { ...vomeroExecution, execution_id: id, created_at: startedAt, started_at: startedAt } };
}

async function pressRun() {
  const run = await screen.findByRole('button', { name: 'Run' });
  await waitFor(() => expect(run).not.toHaveAttribute('aria-disabled'));
  fireEvent.click(run);
}

/** A reply the test releases when it chooses, to answer requests out of order. */
function deferred() {
  let resolve!: (r: ReturnType<typeof reply>) => void;
  const promise = new Promise<ReturnType<typeof reply>>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Let a released reply run through smFetch and the state updates it causes. */
async function settle(release: () => void) {
  await act(async () => {
    release();
    await new Promise((r) => setTimeout(r, 20));
  });
}

function picked(): string {
  return (screen.getByLabelText('Result') as HTMLSelectElement).value;
}

/** Open Configure, set Depth cap to 4 (a change Apply can save), and press Apply. */
function applyDepthCap4() {
  fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
  const tray = screen.getByRole('complementary', { name: 'Configure run' });
  fireEvent.click(within(tray).getByRole('tab', { name: 'Run settings' }));
  fireEvent.change(within(tray).getByLabelText('Depth cap'), { target: { value: '4' } });
  fireEvent.click(within(tray).getByRole('button', { name: 'Apply' }));
}
const DEPTH_4 = { ...vomeroRunTemplate, scope: { ...vomeroRunTemplate.scope, depth_cap: 4 } };
const NOT_READY = { ...vomeroEstimate, readiness: { ready: false, first_failing_rule: 'no_lines', detail: null } };

/**
 * P2: a side panel sits in the page flow below the header, beside the map; never an overlay (fixed or absolute)
 * that covers the header's controls. What jsdom can see: its classes, and its place in the document.
 */
function expectBesideTheMapBelowTheHeader(aside: HTMLElement) {
  const header = document.querySelector('header')!;
  expect(aside).not.toHaveClass('fixed');
  expect(aside).not.toHaveClass('absolute');
  expect(header.contains(aside)).toBe(false);
  expect(header.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(aside.parentElement).toContainElement(screen.getByRole('region', { name: 'Sourcing map' }));
}

function pick(id: string) {
  fireEvent.change(screen.getByLabelText('Result'), { target: { value: id } });
}

describe('Workspace', () => {
  it('reads the as-of drop from ?drop= and writes a clicked drop to the URL through the history API, never a server re-render (spec §9.3, F2)', async () => {
    // Next syncs useSearchParams with the native history API; a router navigation would re-run the page's reads.
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => undefined);
    search.value = 'drop=2027-04-15';
    mount();
    const leather = screen.getByRole('group', { name: 'Full grain leather hides' });
    expect(within(leather).getByText('16,000 sq ft by Mar 22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jan 15 100%' }));
    expect(replaceState).toHaveBeenCalledWith(null, '', '/sourcing-map/p/runs/t?drop=2027-01-15');
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows a failed progress poll in the alert area (Task 38 R2)', () => {
    const running = runningDetail();
    mount(running);
    const key = `/api/account/sourcing-map/executions/${running.execution.execution_id}/status`;
    expect(swr.key).toBe(key);
    act(() => swr.options.onError?.(new Error('network down'), key));
    expect(screen.getByText('Progress could not be refreshed. Retrying.')).toHaveAttribute('role', 'alert');
  });

  it('says why Run is blocked when readiness cannot be read, never "Checking…" for ever (R5)', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/estimate') ? reply(503, { error: { code: 'unavailable', message: 'haiCore is unavailable.' } }) : reply(404, {}));
    mount();
    expect(await screen.findByText('Readiness could not be checked: haiCore is unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('Run triggers, loads the execution its run_id names without refetching the list, and shows it probing (AC 17, d-G4)', async () => {
    const NEW_ID = '5a1e0000-0000-4000-8000-000000000033';
    const running = runningDetail();
    const fresh = { ...running, execution: { ...running.execution, execution_id: NEW_ID, created_at: '2026-09-24T09:00:00.000Z', started_at: '2026-09-24T09:00:00.000Z' } };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith('/trigger') && init?.method === 'POST') return reply(202, { run_id: NEW_ID });
      if (url.endsWith(`/executions/${NEW_ID}`)) return reply(200, fresh);
      return reply(404, { error: `unexpected ${url}` });
    });
    mount(null as never);
    const run = await screen.findByRole('button', { name: 'Run' });
    await waitFor(() => expect(run).not.toHaveAttribute('aria-disabled'));
    fireEvent.click(run);
    // a status ("No execution yet…") exists before Run, so wait for its text to change
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Probing: 3 of 7 probes answered'));
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls).toContain(`/api/account/sourcing-map/runs/${VOMERO_IDS.template}/trigger`);
    expect(urls).toContain(`/api/account/sourcing-map/executions/${NEW_ID}`);
    expect(urls.some((u) => u.endsWith(`/runs/${VOMERO_IDS.template}/executions`))).toBe(false);
    // the new execution joins the picker from its own detail, and is the selected one
    expect((screen.getByLabelText('Result') as HTMLSelectElement).value).toBe(NEW_ID);
  });

  it('shows the 409 when an execution is already running (AC 17)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith('/trigger')) return reply(409, { error: { code: 'execution_in_progress', message: 'Line A base already has an execution running.' } });
      return reply(404, {});
    });
    mount();
    const run = await screen.findByRole('button', { name: 'Run' });
    await waitFor(() => expect(run).not.toHaveAttribute('aria-disabled'));
    fireEvent.click(run);
    // by text, not role: the fixture's answers turn stale 7 days after 2026-09-23 and add their own alert
    expect(await screen.findByText('Line A base already has an execution running.')).toBeInTheDocument();
  });

  it('a switch of result clears the error the previous one left (R3)', async () => {
    const old = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith('/trigger')) return reply(409, { error: { code: 'execution_in_progress', message: 'Line A base already has an execution running.' } });
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return reply(200, old);
      return reply(404, {});
    });
    mount(vomeroDetail, [vomeroExecution, old.execution]);
    await pressRun();
    await screen.findByText('Line A base already has an execution running.');
    pick(VOMERO_IDS.executionOld);
    await waitFor(() => expect((screen.getByLabelText('Result') as HTMLSelectElement).value).toBe(VOMERO_IDS.executionOld));
    expect(screen.queryByText('Line A base already has an execution running.')).toBeNull();
  });

  it('applies only the latest pick when two answers arrive out of order (R3)', async () => {
    const OTHER = '5a1e0000-0000-4000-8000-000000000034';
    const first = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
    const second = earlier(OTHER, '2026-09-21T10:00:00.000Z');
    const slowFirst = deferred();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return slowFirst.promise;
      if (url.endsWith(`/executions/${OTHER}`)) return reply(200, second);
      return reply(404, {});
    });
    mount(vomeroDetail, [vomeroExecution, first.execution, second.execution]);
    pick(VOMERO_IDS.executionOld);
    pick(OTHER);
    await waitFor(() => expect(picked()).toBe(OTHER));
    // The first pick's answer arrives last; it must not replace the second.
    await settle(() => slowFirst.resolve(reply(200, first)));
    expect(picked()).toBe(OTHER);
  });

  it('a superseded pick that fails late shows no error on the result now loaded (R3)', async () => {
    const OTHER = '5a1e0000-0000-4000-8000-000000000034';
    const first = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
    const second = earlier(OTHER, '2026-09-21T10:00:00.000Z');
    const slowFirst = deferred();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return slowFirst.promise;
      if (url.endsWith(`/executions/${OTHER}`)) return reply(200, second);
      return reply(404, {});
    });
    mount(vomeroDetail, [vomeroExecution, first.execution, second.execution]);
    pick(VOMERO_IDS.executionOld);
    pick(OTHER);
    await waitFor(() => expect(picked()).toBe(OTHER));
    await settle(() => slowFirst.resolve(reply(500, { error: { code: 'internal', message: 'The first pick failed.' } })));
    expect(screen.queryByText('The first pick failed.')).toBeNull();
  });

  it('opens a card’s details panel and closes it (AC 18)', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    const panel = screen.getByRole('complementary', { name: 'Details for León Cuero' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close details' }));
    expect(screen.queryByRole('complementary', { name: 'Details for León Cuero' })).toBeNull();
  });

  it('moves focus into the details on each new pick, not only the first (R2)', () => {
    mount();
    // A real click focuses the button it presses; fireEvent.click does not, so the test focuses it first.
    const leon = screen.getByRole('button', { name: /^León Cuero, MX/ });
    leon.focus();
    fireEvent.click(leon);
    expect(screen.getByRole('heading', { name: 'León Cuero · MX' })).toHaveFocus();
    const mekong = screen.getByRole('button', { name: /^Mekong Tannery, VN/ });
    mekong.focus();
    fireEvent.click(mekong);
    expect(screen.getByRole('heading', { name: 'Mekong Tannery · VN' })).toHaveFocus();
  });

  it('returns focus to the card that opened the details when they close (R2)', () => {
    mount();
    // Not focused first: a mouse click on the card's body, or Safari's click, focuses nothing.
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    const panel = screen.getByRole('complementary', { name: 'Details for León Cuero' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close details' }));
    expect(screen.getByRole('button', { name: /^León Cuero, MX/ })).toHaveFocus();
  });

  it('a switch of result closes the details panel, whose pick named a card of the previous result (R3)', async () => {
    const old = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return reply(200, old);
      return reply(404, {});
    });
    mount(vomeroDetail, [vomeroExecution, old.execution]);
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    pick(VOMERO_IDS.executionOld);
    await waitFor(() => expect(picked()).toBe(VOMERO_IDS.executionOld));
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
  });

  it('returns focus to Configure when the tray closes (R2)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const tray = screen.getByRole('complementary', { name: 'Configure run' });
    fireEvent.click(within(tray).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure' })).toHaveFocus();
  });

  it('returns focus to Configure when an Apply closes the tray (R2)', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/runs/${VOMERO_IDS.template}`) && init?.method === 'PATCH') return reply(200, { template: DEPTH_4 });
      return reply(404, {});
    });
    mount();
    applyDepthCap4();
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Configure' })).toHaveFocus();
  });

  it('after an Apply, Run waits for the new scope’s readiness and never shows the old one’s (brief: estimate after each Apply)', async () => {
    const second = deferred();
    let estimates = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) {
        estimates += 1;
        return estimates === 1 ? reply(200, vomeroEstimate) : second.promise;
      }
      if (url.endsWith(`/runs/${VOMERO_IDS.template}`) && init?.method === 'PATCH') return reply(200, { template: DEPTH_4 });
      return reply(404, {});
    });
    mount();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).not.toHaveAttribute('aria-disabled'));
    applyDepthCap4();
    await waitFor(() => expect(estimates).toBe(2));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Checking whether the run is ready…')).toBeInTheDocument();
    await settle(() => second.resolve(reply(200, NOT_READY)));
    expect(screen.getByText('A workbench product has no BOM lines.')).toBeInTheDocument();
  });

  it('a late readiness answer for the scope before an Apply never overwrites the new scope’s', async () => {
    const first = deferred();
    let estimates = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) {
        estimates += 1;
        return estimates === 1 ? first.promise : reply(200, NOT_READY);
      }
      if (url.endsWith(`/runs/${VOMERO_IDS.template}`) && init?.method === 'PATCH') return reply(200, { template: DEPTH_4 });
      return reply(404, {});
    });
    mount();
    applyDepthCap4();
    expect(await screen.findByText('A workbench product has no BOM lines.')).toBeInTheDocument();
    // The mount's read (the old scope, ready) answers last.
    await settle(() => first.resolve(reply(200, vomeroEstimate)));
    expect(screen.getByText('A workbench product has no BOM lines.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('warns in the header once the answers are more than 7 days old, and not before (R5: answersAreStale kept)', () => {
    const STALE = 'Answers are more than 7 days old; run again for fresh answers.';
    // The fixture's answers are from 2026-09-23T10:42Z; only Date is faked, so every timer stays real.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
    const stale = mount();
    expect(screen.getByText(STALE)).toBeInTheDocument();
    stale.unmount();
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
    mount();
    expect(screen.getByText('Answers as of Sep 23, 10:42 UTC')).toBeInTheDocument();
    expect(screen.queryByText(STALE)).toBeNull();
  });

  it('cancels a running execution and shows it cancelled (AC 17)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') return reply(200, { ...running.execution, status: 'cancelled' });
      if (url.endsWith(`/executions/${id}`)) return reply(200, { ...running, execution: { ...running.execution, status: 'cancelled' } });
      return reply(404, {});
    });
    mount(running);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Answers that arrived afterwards were discarded.'));
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith(`/executions/${id}/cancel`) && (i as RequestInit | undefined)?.method === 'POST')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Cancel execution' })).toBeNull();
  });

  it('keeps Cancel execution focusable while its request is in flight: aria-busy, and a second press sends nothing (R4, LW-a)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    const slowCancel = deferred();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') return slowCancel.promise;
      if (url.endsWith(`/executions/${id}`)) return reply(200, { ...running, execution: { ...running.execution, status: 'cancelled' } });
      return reply(404, {});
    });
    mount(running);
    const cancel = screen.getByRole('button', { name: 'Cancel execution' });
    cancel.focus();
    fireEvent.click(cancel);
    expect(cancel).toHaveAttribute('aria-busy', 'true');
    expect(cancel).toHaveAttribute('aria-disabled', 'true');
    expect(cancel).not.toBeDisabled();
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith(`/executions/${id}/cancel`))).toHaveLength(1);
    await settle(() => slowCancel.resolve(reply(200, { ...running.execution, status: 'cancelled' })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Answers that arrived afterwards were discarded.'));
  });

  it('a successful Cancel, which removes its button, hands focus to the result picker, never <body> (R2)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') return reply(200, { ...running.execution, status: 'cancelled' });
      if (url.endsWith(`/executions/${id}`)) return reply(200, { ...running, execution: { ...running.execution, status: 'cancelled' } });
      return reply(404, {});
    });
    mount(running);
    const cancel = screen.getByRole('button', { name: 'Cancel execution' });
    cancel.focus();
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Answers that arrived afterwards were discarded.'));
    expect(screen.getByLabelText('Result')).toHaveFocus();
  });

  it('a Cancel answered while the user works in the Configure tray leaves focus in the tray (R2: only a fallen focus is moved)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    const slowCancel = deferred();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') return slowCancel.promise;
      if (url.endsWith(`/executions/${id}`)) return reply(200, { ...running, execution: { ...running.execution, status: 'cancelled' } });
      return reply(404, {});
    });
    mount(running);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    const trayHeading = screen.getByRole('heading', { name: 'Configure' });
    expect(trayHeading).toHaveFocus();
    await settle(() => slowCancel.resolve(reply(200, { ...running.execution, status: 'cancelled' })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Answers that arrived afterwards were discarded.'));
    expect(trayHeading).toHaveFocus();
  });

  it('a Cancel answered after the user picked another result never switches back to the cancelled one (R3)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    const other = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
    const slowCancel = deferred();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') return slowCancel.promise;
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return reply(200, other);
      if (url.endsWith(`/executions/${id}`)) return reply(200, { ...running, execution: { ...running.execution, status: 'cancelled' } });
      return reply(404, {});
    });
    mount(running, [running.execution, other.execution]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    pick(VOMERO_IDS.executionOld);
    await waitFor(() => expect(picked()).toBe(VOMERO_IDS.executionOld));
    await settle(() => slowCancel.resolve(reply(200, { ...running.execution, status: 'cancelled' })));
    expect(picked()).toBe(VOMERO_IDS.executionOld);
  });

  it('a refused Cancel answered after the user picked another result shows no error on it (R3)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    const other = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
    const slowCancel = deferred();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') return slowCancel.promise;
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return reply(200, other);
      return reply(404, {});
    });
    mount(running, [running.execution, other.execution]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    pick(VOMERO_IDS.executionOld);
    await waitFor(() => expect(picked()).toBe(VOMERO_IDS.executionOld));
    await settle(() => slowCancel.resolve(reply(409, { error: { code: 'execution_not_running', message: 'The execution had already finished.' } })));
    expect(screen.queryByText('The execution had already finished.')).toBeNull();
  });

  it('a switch of result expands the rails the previous result had collapsed, which are named by slot index (R3)', async () => {
    const old = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return reply(200, old);
      return reply(404, {});
    });
    mount(vomeroDetail, [vomeroExecution, old.execution]);
    const rail = () => within(screen.getByRole('group', { name: 'Full grain leather hides' })).getByRole('button', { name: 'Full grain leather hides' });
    fireEvent.click(rail());
    expect(rail()).toHaveAttribute('aria-expanded', 'false');
    pick(VOMERO_IDS.executionOld);
    await waitFor(() => expect(picked()).toBe(VOMERO_IDS.executionOld));
    expect(rail()).toHaveAttribute('aria-expanded', 'true');
  });

  it('Run stays disabled until the execution it started has loaded, so a second press can’t race it (close while busy)', async () => {
    const NEW_ID = '5a1e0000-0000-4000-8000-000000000033';
    const running = runningDetail();
    const fresh = { ...running, execution: { ...running.execution, execution_id: NEW_ID, created_at: '2026-09-24T09:00:00.000Z', started_at: '2026-09-24T09:00:00.000Z' } };
    const slowDetail = deferred();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith('/trigger') && init?.method === 'POST') return reply(202, { run_id: NEW_ID });
      if (url.endsWith(`/executions/${NEW_ID}`)) return slowDetail.promise;
      return reply(404, {});
    });
    mount();
    await pressRun();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith(`/executions/${NEW_ID}`))).toBe(true));
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('aria-busy', 'true');
    // LW-a: busy, not disabled, so the pressed button keeps focus; a second press sends nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/trigger'))).toHaveLength(1);
    await settle(() => slowDetail.resolve(reply(200, fresh)));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Probing: 3 of 7 probes answered'));
    // Running: still aria-disabled with its reason, never `disabled`.
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAccessibleDescription('An execution is running.');
    expect(screen.getByRole('button', { name: 'Run' })).not.toBeDisabled();
  });

  it('the details panel sits in the page flow below the header, beside the map, never over the header’s controls (P2)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expectBesideTheMapBelowTheHeader(screen.getByRole('complementary', { name: 'Details for León Cuero' }));
  });

  it('the Configure tray sits in the page flow below the header, beside the map, never over the header’s controls (P2)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expectBesideTheMapBelowTheHeader(screen.getByRole('complementary', { name: 'Configure run' }));
  });

  it('opening Configure closes the details, so one side column shows at a time and the row never overflows (P2)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByRole('complementary', { name: 'Configure run' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
  });

  it('a card picked while Configure is open waits for the tray to close, then shows its details, which take focus (P2)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Configure run' })).getByRole('button', { name: 'Close' }));
    // The deliberate exception to R2c's "focus returns to Configure": the user asked for these details.
    expect(screen.getByRole('heading', { name: 'León Cuero · MX' })).toHaveFocus();
  });

  it('the picker names the status the poll has moved to, not the one the result was loaded with (I-1)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      // the hook's full read once the status is terminal
      if (url.endsWith(`/executions/${id}`)) return reply(200, vomeroDetail);
      return reply(404, {});
    });
    mount(running, [running.execution]);
    const select = screen.getByLabelText('Result') as HTMLSelectElement;
    expect(select.selectedOptions[0]!.textContent).toMatch(/· running$/);
    const key = `/api/account/sourcing-map/executions/${id}/status`;
    expect(swr.key).toBe(key);
    act(() =>
      swr.options.onSuccess?.({ execution_id: id, status: 'completed', failure_reason: null, probes_planned: 7, probes_done: 7, cursor: 7, changed: [] }, key));
    await waitFor(() => expect(select.selectedOptions[0]!.textContent).toMatch(/· completed$/));
  });

  it('collapsing the lane that holds the open card closes its details; focus stays on the lane’s toggle, never <body> (M1)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    const rail = within(screen.getByRole('group', { name: 'Full grain leather hides' })).getByRole('button', { name: 'Full grain leather hides' });
    rail.focus();
    fireEvent.click(rail);
    expect(rail).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
    expect(rail).toHaveFocus();
  });

  it('a Cancel whose reload fails never moves focus later, when a poll ends the execution (M2)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    const cancelled = { ...running, execution: { ...running.execution, status: 'cancelled' as const } };
    let reads = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') return reply(200, cancelled.execution);
      if (url.endsWith(`/executions/${id}`)) {
        reads += 1;
        // Cancel's reload fails; the hook's later full read (after the terminal poll) succeeds.
        return reads === 1 ? reply(500, { error: { code: 'internal', message: 'The result could not be reloaded.' } }) : reply(200, cancelled);
      }
      return reply(404, {});
    });
    mount(running);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    expect(await screen.findByText('The result could not be reloaded.')).toBeInTheDocument();
    const key = `/api/account/sourcing-map/executions/${id}/status`;
    act(() =>
      swr.options.onSuccess?.({ execution_id: id, status: 'cancelled', failure_reason: null, probes_planned: 7, probes_done: 3, cursor: 3, changed: [] }, key));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Answers that arrived afterwards were discarded.'));
    expect(screen.getByLabelText('Result')).not.toHaveFocus();
  });

  it('an Apply clears a card picked while Configure was open, and focus returns to Configure (M3: P2d is for Close only)', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/runs/${VOMERO_IDS.template}`) && init?.method === 'PATCH') return reply(200, { template: DEPTH_4 });
      return reply(404, {});
    });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    const tray = screen.getByRole('complementary', { name: 'Configure run' });
    fireEvent.click(within(tray).getByRole('tab', { name: 'Run settings' }));
    fireEvent.change(within(tray).getByLabelText('Depth cap'), { target: { value: '4' } });
    fireEvent.click(within(tray).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull());
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Configure' })).toHaveFocus();
  });

  it('a refused Cancel shows its message (M4)', async () => {
    const running = runningDetail();
    const id = running.execution.execution_id;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${id}/cancel`) && init?.method === 'POST') {
        return reply(409, { error: { code: 'execution_not_running', message: 'The execution had already finished.' } });
      }
      return reply(404, {});
    });
    mount(running);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    expect(await screen.findByText('The execution had already finished.')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Cancel execution' })).not.toHaveAttribute('aria-disabled');
  });

  it('shows haiCore’s message when Run is refused as not ready (422 run_not_ready, M4)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith('/trigger')) return reply(422, { error: { code: 'run_not_ready', message: 'A BOM line of Court Classic has no class.' } });
      return reply(404, {});
    });
    mount();
    await pressRun();
    expect(await screen.findByText('A BOM line of Court Classic has no class.')).toHaveAttribute('role', 'alert');
  });

  it('a clicked drop keeps the other query parameters in the URL (M4, F2)', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => undefined);
    search.value = 'x=1&drop=2027-04-15';
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Jan 15 100%' }));
    expect(replaceState).toHaveBeenCalledWith(null, '', '/sourcing-map/p/runs/t?x=1&drop=2027-01-15');
  });
});
