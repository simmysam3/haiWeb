import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForecastWizard } from '../_components/forecast-wizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const CREATE_URL = '/api/account/sonar/grounded-forecasts';
const BOM_SEED_PREFIX = '/api/account/sonar/grounded-forecasts/bom-seed?sku=';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
  vi.stubGlobal('fetch', fetchMock);
});

/** Route the wizard's three fetches; anything unhandled falls back to ok/{}.  */
function routeFetches({
  bomSeed,
  trigger,
}: {
  bomSeed: { ok: boolean; status?: number; lines?: unknown[] };
  trigger?: { ok: boolean; status?: number };
}) {
  fetchMock.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.startsWith(BOM_SEED_PREFIX)) {
      return Promise.resolve({
        ok: bomSeed.ok,
        status: bomSeed.status ?? 200,
        json: async () =>
          bomSeed.ok
            ? { lines: bomSeed.lines ?? [] }
            : { error: { code: 'BOM_UNAVAILABLE' } },
      } as Response);
    }
    if (url === CREATE_URL) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ template: { template_id: 'tpl-1' } }),
      } as Response);
    }
    if (typeof url === 'string' && url.endsWith('/trigger')) {
      const t = trigger ?? { ok: true };
      // describeApiError reads res.clone().json(), so the failure shape
      // must survive a clone; re-serving the same object is fine here.
      const res = {
        ok: t.ok,
        status: t.status ?? (t.ok ? 200 : 500),
        json: async () =>
          t.ok
            ? { run_id: 'run-1' }
            : { error: { code: 'RUN_FAILED', message: 'agent unreachable' } },
        clone() {
          return res;
        },
      };
      return Promise.resolve(res as unknown as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
}

/** Fill every step with the canonical valid form (bom-seed routed to 404 → manual lines). */
async function fillValidForm() {
  await userEvent.type(screen.getByLabelText(/Forecast name/i), 'a2000 forecast');
  await userEvent.type(screen.getByLabelText('Product name'), 'a2000');
  await userEvent.type(screen.getByLabelText('Primary analogue SKU'), 'A1000-BLK');
  await userEvent.tab();
  await screen.findByText('No BOM on file for A1000-BLK — enter lines manually');

  await userEvent.type(screen.getByLabelText('Component SKU 1'), 'SOLE-XR9');
  await userEvent.type(screen.getByLabelText('Product class 1'), 'cpt_sole_compound');
  await userEvent.type(screen.getByLabelText('Qty per unit 1'), '2');
  await userEvent.type(screen.getByLabelText('Assembly days'), '21');
  await userEvent.type(screen.getByLabelText('Monthly quantity'), '100000');
  await userEvent.type(screen.getByLabelText('Start month'), '2027-01');
  await userEvent.type(screen.getByLabelText('End month'), '2027-12');
}

describe('<ForecastWizard>', () => {
  it('marks the identity step as an error and does not POST when submitted with an empty name', async () => {
    render(<ForecastWizard />);

    await userEvent.click(screen.getByRole('button', { name: /^Save forecast$/i }));

    // The rail entry's badge flips to '!' — the RailStep error state.
    expect(screen.getByRole('button', { name: 'Identity' })).toHaveTextContent('!');
    // Nothing was sent anywhere — validation is imperative and local.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks the identity step as an error and does not POST when the forecast name is filled but the product name is blank', async () => {
    render(<ForecastWizard />);

    await userEvent.type(screen.getByLabelText(/Forecast name/i), 'a2000 forecast');
    await userEvent.click(screen.getByRole('button', { name: /^Save forecast$/i }));

    // The identity step must flag the missing product name inline — otherwise
    // an empty product_name reaches the BFF and bounces as a raw 400.
    expect(screen.getByRole('button', { name: 'Identity' })).toHaveTextContent('!');
    // Scoped to the step alert — the sticky bar echoes the same text.
    expect(
      screen.getByText('Product name is required.', { selector: '[role="alert"]' }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the bom-seed when the primary analogue is set and populates the BOM rows', async () => {
    routeFetches({
      bomSeed: {
        ok: true,
        lines: [
          { component_sku: 'SOLE-XR9', product_class_id: 'cpt_sole_compound', qty_per_unit: 2 },
          { component_sku: 'AIR-B7', product_class_id: 'cpt_air_bladder', qty_per_unit: 1 },
        ],
      },
    });
    render(<ForecastWizard />);

    await userEvent.type(screen.getByLabelText('Primary analogue SKU'), 'A1000-BLK');
    await userEvent.tab();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`${BOM_SEED_PREFIX}A1000-BLK`);
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Component SKU 1')).toHaveValue('SOLE-XR9');
    });
    expect(screen.getByLabelText('Product class 1')).toHaveValue('cpt_sole_compound');
    expect(screen.getByLabelText('Qty per unit 1')).toHaveValue(2);
    expect(screen.getByLabelText('Component SKU 2')).toHaveValue('AIR-B7');
  });

  it('shows the manual-entry message on bom-seed 404 and leaves the BOM step editable', async () => {
    routeFetches({ bomSeed: { ok: false, status: 404 } });
    render(<ForecastWizard />);

    await userEvent.type(screen.getByLabelText('Primary analogue SKU'), 'A1000-BLK');
    await userEvent.tab();

    expect(
      await screen.findByText('No BOM on file for A1000-BLK — enter lines manually'),
    ).toBeInTheDocument();
    // Manual entry is never blocked: the line inputs and the add affordance stay live.
    expect(screen.getByLabelText('Component SKU 1')).toBeEnabled();
    expect(screen.getByRole('button', { name: /Add BOM line/i })).toBeEnabled();
  });

  it('POSTs a create body with no observation_class and a grounded_forecast scope carrying every entered field', async () => {
    routeFetches({ bomSeed: { ok: false, status: 404 } });
    render(<ForecastWizard />);

    await fillValidForm();

    await userEvent.click(screen.getByRole('button', { name: /^Save forecast$/i }));

    const createCall = fetchMock.mock.calls.find((c) => c[0] === CREATE_URL);
    expect(createCall).toBeDefined();
    expect(createCall![1]?.method).toBe('POST');
    const body = JSON.parse(createCall![1]!.body as string);
    // The server forces the class; the client must not claim it.
    expect(body.observation_class).toBeUndefined();
    expect(body.template_name).toBe('a2000 forecast');
    expect(body.cadence).toEqual({ kind: 'manual_only' });
    // Both are required by CreateRunTemplateRequestSchema — dropping either
    // makes every real create 400 at the BFF.
    expect(body.enabled).toBe(true);
    expect(body.retention_days).toBe(365);
    expect(body.scope).toEqual({
      kind: 'grounded_forecast',
      product_name: 'a2000',
      analogue_skus: ['A1000-BLK'],
      bom_lines: [
        { component_sku: 'SOLE-XR9', product_class_id: 'cpt_sole_compound', qty_per_unit: 2 },
      ],
      assembly_days: 21,
      profile: { monthly_qty: 100000, start_month: '2027-01', end_month: '2027-12' },
    });
  });

  it('never re-POSTs the create when retried after a failed initial run — only the run is retried', async () => {
    routeFetches({ bomSeed: { ok: false, status: 404 }, trigger: { ok: false, status: 500 } });
    render(<ForecastWizard />);

    await fillValidForm();
    await userEvent.click(screen.getByLabelText(/Run immediately after saving/i));

    const createCalls = () => fetchMock.mock.calls.filter((c) => c[0] === CREATE_URL);
    const triggerCalls = () =>
      fetchMock.mock.calls.filter(
        (c) => typeof c[0] === 'string' && (c[0] as string).endsWith('/trigger'),
      );

    await userEvent.click(screen.getByRole('button', { name: /^Save & run now$/i }));
    await screen.findByText(/Forecast saved but the initial run failed/);
    expect(createCalls()).toHaveLength(1);
    expect(triggerCalls()).toHaveLength(1);

    // tpl-1 already exists — a second click must retry ONLY the run,
    // never POST a second identical template.
    await userEvent.click(screen.getByRole('button', { name: /^Save & run now$/i }));
    await waitFor(() => {
      expect(triggerCalls()).toHaveLength(2);
    });
    expect(createCalls()).toHaveLength(1);
    expect(triggerCalls()[1]![0]).toBe('/api/account/sonar/templates/tpl-1/trigger');
  });

  it('caps the analogues at three — a fourth input is not addable', async () => {
    render(<ForecastWizard />);

    const add = screen.getByRole('button', { name: /Add analogue/i });
    await userEvent.click(add);
    await userEvent.click(add);

    expect(screen.getByLabelText('Analogue SKU 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Analogue SKU 3')).toBeInTheDocument();
    expect(add).toBeDisabled();
    expect(screen.queryByLabelText('Analogue SKU 4')).not.toBeInTheDocument();
  });
});
