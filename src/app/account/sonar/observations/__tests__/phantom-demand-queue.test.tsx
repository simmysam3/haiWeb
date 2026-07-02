import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { PhantomDemandQueue } from '../_components/phantom-demand-queue';

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const QUEUE = {
  configs: [
    {
      template_id: 't-own',
      template_name: 'HC-9000 spot',
      sku: 'HC-9000',
      source: 'own',
      counterparty_id: null,
      last_run: {
        run_id: 'run-1',
        status: 'completed',
        created_at: new Date(Date.now() - 120_000).toISOString(),
        completed_at: new Date().toISOString(),
      },
    },
    {
      template_id: 't-cp',
      template_name: 'Summit PCB probe',
      sku: 'SUMMIT-PCB-12',
      source: 'counterparty',
      counterparty_id: 'cp-1',
      last_run: null,
    },
  ],
};

function renderQueue() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PhantomDemandQueue />
    </SWRConfig>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('PhantomDemandQueue', () => {
  it('renders source badges and gates Output on a completed run', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(QUEUE)));
    renderQueue();

    await screen.findByText('HC-9000 spot');
    // Internal (own/BOM) + Supplier (counterparty/SKU) badges.
    expect(screen.getByText(/internal · bom/i)).toBeInTheDocument();
    expect(screen.getByText(/supplier · sku/i)).toBeInTheDocument();

    // Completed own row → Output is a real link to the run detail.
    const outputLink = screen.getByRole('link', { name: /output/i });
    expect(outputLink).toHaveAttribute(
      'href',
      '/account/sonar/phantom-demand/runs/run-1',
    );

    // The counterparty config has never run.
    expect(screen.getByText(/never run/i)).toBeInTheDocument();
  });

  it('Re-run posts to the template trigger endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(QUEUE));
    vi.stubGlobal('fetch', fetchMock);
    renderQueue();

    await screen.findByText('HC-9000 spot');
    fireEvent.click(screen.getByText(/↻ re-run/i));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/account/sonar/templates/t-own/trigger',
        { method: 'POST' },
      );
    });
  });

  it('Status column shows the readiness verdict (worst-component outcome), not the run lifecycle status', async () => {
    const queue = {
      configs: [
        {
          template_id: 't-own',
          template_name: 'Vomero readiness — Pegasus',
          sku: 'PEGASUS-TRAIL-CLAY',
          source: 'own',
          counterparty_id: null,
          last_run: {
            run_id: 'run-1',
            status: 'completed',
            readiness_verdict: 'not_ready',
            created_at: new Date(Date.now() - 120_000).toISOString(),
            completed_at: new Date().toISOString(),
          },
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(queue)));
    renderQueue();

    await screen.findByText('Vomero readiness — Pegasus');
    // The adopted status is the worst subcomponent flag → "Not ready".
    expect(screen.getByText('Not ready')).toBeInTheDocument();
    // The run lifecycle word must NOT be shown as the status.
    expect(screen.queryByText('completed')).not.toBeInTheDocument();
  });

  it('shows a live "Running" indicator instead of an Output link while a run is in flight', async () => {
    const queue = {
      configs: [
        {
          template_id: 't-own',
          template_name: 'Vomero readiness — Pegasus',
          sku: 'PEGASUS-TRAIL-CLAY',
          source: 'own',
          counterparty_id: null,
          last_run: {
            run_id: 'run-live',
            status: 'running',
            readiness_verdict: null,
            created_at: new Date(Date.now() - 10_000).toISOString(),
            completed_at: null,
          },
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(queue)));
    renderQueue();

    await screen.findByText('Vomero readiness — Pegasus');
    // While running the output is not yet available → shown as a live status,
    // not a link.
    const running = screen.getByText(/running/i);
    expect(running).toBeInTheDocument();
    expect(running.closest('a')).toBeNull();
    // No navigable Output link exists while the run is in flight.
    expect(screen.queryByRole('link', { name: /output/i })).not.toBeInTheDocument();
  });

  it('surfaces a failed run in the Status column instead of hiding it', async () => {
    const queue = {
      configs: [
        {
          template_id: 't-own',
          template_name: 'Vomero readiness — Pegasus',
          sku: 'PEGASUS-TRAIL-CLAY',
          source: 'own',
          counterparty_id: null,
          last_run: {
            run_id: 'run-x',
            status: 'failed',
            readiness_verdict: null,
            created_at: new Date(Date.now() - 30_000).toISOString(),
            completed_at: new Date().toISOString(),
          },
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(queue)));
    renderQueue();

    await screen.findByText('Vomero readiness — Pegasus');
    // A failed run has no readiness outcome, but it must not be swallowed to a
    // bare em-dash — the worst-case adopted status surfaces the failure.
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('clears a config’s runs via the trash action (only when it has runs)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(QUEUE));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderQueue();

    await screen.findByText('HC-9000 spot');
    // Only the config with a run (t-own) shows the trash; the never-run one doesn't.
    const trash = screen.getAllByRole('button', { name: /clear run history/i });
    expect(trash).toHaveLength(1);

    fireEvent.click(trash[0]);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/account/sonar/phantom-demand/runs?template_id=t-own',
        { method: 'DELETE' },
      );
    });
  });
});
