import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { ForecastList } from '../_components/forecast-list';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();

const TEMPLATE = {
  template_id: 'tpl-a2000',
  initiator_participant_id: '11111111-1111-4111-8111-111111111111',
  template_name: 'a2000 2027 program',
  observation_class: 'grounded_forecast',
  scope: {
    kind: 'grounded_forecast',
    product_name: 'a2000',
    analogue_skus: ['A1000-BLK'],
    bom_lines: [
      { component_sku: 'SOLE-XR9', product_class_id: 'cpt_sole_compound', qty_per_unit: 2 },
    ],
    assembly_days: 21,
    profile: { monthly_qty: 100000, start_month: '2027-01', end_month: '2027-12' },
  },
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 90,
  created_at: '2026-07-01T00:00:00.000Z',
  created_by_user_id: '22222222-2222-4222-8222-222222222222',
  last_run_id: '33333333-3333-4333-8333-333333333333',
  last_run_at: THREE_DAYS_AGO,
};

// A never-run forecast — the state every forecast starts in, and the one the
// row must not render as an empty cell.
const NEVER_RUN = {
  ...TEMPLATE,
  template_id: 'tpl-fresh',
  template_name: 'g-force prototype',
  scope: {
    ...TEMPLATE.scope,
    product_name: 'g-force',
    profile: { monthly_qty: 2500, start_month: '2027-03', end_month: '2027-05' },
  },
  last_run_id: null,
  last_run_at: null,
};

function renderList() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ForecastList />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('<ForecastList>', () => {
  it('renders a row per forecast with product, demand profile and last-run time', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ templates: [TEMPLATE, NEVER_RUN] })));
    renderList();

    await screen.findByText('a2000 2027 program');
    expect(screen.getByText('a2000')).toBeInTheDocument();
    // Demand profile reads as one phrase: rate, then the months it spans.
    expect(screen.getByText('100,000/mo · 2027-01 → 2027-12')).toBeInTheDocument();
    expect(screen.getByText('2,500/mo · 2027-03 → 2027-05')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
    expect(screen.getByText('Never run')).toBeInTheDocument();
  });

  it('offers view / run now / configure / delete on every row', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ templates: [TEMPLATE] })));
    renderList();

    await screen.findByText('a2000 2027 program');

    const view = screen.getByRole('link', { name: /view/i });
    expect(view).toHaveAttribute('href', '/account/sonar/grounded-forecasts/tpl-a2000');
    // Configure rides the generic run-template page — a forecast IS a template.
    const configure = screen.getByRole('link', { name: /configure/i });
    expect(configure).toHaveAttribute('href', '/account/sonar/templates/tpl-a2000');
    expect(screen.getByRole('button', { name: /run now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('runs a forecast through the generic trigger route, then opens its result page', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ templates: [TEMPLATE] }));
    vi.stubGlobal('fetch', fetchMock);
    renderList();

    await screen.findByText('a2000 2027 program');
    fireEvent.click(screen.getByRole('button', { name: /run now/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/account/sonar/templates/tpl-a2000/trigger',
        { method: 'POST' },
      );
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/account/sonar/grounded-forecasts/tpl-a2000');
    });
  });

  it('confirms deletion inline — never through a browser confirm() dialog', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ templates: [TEMPLATE] }));
    vi.stubGlobal('fetch', fetchMock);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderList();

    await screen.findByText('a2000 2027 program');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    // First click arms the confirmation in the row; nothing is sent yet.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1); // the list load only
    const confirmButton = await screen.findByRole('button', { name: /confirm delete/i });
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/account/sonar/templates/tpl-a2000',
        { method: 'DELETE' },
      );
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('backs out of a delete without sending anything', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ templates: [TEMPLATE] }));
    vi.stubGlobal('fetch', fetchMock);
    renderList();

    await screen.findByText('a2000 2027 program');
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }));

    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a create call to action when no forecasts exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ templates: [] })));
    renderList();

    const cta = await screen.findByRole('link', { name: /new forecast/i });
    expect(cta).toHaveAttribute('href', '/account/sonar/grounded-forecasts/new');
    expect(screen.getByText(/first grounded forecast/i)).toBeInTheDocument();
  });

  it('surfaces the server message when a run cannot be started', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse({ error: { code: 'AGENT_UNREACHABLE', message: 'Your agent is offline.' } }, 503)
        : jsonResponse({ templates: [TEMPLATE] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderList();

    await screen.findByText('a2000 2027 program');
    fireEvent.click(screen.getByRole('button', { name: /run now/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Your agent is offline.');
    expect(pushMock).not.toHaveBeenCalled();
  });
});
