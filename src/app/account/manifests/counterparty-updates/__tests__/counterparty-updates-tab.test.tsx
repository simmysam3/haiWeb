import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import CounterpartyUpdatesTab from '../counterparty-updates-tab';
import { renderValue } from '../updates-table';
import type {
  CounterpartyUpdateRow,
  CounterpartyUpdatesList,
  CounterpartySyncState,
} from '@/lib/counterparty-updates-types';

// ---- fixtures --------------------------------------------------------

function makeRow(overrides: Partial<CounterpartyUpdateRow>): CounterpartyUpdateRow {
  return {
    id: 'r1',
    counterparty_participant_id: 'cp1',
    counterparty_name: 'Acme Corp',
    side: 'vendor',
    kind: 'attribute',
    attribute_key: 'payment_terms',
    source: 'profile',
    label: 'Payment Terms',
    mine: 'Net 30',
    theirs: 'Net 45',
    theirs_updated_at: null,
    observed_at: '2026-09-01T00:00:00Z',
    status: 'pending',
    decision: null,
    decision_ref: null,
    decided_by: null,
    decided_at: null,
    dirty: false,
    applied_at: null,
    apply_detail: null,
    ...overrides,
  };
}

function twoDaysAgoIso(): string {
  return new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
}

function makeList(rows: CounterpartyUpdateRow[], overrides?: Partial<CounterpartyUpdatesList>): CounterpartyUpdatesList {
  const counterparties = Array.from(new Set(rows.map((r) => r.counterparty_participant_id))).map((id) => {
    const row = rows.find((r) => r.counterparty_participant_id === id)!;
    return {
      participant_id: id,
      name: row.counterparty_name,
      pending_count: rows.filter((r) => r.counterparty_participant_id === id && r.status === 'pending').length,
    };
  });
  return { rows, sync_state: null, counterparties, ...overrides };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const EMPTY_LIST: CounterpartyUpdatesList = { rows: [], sync_state: null, counterparties: [] };

// With fake timers active, testing-library's findBy*/waitFor polling (which
// itself relies on setTimeout) never fires unless we advance the clock, so
// the sync-now test drains pending promise chains directly instead.
async function flushMicrotasks() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }
  });
}

function stubListOnly(list: CounterpartyUpdatesList) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse(list))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(EMPTY_LIST))));
});

// ---- tests -------------------------------------------------------------

