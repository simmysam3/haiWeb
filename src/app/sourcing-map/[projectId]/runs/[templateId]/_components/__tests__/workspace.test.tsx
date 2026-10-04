import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import {
  runningDetail, vomeroDetail, vomeroEstimate, vomeroExecution, vomeroProducts, vomeroRunTemplate, VOMERO_IDS,
} from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmCandidateResult2, SmExecutionDetail2 as SmExecutionDetail, SmExecutionSummary2 } from '@/lib/sourcing-map/types';
import { multitierDetail, throttledDetail, throttledStatus, withRealKeys } from '@/app/sourcing-map/__fixtures__/sp2';
import { compareDetail } from '@/app/sourcing-map/__fixtures__/lf';
import { recordFocusWhen } from '@/test/focus-recorder';
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
  // the heat choice is stored (LF §6.6): one test's press never reaches the next test's first paint
  window.localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string) => (url.endsWith('/estimate') ? reply(200, vomeroEstimate) : reply(404, { error: `unexpected ${url}` })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mount(detail: SmExecutionDetail = vomeroDetail, executions: SmExecutionSummary2[] = [vomeroExecution]) {
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

/**
 * A wait, not an assertion: every mounted option panel (one hidden under a handle panel too, as text queries see hidden
 * elements) has had its read answered, so the update lands inside the test and adds no act(...) warning.
 */
async function panelsSettled() {
  await waitFor(() => expect(screen.queryAllByText('Loading…')).toEqual([]));
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

  it('opening a card’s details fetches its option panel under the execution’s own id and the card’s real key (spec §12.3, C-13)', async () => {
    const real = withRealKeys(multitierDetail);
    const leon = real.result!.slots[0]!.candidates[0]!;
    mount(real, [real.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^León Cuero, MX/ }));
    const want = `/api/account/sourcing-map/executions/${real.execution.execution_id}/options/${encodeURIComponent(leon.candidate_key!)}/panel`;
    await waitFor(() => expect(fetchMock.mock.calls.map(([u]) => String(u))).toContain(want));
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
    // F-FLAKE-1: focus as it stands when Cancel goes, not only once the waitFor below returns.
    const atGone = recordFocusWhen(() => !cancel.isConnected);
    fireEvent.click(cancel);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Cancelled. Answers that arrived afterwards were discarded.'));
    expect(atGone.element).toBe(screen.getByLabelText('Result'));
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

  it('SP2: picking a node from the limits list draws its trace and the card’s details; a handle click swaps the side column to the handle panel (P2, one panel at a time); Close returns focus to the handle and brings the card’s details back (spec §12.3, §12.4)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: 'A · tier 2 — binding for León Cuero' }));
    expect(screen.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    // A2: the details panel says the trace in words, its names resolved from the run's result
    const traceLine = within(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('region', { name: 'Below tier 1' })).getByText(/^Shortfall trace:/);
    expect(traceLine.tagName).toBe('P');
    expect(traceLine.textContent).toMatch(/^Shortfall trace: León Cuero → A \(moderate\)/);
    const a = within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ });
    fireEvent.click(a);
    const panel = screen.getByRole('complementary', { name: 'Details for supplier A' });
    expectBesideTheMapBelowTheHeader(panel);
    expect(screen.queryByRole('complementary', { name: 'Details for León Cuero' })).toBeNull();
    expect(within(panel).getByText('binding')).toBeInTheDocument();
    expect(within(panel).getByText('Also supplies: Mekong Tannery')).toBeInTheDocument();
    expect(a).toHaveAttribute('aria-pressed', 'true');
    // R6: the same alias under another card is not the pressed handle
    expect(within(screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^A · IT · Dyes/ })).toHaveAttribute('aria-pressed', 'false');
    // the trace stays drawn while the handle panel is open
    expect(screen.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close handle details' }));
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(document.activeElement).toBe(a);
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    // Review Focus 3: with León still selected, Mekong's copy of A has no trace role; the role is León's, for León's handle only
    fireEvent.click(within(screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^A · IT · Dyes/ }));
    const mekongWhileLeon = screen.getByRole('complementary', { name: 'Details for supplier A' });
    expect(within(mekongWhileLeon).queryByText('binding')).toBeNull();
    fireEvent.click(within(mekongWhileLeon).getByRole('button', { name: 'Close handle details' }));
    // a handle under Mekong, with no card selected: the panel shows Mekong's copy of A (no band, no role) and names León as the other option (Review Focus 3)
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Close details' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^A · IT · Dyes/ }));
    const fromMekong = screen.getByRole('complementary', { name: 'Details for supplier A' });
    expect(within(fromMekong).queryByText('binding')).toBeNull();
    expect(within(fromMekong).queryByText('Band')).toBeNull();
    expect(within(fromMekong).getByText('Also supplies: León Cuero')).toBeInTheDocument();
    // Close returns focus to Mekong's handle, the one pressed, not León's copy of the same alias
    fireEvent.click(within(fromMekong).getByRole('button', { name: 'Close handle details' }));
    expect(document.activeElement).toBe(within(screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^A · IT · Dyes/ }));
  });

  it('C pressed under León says it is also at tier 2 under Mekong Tannery; pressed under Mekong, at tier 3 under León Cuero', async () => {
    mount(compareDetail, [compareDetail.execution]);
    const alsoAt = (panel: HTMLElement) => within(panel).queryAllByText(/^Also at tier/).map((el) => el.textContent);
    fireEvent.click(within(await screen.findByRole('group', { name: 'Tier 3 under León Cuero' })).getByRole('button', { name: /^C · IN/ }));
    const fromLeon = screen.getByRole('complementary', { name: 'Details for supplier C' });
    expect(alsoAt(fromLeon)).toEqual(['Also at tier 2 under Mekong Tannery']);
    fireEvent.click(within(fromLeon).getByRole('button', { name: 'Close handle details' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^C · IN/ }));
    const fromMekong = screen.getByRole('complementary', { name: 'Details for supplier C' });
    expect(alsoAt(fromMekong)).toEqual(['Also at tier 3 under León Cuero']);
  });

  it('SP2: a throttled execution keeps polling, names the responder from the summary and then from each frame (or falls back when the name is null), keeps Cancel live, and Run says an execution is running (spec §12.5, G-41, G-52, Review Focus 4)', async () => {
    mount(throttledDetail, [throttledDetail.execution]);
    expect(swr.key).toBe('/api/account/sourcing-map/executions/5a1e0000-0000-4000-8000-000000000033/status');
    // G-41: the detail's summary already names the responder
    expect(screen.getByRole('status')).toHaveTextContent("Waiting for Arno Pelli's hourly allowance until 11:00 UTC — the run continues on its own.");
    expect(screen.getByRole('button', { name: 'Cancel execution' })).toBeInTheDocument();
    // G-52: a frame whose waiting responder is below tier 1 carries no name; the fallback sentence, Cancel still live
    act(() => swr.options.onSuccess?.({ ...throttledStatus, waiting_on: { responder_name: null, refill_at: '2027-03-01T11:00:00.000Z' } }, swr.key!));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Waiting for an hourly allowance — the run continues on its own.'));
    act(() => swr.options.onSuccess?.(throttledStatus, swr.key!));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent("Waiting for Arno Pelli's hourly allowance until 11:00 UTC — the run continues on its own."));
    expect(screen.getByRole('button', { name: 'Cancel execution' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Run' })).toHaveAccessibleDescription('An execution is running.');
    expect((screen.getByLabelText('Result') as HTMLSelectElement).selectedOptions[0]!.textContent).toMatch(/· throttled$/);
    // the settled cards stay drawn; the waiting one says so
    expect(screen.getByRole('button', { name: 'Arno Pelli, IT: Waiting · hourly allowance' })).toBeInTheDocument();
  });

  it('SP2: pressing a pressed handle again closes its panel; focus stays on that handle and the card’s details come back without taking it (R7, WCAG 2.4.3)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: 'A · tier 2 — binding for León Cuero' }));
    const a = within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ });
    fireEvent.click(a);
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    // fireEvent moves no focus, so where focus lands is the workspace's doing alone
    fireEvent.click(a);
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(document.activeElement).toBe(a);
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
  });

  it('SP2 on real wire keys (JSON.stringify([participant, sku]), with quotes): the handle panel closes by Close and by a second press, and focus returns to the handle (C-1)', async () => {
    const real = withRealKeys(multitierDetail);
    const leon = real.result!.slots[0]!.candidates[0]!;
    mount(real, [real.execution]);
    fireEvent.click(await screen.findByRole('button', { name: 'A · tier 2 — binding for León Cuero' }));
    expect(screen.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeInTheDocument();
    // control: the card really carries the wire key, quotes and all, so the rest runs on it
    expect(screen.getByRole('button', { name: /^León Cuero, MX/ })).toHaveAttribute('data-anchor', JSON.stringify([leon.supplier_participant_id, leon.supplier_sku]));
    const a = within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ });
    fireEvent.click(a);
    const panel = screen.getByRole('complementary', { name: 'Details for supplier A' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close handle details' }));
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(document.activeElement).toBe(a);
    // a press opens it, a second press closes it; focus stays on the handle
    fireEvent.click(a);
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    fireEvent.click(a);
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(document.activeElement).toBe(a);
  });

  it('SP2: a limits entry for a card in a collapsed lane expands the lane and draws the trace; Close details returns focus to the card (I-1)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    const rail = within(await screen.findByRole('group', { name: 'Full grain leather hides' })).getByRole('button', { name: 'Full grain leather hides' });
    fireEvent.click(rail);
    expect(rail).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'A · tier 2 — binding for León Cuero' }));
    expect(rail).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Close details' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^León Cuero, MX/ }));
  });

  it('SP2: a pressed handle whose node a poll frame takes off the map shows no handle panel, so the card’s details are not hidden under it: never an empty side column (M-4)', async () => {
    const live: SmExecutionDetail = { ...multitierDetail, execution: { ...multitierDetail.execution, status: 'running' } };
    mount(live, [live.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^León Cuero, MX/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ }));
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Details for León Cuero' })).toBeNull();
    // the frame re-serves León and Mekong, the two options that carried A, without it
    const withoutA = (c: SmCandidateResult2): SmCandidateResult2 => ({ ...c, nodes: (c.nodes ?? []).filter((n) => n.alias !== 'A'), trace: null });
    const [leon, mekong] = live.result!.slots[0]!.candidates;
    const key = `/api/account/sourcing-map/executions/${live.execution.execution_id}/status`;
    expect(swr.key).toBe(key);
    act(() => swr.options.onSuccess?.({
      execution_id: live.execution.execution_id, status: 'running', failure_reason: null, probes_planned: 15, probes_done: 15, cursor: 15,
      changed: [{ slot_index: 0, candidate_index: 0, candidate: withoutA(leon!) }, { slot_index: 0, candidate_index: 1, candidate: withoutA(mekong!) }],
    }, key));
    expect(screen.queryByRole('group', { name: 'Tier 2 under León Cuero' })).not.toBeNull();
    expect(within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).queryByRole('button', { name: /^A · / })).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
  });

  it('SP2: collapsing the lane of the card a handle was pressed on closes the handle panel with it; focus stays on the lane’s toggle, and a card selected in another lane shows its details again (M1 for handles)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    const mekongA = async () => within(await screen.findByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^A · IT · Dyes/ });
    const rail = within(screen.getByRole('group', { name: 'Full grain leather hides' })).getByRole('button', { name: 'Full grain leather hides' });
    // nothing selected: Mekong's A, then the leather lane collapses (a press focuses the toggle; fireEvent does not)
    fireEvent.click(await mekongA());
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    rail.focus();
    fireEvent.click(rail);
    expect(rail).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(document.activeElement).toBe(rail);
    // a card selected in ANOTHER lane stays selected: its details come back, and focus stays on the toggle
    fireEvent.click(rail);
    fireEvent.click(screen.getByRole('button', { name: /^FlowKnit Mills/ }));
    expect(screen.getByRole('complementary', { name: 'Details for FlowKnit Mills' })).toBeInTheDocument();
    fireEvent.click(await mekongA());
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Details for FlowKnit Mills' })).toBeNull();
    rail.focus();
    fireEvent.click(rail);
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Details for FlowKnit Mills' })).toBeInTheDocument();
    expect(document.activeElement).toBe(rail);
  });

  it('Hide all paths closes the details and the trace, leaves an open handle panel as it is, and keeps focus on itself (§6.4)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^León Cuero, MX/ }));
    // control: León's trace is drawn
    expect(document.querySelector('svg[data-trace]')).not.toBeNull();
    // Mekong's copy of A: its panel takes the column, and León's details stay mounted, hidden under it
    fireEvent.click(within(screen.getByRole('group', { name: 'Tier 2 under Mekong Tannery' })).getByRole('button', { name: /^A · IT · Dyes/ }));
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    expect(document.querySelector('aside[aria-label="Details for León Cuero"]')).toHaveAttribute('hidden');
    // a press focuses the button it presses; fireEvent does not
    const hide = screen.getByRole('button', { name: 'Hide all paths' });
    hide.focus();
    fireEvent.click(hide);
    expect(document.querySelector('svg[data-trace]')).toBeNull();
    // unmounted, not merely hidden under the handle panel: a role query never sees a hidden panel, and with
    // `hidden: true` it still misses it, because a hidden element has no accessible name
    expect(document.querySelector('aside[aria-label="Details for León Cuero"]')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    // Review Focus 5: the pressed button turns unavailable under the viewer's focus, and keeps it
    expect(hide).toHaveFocus();
    expect(hide).toHaveAttribute('aria-disabled', 'true');
  });

  it('Escape closes one layer per press, from anywhere: the handle panel, then the details, then Configure; each returns focus as its Close does (§6.5)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    // (a) to (d) press on <body>: the key works with focus anywhere on the page
    const escape = () => fireEvent.keyDown(document.body, { key: 'Escape' });
    const leon = await screen.findByRole('button', { name: /^León Cuero, MX/ });
    fireEvent.click(leon);
    const leonA = within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ });
    fireEvent.click(leonA);
    // control: the handle panel holds the column
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    // another key closes nothing
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(screen.getByRole('complementary', { name: 'Details for supplier A' })).toBeInTheDocument();
    // a press inside the handle panel, on its focused heading: no panel answers Escape itself, so that panel goes
    const heading = within(screen.getByRole('complementary', { name: 'Details for supplier A' })).getByRole('heading', { name: 'Supplier A · tier 2' });
    expect(heading).toHaveFocus();
    fireEvent.keyDown(heading, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    // and nothing else: León's details come back
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    // the handle panel again, for the presses on <body>
    fireEvent.click(leonA);
    // (a) the handle panel goes first
    escape();
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    expect(leonA).toHaveFocus();
    // (b) then the details
    escape();
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
    expect(leon).toHaveFocus();
    // (c) then Configure
    const configure = screen.getByRole('button', { name: 'Configure' });
    fireEvent.click(configure);
    // control: the tray holds the column
    expect(screen.getByRole('complementary', { name: 'Configure run' })).toBeInTheDocument();
    escape();
    expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull();
    expect(configure).toHaveFocus();
    // (d) nothing open: a press changes nothing and throws nothing. jsdom reports a listener's throw as an error
    // event on the window, never to the caller, so that is where it is looked for.
    const thrown = vi.fn();
    window.addEventListener('error', thrown);
    leon.focus();
    escape();
    window.removeEventListener('error', thrown);
    expect(thrown).not.toHaveBeenCalled();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(leon).toHaveFocus();
  });

  // Review Focus 2: Escape pressed where something else owns it closes no Sourcing Map layer.
  it('ignores an Escape another handler already took (defaultPrevented)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    const take = (e: KeyboardEvent) => e.preventDefault();
    document.body.addEventListener('keydown', take, true);
    try {
      fireEvent.keyDown(document.body, { key: 'Escape' });
    } finally {
      document.body.removeEventListener('keydown', take, true);
    }
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
  });

  it('an Escape inside the upload wizard closes the wizard and leaves Configure open (w1)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Configure run' })).getByRole('button', { name: 'Upload schedule' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Upload schedule' }), { key: 'Escape' });
    // the dialog still gets its key: the page's listener takes nothing from it
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Configure run' })).toBeInTheDocument();
    // review I-1: the modal owns Escape even while focus is outside it (a click on its backdrop leaves focus on <body>)
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Configure run' })).getByRole('button', { name: 'Upload schedule' }));
    (document.activeElement as HTMLElement).blur();
    // present control: the press lands on <body>
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByRole('complementary', { name: 'Configure run' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Upload schedule' })).toBeInTheDocument();
  });

  it('ignores an Escape whose target is outside what the workspace renders (the help panel, w9)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    // another surface of the page, beside the container the workspace is rendered into
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    try {
      fireEvent.keyDown(outside, { key: 'Escape' });
    } finally {
      outside.remove();
    }
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    // the help panel's shape, a NON-modal dialog, were it ever mounted inside the root: the dialog rule keeps its
    // Escape from the page (the modal rule does not match it)
    const panel = document.createElement('div');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    const composer = document.createElement('button');
    panel.appendChild(composer);
    screen.getByRole('region', { name: 'Sourcing map' }).appendChild(panel);
    try {
      composer.focus();
      // present control: the press lands inside the dialog
      expect(composer).toHaveFocus();
      fireEvent.keyDown(composer, { key: 'Escape' });
    } finally {
      panel.remove();
    }
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    // the page itself is no other surface: a press on <html> closes a layer, as one on <body> does
    fireEvent.keyDown(document.documentElement, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Details for León Cuero' })).toBeNull();
  });

  it('ignores an Escape on a <select>, whose list uses it (w4)', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText('Result'), { key: 'Escape' });
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
  });

  it('does not close Configure while its Apply is in flight (w5)', async () => {
    const slowApply = deferred();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/runs/${VOMERO_IDS.template}`) && init?.method === 'PATCH') return slowApply.promise;
      return reply(404, {});
    });
    mount();
    applyDepthCap4();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByRole('complementary', { name: 'Configure run' })).toBeInTheDocument();
    await settle(() => slowApply.resolve(reply(200, { template: DEPTH_4 })));
    // the answer closed the tray; opened again it closes on Escape, because the tray also reports that nothing is in flight
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull();
  });

  it('on a running execution Hide all paths is unavailable and says why; Escape still closes the details (§9.5)', async () => {
    mount(throttledDetail, [throttledDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^León Cuero, MX/ }));
    // control: León's details are open, so a path is open
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    const hide = screen.getByRole('button', { name: 'Hide all paths' });
    expect(hide).toHaveAttribute('aria-disabled', 'true');
    expect(hide).toHaveAccessibleDescription('Available when the run completes.');
    // Escape is not disabled (§9.5): it closes the details
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'Details for León Cuero' })).toBeNull();
  });

  it('the switch turns the link heat off and on, stores the choice, and a stored off is honoured on mount', async () => {
    const linkStrokes = () => Array.from(document.querySelectorAll<SVGPathElement>('svg[data-map-links] path[data-link]')).map((p) => p.style.stroke);
    const first = mount(multitierDetail, [multitierDetail.execution]);
    // control: the heat is on at first paint, so some link carries a heat colour
    const heatSwitch = await screen.findByRole('button', { name: 'Heat on links: on' });
    expect(linkStrokes().some((s) => s.startsWith('var(--sm-heat-'))).toBe(true);
    fireEvent.click(heatSwitch);
    expect(linkStrokes().filter((s) => s !== 'var(--sm-line-2)')).toEqual([]);
    expect(screen.getByRole('button', { name: 'Heat on links: off' })).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem('sm.heat')).toBe('off');
    // a second press: the heat is back, and stored as on
    fireEvent.click(screen.getByRole('button', { name: 'Heat on links: off' }));
    expect(screen.getByRole('button', { name: 'Heat on links: on' })).toBeInTheDocument();
    expect(linkStrokes().some((s) => s.startsWith('var(--sm-heat-'))).toBe(true);
    expect(window.localStorage.getItem('sm.heat')).toBe('on');
    // a stored off is honoured by a fresh mount
    first.unmount();
    window.localStorage.setItem('sm.heat', 'off');
    mount(multitierDetail, [multitierDetail.execution]);
    expect(await screen.findByRole('button', { name: 'Heat on links: off' })).toHaveAttribute('aria-pressed', 'false');
    expect(linkStrokes().length).toBeGreaterThan(0);
    expect(linkStrokes().filter((s) => s !== 'var(--sm-line-2)')).toEqual([]);
  });

  it('on a running execution the heat switch is unavailable and says why, and the links keep the stored setting (§9.5)', async () => {
    window.localStorage.setItem('sm.heat', 'off');
    const linkStrokes = () => Array.from(document.querySelectorAll<SVGPathElement>('svg[data-map-links] path[data-link]')).map((p) => p.style.stroke);
    mount(throttledDetail, [throttledDetail.execution]);
    const heatSwitch = await screen.findByRole('button', { name: 'Heat on links: off' });
    expect(linkStrokes().length).toBeGreaterThan(0);
    expect(linkStrokes().filter((s) => s !== 'var(--sm-line-2)')).toEqual([]);
    expect(heatSwitch).toHaveAttribute('aria-disabled', 'true');
    expect(heatSwitch).toHaveAccessibleDescription('Available when the run completes.');
    // a press changes neither the links nor the stored value
    fireEvent.click(heatSwitch);
    expect(screen.getByRole('button', { name: 'Heat on links: off' })).toBeInTheDocument();
    expect(linkStrokes().filter((s) => s !== 'var(--sm-line-2)')).toEqual([]);
    expect(window.localStorage.getItem('sm.heat')).toBe('off');
  });

  it('on a running execution the Path beneath tab is unavailable and says why (§9.5)', async () => {
    mount(throttledDetail, [throttledDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^León Cuero, MX/ }));
    const tab = within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('tab', { name: 'Path beneath' });
    expect(tab).toHaveAttribute('aria-disabled', 'true');
    expect(tab).toHaveAccessibleDescription('Available when the run completes.');
  });

  it('a Path beneath row opens that alias’s handle panel on this card; Close returns focus to the row and the details come back on Path beneath (§7)', async () => {
    mount(compareDetail, [compareDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^León Cuero, MX/ }));
    const leon = screen.getByRole('complementary', { name: 'Details for León Cuero' });
    const pathTab = within(leon).getByRole('tab', { name: 'Path beneath' });
    fireEvent.click(pathTab);
    const rowA = within(within(leon).getByRole('tabpanel', { name: 'Path beneath' })).getByRole('button', { name: /^A · IT/ });
    fireEvent.click(rowA);
    const panel = screen.getByRole('complementary', { name: 'Details for supplier A' });
    // the handle is León's own copy of A: the trace role is León's
    expect(within(panel).getByText('binding')).toBeInTheDocument();
    // ruling F3: where row A stood when focus() was called on it. jsdom focuses inside a hidden subtree; a browser does not.
    let hiddenAt: Element | null | undefined;
    const focus = HTMLElement.prototype.focus;
    const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      if (this === rowA) hiddenAt = this.closest('[hidden]');
      focus.call(this, options);
    });
    try {
      fireEvent.click(within(panel).getByRole('button', { name: 'Close handle details' }));
    } finally {
      spy.mockRestore();
    }
    expect(rowA).toHaveFocus();
    // the details were hidden under the handle panel, never unmounted: they come back on Path beneath
    expect(pathTab).toHaveAttribute('aria-selected', 'true');
    // F3: focused only once the details are shown again, never while they were still hidden under the handle panel
    expect(hiddenAt).toBeNull();
    // Escape closes the panel as Close does: back to the row (§6.5)
    fireEvent.click(rowA);
    fireEvent.keyDown(within(screen.getByRole('complementary', { name: 'Details for supplier A' })).getByRole('heading', { name: 'Supplier A · tier 2' }), { key: 'Escape' });
    expect(rowA).toHaveFocus();
    // a new pick opens on Details: the panel is keyed by the pick, and the tab is the panel's own
    fireEvent.click(screen.getByRole('button', { name: /^Mekong Tannery, VN/ }));
    expect(within(screen.getByRole('complementary', { name: 'Details for Mekong Tannery' })).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  });

  it('a handle panel whose opening row has gone closes back to the map handle, never <body>; a pressed map handle pressed again keeps the focus (R7)', async () => {
    mount(compareDetail, [compareDetail.execution]);
    const leonCard = await screen.findByRole('button', { name: /^León Cuero, MX/ });
    const mapA = () => within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ });
    const openFromRowA = () => {
      const leon = screen.getByRole('complementary', { name: 'Details for León Cuero' });
      fireEvent.click(within(leon).getByRole('tab', { name: 'Path beneath' }));
      fireEvent.click(within(within(leon).getByRole('tabpanel', { name: 'Path beneath' })).getByRole('button', { name: /^A · IT/ }));
    };
    fireEvent.click(leonCard);
    openFromRowA();
    // Hide all paths closes the details, and the row with them; the handle panel stays (§6.4)
    fireEvent.click(screen.getByRole('button', { name: 'Hide all paths' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for supplier A' })).getByRole('button', { name: 'Close handle details' }));
    expect(mapA()).toHaveFocus();
    // opened from the row again; the map's handle, pressed while its panel shows, closes it and keeps the focus, whatever opened it
    fireEvent.click(leonCard);
    openFromRowA();
    fireEvent.click(mapA());
    expect(screen.queryByRole('complementary', { name: 'Details for supplier A' })).toBeNull();
    expect(mapA()).toHaveFocus();
  });

  it('Pin keeps the details open and marks the card; selecting another card keeps the pin, and only the active card reads pressed (§6.2)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    const leon = await screen.findByRole('button', { name: /^León Cuero, MX/ });
    // LF-R9: a card's wrapper takes its lane's height from layoutMap, and the pin adds no line to any card
    const heights = () => Array.from(document.querySelectorAll('article')).map((a) => a.parentElement!.style.height);
    const before = heights();
    fireEvent.click(leon);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Pin' }));
    // the details stay open: the card is now both active and pinned
    expect(screen.getByRole('complementary', { name: 'Details for León Cuero' })).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Unpin' })).toBeInTheDocument();
    expect(within(leon.closest('article')!).getByText('Pinned')).toBeInTheDocument();
    // another card becomes the active one; the pin stays
    const mekong = screen.getByRole('button', { name: /^Mekong Tannery, VN/ });
    fireEvent.click(mekong);
    expect(within(leon.closest('article')!).getByText('Pinned')).toBeInTheDocument();
    // aria-pressed is the active card's alone
    expect(leon).toHaveAttribute('aria-pressed', 'false');
    expect(mekong).toHaveAttribute('aria-pressed', 'true');
    // the details are the active card's, and Mekong is not the pinned card
    expect(within(screen.getByRole('complementary', { name: 'Details for Mekong Tannery' })).getByRole('button', { name: 'Pin' })).toBeInTheDocument();
    expect(heights()).toEqual(before);
    // selecting the pinned card makes it the active card too, and it stays pinned (§6.2: the prototype's toggle would unpin it)
    fireEvent.click(leon);
    expect(within(leon.closest('article')!).getByText('Pinned')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Unpin' })).toBeInTheDocument();
    expect(leon).toHaveAttribute('aria-pressed', 'true');
    // Close details closes the active card's details only; the pin stays
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Close details' }));
    expect(within(leon.closest('article')!).getByText('Pinned')).toBeInTheDocument();
    await panelsSettled();
  });

  it('a second Pin replaces the first, and Unpin clears the pin only', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    const leon = await screen.findByRole('button', { name: /^León Cuero, MX/ });
    const mekong = screen.getByRole('button', { name: /^Mekong Tannery, VN/ });
    const details = (name: string) => screen.getByRole('complementary', { name: `Details for ${name}` });
    // Step 4's state: León pinned, Mekong active
    fireEvent.click(leon);
    fireEvent.click(within(details('León Cuero')).getByRole('button', { name: 'Pin' }));
    fireEvent.click(mekong);
    // Pin on Mekong: it replaces León's pin
    fireEvent.click(within(details('Mekong Tannery')).getByRole('button', { name: 'Pin' }));
    expect(within(mekong.closest('article')!).getByText('Pinned')).toBeInTheDocument();
    expect(within(leon.closest('article')!).queryByText('Pinned')).toBeNull();
    // Unpin, on the pinned card's details
    fireEvent.click(within(details('Mekong Tannery')).getByRole('button', { name: 'Unpin' }));
    expect(screen.queryByText('Pinned')).toBeNull();
    // the pin only: Mekong stays the active card, its details open
    expect(details('Mekong Tannery')).toBeInTheDocument();
    await panelsSettled();
  });

  it('the pin is cleared by Hide all paths, by collapsing its lane and by a switch of result; Configure leaves it (§6.2)', async () => {
    // another result of the run: the multitier result again under another id (the stub of the R3 switch pin, with a
    // result whose León can be pinned, so the lines after the switch run on it)
    const other: SmExecutionDetail = { ...multitierDetail, execution: { ...multitierDetail.execution, execution_id: VOMERO_IDS.executionOld, created_at: '2026-09-20T10:00:00.000Z', started_at: '2026-09-20T10:00:00.000Z' } };
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
      if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return reply(200, other);
      if (url.endsWith(`/runs/${VOMERO_IDS.template}`) && init?.method === 'PATCH') return reply(200, { template: DEPTH_4 });
      return reply(404, {});
    });
    mount(multitierDetail, [multitierDetail.execution, other.execution]);
    const leon = () => screen.getByRole('button', { name: /^León Cuero, MX/ });
    const pinLeon = () => {
      fireEvent.click(leon());
      fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Pin' }));
    };
    await screen.findByRole('button', { name: /^León Cuero, MX/ });
    // Hide all paths clears the active card and the pinned card
    pinLeon();
    fireEvent.click(screen.getByRole('button', { name: 'Hide all paths' }));
    expect(screen.queryByText('Pinned')).toBeNull();
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
    // collapsing the pinned card's lane clears the pin, as it clears a selection there; another lane's active card stays
    pinLeon();
    fireEvent.click(screen.getByRole('button', { name: /^Zephyr Compounds, DE/ }));
    // only the pinned card's lane: collapsing another lane (Zephyr's) leaves the pin; Zephyr, closed with it, is selected again
    const zephyrRail = within(screen.getByRole('group', { name: 'Rubber outsoles' })).getByRole('button', { name: 'Rubber outsoles' });
    fireEvent.click(zephyrRail);
    fireEvent.click(zephyrRail);
    expect(within(leon().closest('article')!).getByText('Pinned')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Zephyr Compounds, DE/ }));
    const rail = within(screen.getByRole('group', { name: 'Full grain leather hides' })).getByRole('button', { name: 'Full grain leather hides' });
    fireEvent.click(rail);
    fireEvent.click(rail);
    expect(within(leon().closest('article')!).queryByText('Pinned')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Details for Zephyr Compounds' })).toBeInTheDocument();
    // a switch of result: the pin named a card of the result just replaced
    pinLeon();
    pick(VOMERO_IDS.executionOld);
    await waitFor(() => expect(picked()).toBe(VOMERO_IDS.executionOld));
    expect(screen.queryByText('Pinned')).toBeNull();
    // Configure opened and closed leaves the pin (it closes the details only)
    pinLeon();
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Configure run' })).getByRole('button', { name: 'Close' }));
    expect(within(leon().closest('article')!).getByText('Pinned')).toBeInTheDocument();
    // and so does an Apply
    applyDepthCap4();
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull());
    expect(within(leon().closest('article')!).getByText('Pinned')).toBeInTheDocument();
    // a wait: the new scope's readiness has answered (Run leaves "Checking…")
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).not.toHaveAttribute('aria-disabled'));
  });

  it('with a pin and nothing else open, Escape clears it; before that it closes the details and leaves the pin (§6.5)', async () => {
    mount(multitierDetail, [multitierDetail.execution]);
    const escape = () => fireEvent.keyDown(document.body, { key: 'Escape' });
    const leon = await screen.findByRole('button', { name: /^León Cuero, MX/ });
    fireEvent.click(leon);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Pin' }));
    // the first press closes the details (step 2) and leaves the pin
    escape();
    expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
    expect(within(leon.closest('article')!).getByText('Pinned')).toBeInTheDocument();
    // a path remains, so Hide all paths is still available
    expect(screen.getByRole('button', { name: 'Hide all paths' })).not.toHaveAttribute('aria-disabled');
    // the second press clears the pin (step 4: Hide all paths)
    escape();
    expect(screen.queryByText('Pinned')).toBeNull();
    // the third: nothing is open, so it changes nothing and throws nothing (jsdom reports a listener's throw as an
    // error event on the window, never to the caller)
    const thrown = vi.fn();
    window.addEventListener('error', thrown);
    escape();
    window.removeEventListener('error', thrown);
    expect(thrown).not.toHaveBeenCalled();
    await panelsSettled();
  });

  it('Pin is unavailable with its reason on a running execution and on a card that cannot be pinned; a handle on the pinned card shows its trace role', async () => {
    const throttled = mount(throttledDetail, [throttledDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^León Cuero, MX/ }));
    // a running execution has no projection yet (§9.5)
    const pin = within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Pin' });
    expect(pin).toHaveAttribute('aria-disabled', 'true');
    expect(pin).toHaveAccessibleDescription('Available when the run completes.');
    throttled.unmount();
    // a complete result: Arno timed out, so it never answered and cannot be pinned
    mount(multitierDetail, [multitierDetail.execution]);
    fireEvent.click(await screen.findByRole('button', { name: /^Arno Pelli, IT/ }));
    expect(within(screen.getByRole('complementary', { name: 'Details for Arno Pelli' })).getByRole('button', { name: 'Pin' })).toHaveAccessibleDescription('Nothing was traced beneath this option.');
    // a handle pressed on the pinned card, while another card is active, shows its role on the pinned card's trace
    fireEvent.click(screen.getByRole('button', { name: /^León Cuero, MX/ }));
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Pin' }));
    fireEvent.click(screen.getByRole('button', { name: /^Mekong Tannery, VN/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ }));
    expect(within(screen.getByRole('complementary', { name: 'Details for supplier A' })).getByText('binding')).toBeInTheDocument();
    // Close returns focus to the handle it was pressed on, under the pinned card, never the active card's copy of A
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Details for supplier A' })).getByRole('button', { name: 'Close handle details' }));
    expect(within(screen.getByRole('group', { name: 'Tier 2 under León Cuero' })).getByRole('button', { name: /^A · IT · Dyes/ })).toHaveFocus();
    await panelsSettled();
  });

  describe('"Open map": ?execution=&option= seeds the selection once, on mount (spec §12.1, G-35)', () => {
    const real = withRealKeys(multitierDetail);
    const leon = real.result!.slots[0]!.candidates[0]!;
    const option = `0:${leon.candidate_key}`;
    const leonCard = () => screen.getByRole('button', { name: /^León Cuero, MX/ });

    it('presses the named card and draws its trace when the URL names the loaded execution and a real option key', async () => {
      search.value = new URLSearchParams({ execution: real.execution.execution_id, option }).toString();
      mount(real, [real.execution]);
      expect(await screen.findByRole('button', { name: /^León Cuero, MX/ })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('img', { name: /^Shortfall trace: León Cuero/ })).toBeInTheDocument();
    });

    it('presses nothing when the URL names another execution than the loaded one (the page fell back to the newest)', () => {
      search.value = new URLSearchParams({ execution: VOMERO_IDS.executionOld, option }).toString();
      mount(real, [real.execution]);
      expect(leonCard()).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('img', { name: /^Shortfall trace/ })).toBeNull();
    });

    it('presses nothing, and raises no alert, for an option no candidate has', () => {
      search.value = new URLSearchParams({ execution: real.execution.execution_id, option: '0:["nobody","no-sku"]' }).toString();
      mount(real, [real.execution]);
      expect(leonCard()).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('never matches an SP1-shaped candidate (no candidate_key) by its participant id', () => {
      const sp1 = vomeroDetail.result!.slots[0]!.candidates[0]!;
      search.value = new URLSearchParams({ execution: vomeroDetail.execution.execution_id, option: `0:${sp1.supplier_participant_id}` }).toString();
      mount();
      expect(screen.queryByRole('complementary', { name: /^Details for/ })).toBeNull();
    });

    it('seeds once: after the details are closed, a re-render with the same params selects nothing', async () => {
      search.value = new URLSearchParams({ execution: real.execution.execution_id, option }).toString();
      const view = mount(real, [real.execution]);
      fireEvent.click(within(await screen.findByRole('complementary', { name: 'Details for León Cuero' })).getByRole('button', { name: 'Close details' }));
      view.rerender(<Workspace projectName="Spring 2027" template={vomeroRunTemplate} library={vomeroProducts} executions={[real.execution]} initialDetail={real} />);
      expect(screen.queryByRole('complementary', { name: 'Details for León Cuero' })).toBeNull();
      expect(leonCard()).toHaveAttribute('aria-pressed', 'false');
    });

    it('a switch of result drops ?execution= and ?option= from the URL, keeping the other parameters, so a reload or a copied link opens what the screen shows (I-1)', async () => {
      const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => undefined);
      const old = earlier(VOMERO_IDS.executionOld, '2026-09-20T10:00:00.000Z');
      fetchMock.mockImplementation(async (url: string) => {
        if (url.endsWith('/estimate')) return reply(200, vomeroEstimate);
        if (url.endsWith(`/executions/${VOMERO_IDS.executionOld}`)) return reply(200, old);
        return reply(404, {});
      });
      search.value = new URLSearchParams({ execution: real.execution.execution_id, option, drop: '2027-04-15' }).toString();
      mount(real, [real.execution, old.execution]);
      pick(VOMERO_IDS.executionOld);
      await waitFor(() => expect(picked()).toBe(VOMERO_IDS.executionOld));
      expect(replaceState).toHaveBeenCalledWith(null, '', '/sourcing-map/p/runs/t?drop=2027-04-15');
    });

    it('leaves the URL alone on mount: ?drop= alone selects nothing and rewrites nothing', () => {
      const replaceState = vi.spyOn(window.history, 'replaceState').mockImplementation(() => undefined);
      search.value = 'drop=2027-04-15';
      mount(real, [real.execution]);
      expect(leonCard()).toHaveAttribute('aria-pressed', 'false');
      expect(replaceState).not.toHaveBeenCalled();
    });
  });
});
