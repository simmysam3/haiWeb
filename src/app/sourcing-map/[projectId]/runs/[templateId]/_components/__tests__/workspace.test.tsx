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
type SwrOptions = { onError?(e: unknown, key: string): void };
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
  await waitFor(() => expect(run).toBeEnabled());
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

function pick(id: string) {
  fireEvent.change(screen.getByLabelText('Result'), { target: { value: id } });
}

describe('Workspace', () => {
  it('reads the as-of drop from ?drop= and writes a clicked drop back to the URL (spec §9.3)', async () => {
    search.value = 'drop=2027-04-15';
    mount();
    const leather = screen.getByRole('group', { name: 'Full grain leather hides' });
    expect(within(leather).getByText('16,000 sq ft by Mar 22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jan 15 100%' }));
    expect(replace).toHaveBeenCalledWith('/sourcing-map/p/runs/t?drop=2027-01-15', { scroll: false });
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
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
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
    await waitFor(() => expect(run).toBeEnabled());
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
    await waitFor(() => expect(run).toBeEnabled());
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    applyDepthCap4();
    await waitFor(() => expect(estimates).toBe(2));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Configure run' })).toBeNull());
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
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
});