describe('CounterpartyUpdatesTab', () => {
  it('shows a loading line before the first fetch resolves', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<CounterpartyUpdatesTab />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('No counterparty updates.')).toBeNull();
  });

  it('shows an error notice with Retry instead of a false all-clear when the list fetch fails', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('500')));
    vi.stubGlobal('fetch', fetchMock);
    render(<CounterpartyUpdatesTab />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn.?t load/i);
    expect(screen.queryByText('No counterparty updates.')).toBeNull();

    const callsBeforeRetry = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });

  it('renders a group per counterparty with the pending count, distinguished per group', async () => {
    const rows = [
      makeRow({ id: 'r1', counterparty_participant_id: 'cp1', counterparty_name: 'Acme Corp' }),
      makeRow({ id: 'r1b', counterparty_participant_id: 'cp1', counterparty_name: 'Acme Corp', label: 'Website' }),
      makeRow({ id: 'r2', counterparty_participant_id: 'cp2', counterparty_name: 'Globex', label: 'DBA' }),
    ];
    stubListOnly(makeList(rows));
    render(<CounterpartyUpdatesTab />);

    const acmeHeading = await screen.findByRole('heading', { name: /Acme Corp/ });
    const globexHeading = screen.getByRole('heading', { name: /Globex/ });
    expect(acmeHeading).toHaveTextContent('2 pending');
    expect(globexHeading).toHaveTextContent('1 pending');
  });

  it('a row shows label, your value, represented value, and a day-style last updated', async () => {
    const rows = [makeRow({ theirs_updated_at: twoDaysAgoIso() })];
    stubListOnly(makeList(rows));
    render(<CounterpartyUpdatesTab />);

    expect(await screen.findByText('Payment Terms')).toBeInTheDocument();
    expect(screen.getByText('Net 30')).toBeInTheDocument();
    expect(screen.getByText('Net 45')).toBeInTheDocument();
    expect(screen.getByText(/2 days ago/)).toBeInTheDocument();
  });

  it('Keep mine POSTs { keep: "mine" } and the row becomes kept without a refetch', async () => {
    const rows = [makeRow({ id: 'r1' })];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/decide')) {
        expect(url).toContain('/api/account/counterparty-updates/r1/decide');
        expect(JSON.parse(init!.body as string)).toEqual({ keep: 'mine' });
        return Promise.resolve(jsonResponse({ ...rows[0], status: 'kept', decision: 'keep_mine' }));
      }
      return Promise.resolve(jsonResponse(makeList(rows)));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CounterpartyUpdatesTab />);
    await screen.findByText('Payment Terms');

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));

    expect(await screen.findByText('kept')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Take theirs POSTs { keep: "theirs" }', async () => {
    const rows = [makeRow({ id: 'r1' })];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/decide')) {
        expect(JSON.parse(init!.body as string)).toEqual({ keep: 'theirs' });
        return Promise.resolve(jsonResponse({ ...rows[0], status: 'approved', decision: 'take_theirs' }));
      }
      return Promise.resolve(jsonResponse(makeList(rows)));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CounterpartyUpdatesTab />);
    await screen.findByText('Payment Terms');
    fireEvent.click(screen.getByRole('button', { name: 'Take theirs' }));

    expect(await screen.findByText('approved — awaiting your agent')).toBeInTheDocument();
  });

  it('a location row with mine null shows "Not in your ERP" and "Create in ERP"', async () => {
    const rows = [
      makeRow({
        id: 'loc1',
        kind: 'location',
        label: 'Ship-To: Plant 4',
        source: 'locations',
        mine: null,
        theirs: { lines: ['500 Dock Rd'], city: 'Reno', state: 'NV', postal_code: '89501', country: 'US' },
      }),
    ];
    stubListOnly(makeList(rows));
    render(<CounterpartyUpdatesTab />);

    expect(await screen.findByText('Not in your ERP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create in ERP' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take theirs' })).toBeNull();
  });

  it('an ambiguously matched location row (mine: null, the real producer shape) lists candidates, never Create in ERP', async () => {
    // haiClient's differ (packages/reference-agent/src/services/counterparty-sync/differ.ts:338)
    // emits an ambiguous location match as `mine: null` + populated `candidates` —
    // NOT a populated `mine`. The mine===null branch must not shadow this case.
    const rows = [
      makeRow({
        id: 'loc2',
        kind: 'location',
        label: 'Ship-To: Plant 9',
        source: 'locations',
        mine: null,
        theirs: { lines: ['2 Main St'], city: 'Dallas', state: 'TX', postal_code: '75202', country: 'US' },
        candidates: [
          { location_ref: 'L1', name: 'Plant A', city: 'Dallas', state: 'TX' },
          { location_ref: 'L2', name: 'Plant B', city: 'Dallas', state: 'TX' },
        ],
      }),
    ];
    stubListOnly(makeList(rows));
    render(<CounterpartyUpdatesTab />);

    await screen.findByText('Ship-To: Plant 9');
    expect(screen.getByText('Plant A · L1 · Dallas, TX')).toBeInTheDocument();
    expect(screen.getByText('Plant B · L2 · Dallas, TX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument();
    expect(screen.getByText(/suppresses this represented address until it changes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take theirs' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create in ERP' })).toBeNull();
    expect(screen.queryByText('Not in your ERP')).toBeNull();
  });

  it("an identity row's Link POSTs { link: 7 } for the selected candidate", async () => {
    const rows = [
      makeRow({
        id: 'id1',
        kind: 'identity',
        label: 'Counterparty identity',
        source: 'profile',
        mine: null,
        theirs: null,
        candidates: [
          { erp_ref: 7, erp_id: 'V-007', name: 'Acme West', city: 'Reno', state: 'NV', score: 0.9, matched_on: 'name_exact' },
        ],
      }),
    ];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/decide')) {
        expect(JSON.parse(init!.body as string)).toEqual({ link: 7 });
        return Promise.resolve(jsonResponse({ ...rows[0], status: 'approved', decision: 'link' }));
      }
      return Promise.resolve(jsonResponse(makeList(rows)));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CounterpartyUpdatesTab />);
    const label = await screen.findByText('Counterparty identity');
    const row = label.closest('tr')!;

    fireEvent.change(within(row).getByRole('combobox'), { target: { value: '7' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Link' }));

    expect(await screen.findByText('approved — awaiting your agent')).toBeInTheDocument();
  });

  it('an identity row with no candidates shows "No candidate records"', async () => {
    const rows = [
      makeRow({ id: 'id2', kind: 'identity', label: 'Counterparty identity', mine: null, theirs: null, candidates: [] }),
    ];
    stubListOnly(makeList(rows));
    render(<CounterpartyUpdatesTab />);

    expect(await screen.findByText('No candidate records')).toBeInTheDocument();
  });

  it('the write alert appears when all write capabilities are false and an approved row exists, with the verbatim sentence', async () => {
    const rows = [makeRow({ id: 'r1', status: 'approved' })];
    const syncState: CounterpartySyncState = {
      slot_utc: '03:00',
      last_checkin_at: null,
      last_run_id: null,
      last_run_status: null,
      write_capabilities: {
        customer_fields: false,
        vendor_fields: false,
        customer_ship_to: false,
        vendor_purchase_point: false,
      },
      agent_version: null,
      in_flight_since: null,
    };
    stubListOnly(makeList(rows, { sync_state: syncState }));
    render(<CounterpartyUpdatesTab />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Write not allowed — your agent is not permitted to update your ERP. Please update these records directly in your ERP; they will clear on the next refresh.',
    );
  });

  it('the write alert is absent when write capabilities are true', async () => {
    const rows = [makeRow({ id: 'r1', status: 'approved' })];
    const syncState: CounterpartySyncState = {
      slot_utc: '03:00',
      last_checkin_at: null,
      last_run_id: null,
      last_run_status: null,
      write_capabilities: {
        customer_fields: true,
        vendor_fields: false,
        customer_ship_to: false,
        vendor_purchase_point: false,
      },
      agent_version: null,
      in_flight_since: null,
    };
    stubListOnly(makeList(rows, { sync_state: syncState }));
    render(<CounterpartyUpdatesTab />);

    await screen.findByText('Payment Terms');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the write alert is absent when sync_state is null even though an approved row exists', async () => {
    const rows = [makeRow({ id: 'r1', status: 'approved' })];
    stubListOnly(makeList(rows, { sync_state: null }));
    render(<CounterpartyUpdatesTab />);

    await screen.findByText('Payment Terms');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an approved && dirty row renders its own apply_detail in the Why cell and not the generic banner', async () => {
    const rows = [
      makeRow({
        id: 'r1',
        kind: 'location',
        status: 'approved',
        dirty: true,
        apply_detail: 'your agent may create a location in your ERP but not change an existing one …',
      }),
    ];
    const syncState: CounterpartySyncState = {
      slot_utc: '03:00',
      last_checkin_at: null,
      last_run_id: null,
      last_run_status: null,
      write_capabilities: {
        customer_fields: true,
        vendor_fields: false,
        customer_ship_to: false,
        vendor_purchase_point: false,
      },
      agent_version: null,
      in_flight_since: null,
    };
    stubListOnly(makeList(rows, { sync_state: syncState }));
    render(<CounterpartyUpdatesTab />);

    expect(await screen.findByText(/your agent may create a location in your ERP/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('an approved && dirty row renders BOTH its own apply_detail and the generic banner when capabilities are all false', async () => {
    const rows = [
      makeRow({
        id: 'r1',
        kind: 'location',
        status: 'approved',
        dirty: true,
        apply_detail: 'your agent may create a location in your ERP but not change an existing one …',
      }),
    ];
    const syncState: CounterpartySyncState = {
      slot_utc: '03:00',
      last_checkin_at: null,
      last_run_id: null,
      last_run_status: null,
      write_capabilities: {
        customer_fields: false,
        vendor_fields: false,
        customer_ship_to: false,
        vendor_purchase_point: false,
      },
      agent_version: null,
      in_flight_since: null,
    };
    stubListOnly(makeList(rows, { sync_state: syncState }));
    render(<CounterpartyUpdatesTab />);

    expect(await screen.findByText(/your agent may create a location in your ERP/)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('Sync all now POSTs sync-now, shows "Sync started", disables itself, and re-fetches until last_run_id changes', async () => {
    vi.useFakeTimers();
    let listCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/sync-now')) {
        return Promise.resolve(jsonResponse({ status: 'started', run_id: 'run-9' }));
      }
      listCalls += 1;
      const last_run_id = listCalls >= 4 ? 'run-9' : null;
      const syncState: CounterpartySyncState = {
        slot_utc: '03:00',
        last_checkin_at: null,
        last_run_id,
        last_run_status: null,
        write_capabilities: null,
        agent_version: null,
        in_flight_since: null,
      };
      return Promise.resolve(jsonResponse(makeList([], { sync_state: syncState })));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CounterpartyUpdatesTab />);
    await flushMicrotasks();

    const button = screen.getByRole('button', { name: 'Sync all now' });
    await act(async () => {
      fireEvent.click(button);
    });
    await flushMicrotasks();

    expect(screen.getByText('Sync started')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync all now' })).toBeDisabled();

    const callsAfterStart = listCalls;

    // First poll tick: last_run_id still null -> keeps polling.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();
    expect(listCalls).toBe(callsAfterStart + 1);
    expect(screen.getByRole('button', { name: 'Sync all now' })).toBeDisabled();

    // Second poll tick: last_run_id changes to 'run-9' -> polling stops.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await flushMicrotasks();
    expect(listCalls).toBe(callsAfterStart + 2);
    expect(screen.getByRole('button', { name: 'Sync all now' })).not.toBeDisabled();

    // No further polling once stopped.
    const callsAfterStop = listCalls;
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await flushMicrotasks();
    expect(listCalls).toBe(callsAfterStop);
  });

  it.each([
    ['already_running', 'A sync is already running'],
    ['no_endpoint', 'Your agent has not registered an endpoint yet'],
    ['agent_unreachable', 'Your agent could not be reached'],
  ] as const)('Sync all now shows the verbatim message for %s', async (status, message) => {
    stubListOnly(EMPTY_LIST);
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (typeof url === 'string' && url.includes('/sync-now')) {
          return Promise.resolve(jsonResponse({ status }));
        }
        return Promise.resolve(jsonResponse(EMPTY_LIST));
      }),
    );
    render(<CounterpartyUpdatesTab />);
    await screen.findByText('No counterparty updates.');

    fireEvent.click(screen.getByRole('button', { name: 'Sync all now' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync all now' })).not.toBeDisabled();
  });

  it('filter changes the query string and rows reflect the new response', async () => {
    const pendingRows = [makeRow({ id: 'r1', label: 'Pending Attribute' })];
    const allRows = [
      makeRow({ id: 'r1', label: 'Pending Attribute' }),
      makeRow({ id: 'r2', label: 'Kept Attribute', status: 'kept' }),
    ];
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('status=all')) {
        return Promise.resolve(jsonResponse(makeList(allRows)));
      }
      return Promise.resolve(jsonResponse(makeList(pendingRows)));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CounterpartyUpdatesTab />);
    await screen.findByText('Pending Attribute');
    expect(screen.queryByText('Kept Attribute')).toBeNull();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });

    expect(await screen.findByText('Kept Attribute')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('status=all'))).toBe(true);
  });

  it('a 409 on decide reverts the row and toasts', async () => {
    const rows = [makeRow({ id: 'r1' })];
    let resolveDecide!: (value: Response) => void;
    const decidePromise = new Promise<Response>((resolve) => {
      resolveDecide = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/decide')) {
        return decidePromise;
      }
      return Promise.resolve(jsonResponse(makeList(rows)));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CounterpartyUpdatesTab />);
    await screen.findByText('Payment Terms');

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));

    // Optimistic: the row already reads "kept" while the POST is in flight.
    expect(await screen.findByText('kept')).toBeInTheDocument();

    await act(async () => {
      resolveDecide(jsonResponse({ error: 'conflict' }, 409));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText('pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take theirs' })).toBeInTheDocument();
    expect(screen.getByText(/Could not save/)).toBeInTheDocument();
  });
});

describe('renderValue', () => {
  it('renders null/undefined as an em dash', () => {
    render(<>{renderValue(null)}</>);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders numbers with locale grouping', () => {
    render(<>{renderValue(1234567)}</>);
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('renders { amount_usd } as a dollar figure with grouping', () => {
    render(<>{renderValue({ amount_usd: 5_000_000 })}</>);
    expect(screen.getByText('$5,000,000')).toBeInTheDocument();
  });

  it('renders booleans as Yes/No', () => {
    render(
      <>
        <div>{renderValue(true)}</div>
        <div>{renderValue(false)}</div>
      </>,
    );
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders an address tuple as two lines', () => {
    render(
      <>{renderValue({ lines: ['500 Dock Rd'], city: 'Reno', state: 'NV', postal_code: '89501', country: 'US' })}</>,
    );
    expect(screen.getByText('500 Dock Rd')).toBeInTheDocument();
    expect(screen.getByText('Reno, NV, 89501 US')).toBeInTheDocument();
  });

  it('renders any other object as JSON in a <code> element', () => {
    render(<>{renderValue({ weird: 'shape' })}</>);
    const code = screen.getByText('{"weird":"shape"}');
    expect(code.tagName).toBe('CODE');
  });
});
