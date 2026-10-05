import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { leonPanel, partialPanel, uncoveredPanel } from '@/app/sourcing-map/__fixtures__/sp3';
import { p90Panel } from '@/app/sourcing-map/__fixtures__/lf';
import { OptionPanel } from '../option-panel';

const EXEC = 'e1000000-0000-4000-8000-000000000001';
const LEON = '5a1e0000-0000-4000-8000-000000000101';
const fetchMock = vi.fn();
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  performance.clearMarks();
  performance.clearMeasures();
});
afterEach(() => vi.unstubAllGlobals());

function answer(status: number, body?: unknown) {
  fetchMock.mockImplementation(async () => reply(status, body));
}
async function settled(candidateKey: string | null = LEON) {
  const view = render(<OptionPanel executionId={EXEC} candidateKey={candidateKey} />);
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
  return view;
}
function rowLabels() {
  const list = screen.getByRole('list', { name: 'Scorecard dimensions' });
  return within(list).getAllByRole('listitem').map((li) => li.textContent ?? '');
}

describe('OptionPanel', () => {
  it('shows Loading… under both headings until the answer lands', async () => {
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    render(<OptionPanel executionId={EXEC} candidateKey={LEON} />);
    expect(screen.getByRole('heading', { name: 'Network-wide scorecard (not specific to you)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delivery history' })).toBeInTheDocument();
    expect(screen.getAllByText('Loading…')).toHaveLength(2);
  });

  it('Leon: four dimension rows in the served order, exactly two tagged provisional', async () => {
    answer(200, leonPanel);
    await settled();
    expect(rowLabels()).toEqual([
      'Fulfillment reliability · 94%', 'Response time · 88%', 'Price adherence · 50% · provisional', 'Agent uptime · 50% · provisional',
    ]);
    expect(screen.getAllByText('provisional')).toHaveLength(2);
  });

  it('Leon: the calibrated median with its order count, and one event line', async () => {
    answer(200, leonPanel);
    await settled();
    expect(screen.getByText('Calibrated median: 42 d (4 orders)')).toBeInTheDocument();
    expect(screen.getByText('delivered · Jul 24, 2026 · SHIP-LEON-1000')).toBeInTheDocument();
  });

  it('Delivery history shows the p90 beside the p50 when the panel serves it', async () => {
    answer(200, p90Panel);
    await settled();
    const history = screen.getByRole('region', { name: 'Delivery history' });
    expect(within(history).getByText('Calibrated p50: 30 d · p90: 45 d')).toBeInTheDocument();
  });

  it('Partial: three rows, no Response time, and Delivery history reads Unavailable', async () => {
    answer(200, partialPanel);
    await settled();
    expect(rowLabels()).toHaveLength(3);
    expect(screen.queryByText(/Response time/)).toBeNull();
    const history = screen.getByRole('region', { name: 'Delivery history' });
    expect(within(history).getByText('Unavailable')).toBeInTheDocument();
  });

  it('Uncovered: no Delivery history section at all', async () => {
    answer(200, uncoveredPanel);
    await settled();
    expect(rowLabels()).toHaveLength(4);
    expect(screen.queryByRole('heading', { name: 'Delivery history' })).toBeNull();
  });

  it('a 500 reads Unavailable under both headings', async () => {
    answer(500, { error: 'boom' });
    await settled();
    expect(within(screen.getByRole('region', { name: 'Network-wide scorecard (not specific to you)' })).getByText('Unavailable')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Delivery history' })).getByText('Unavailable')).toBeInTheDocument();
  });

  it('a fetch rejection reads Unavailable under both headings', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await settled();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  });

  it('a null candidate key sends no request and reads Unavailable under both headings', async () => {
    await settled(null);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
  });

  it('requests the panel path once, encoded once', async () => {
    answer(200, leonPanel);
    const KEY = JSON.stringify([LEON, 'A/B "x"']);
    await settled(KEY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(new RegExp(`/executions/${EXEC}/options/${escapeRe(encodeURIComponent(KEY))}/panel$`));
  });

  it('never renders keys the wire carries beyond the four dimensions', async () => {
    answer(200, { ...leonPanel, scorecard: { ...leonPanel.scorecard, composite_score: 0.8, label: 'Good', trust_tier: 'Network Verified' } });
    const { container } = await settled();
    for (const s of ['0.8', 'Good', 'Network Verified', 'Composite']) expect(container.textContent).not.toContain(s);
  });

  it('a late answer never lands on another key', async () => {
    let release: (v: unknown) => void = () => undefined;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/K1/')) return new Promise((res) => { release = res; });
      return reply(200, partialPanel);
    });
    const { rerender } = render(<OptionPanel executionId={EXEC} candidateKey="K1" />);
    rerender(<OptionPanel executionId={EXEC} candidateKey="K2" />);
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
    expect(rowLabels()).toHaveLength(3);
    release(reply(200, leonPanel));
    await new Promise((r) => setTimeout(r, 10));
    expect(rowLabels()).toHaveLength(3);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('measures sm-panel-open exactly once, and only after the panel settles', async () => {
    let release: (v: unknown) => void = () => undefined;
    fetchMock.mockImplementation(() => new Promise((res) => { release = res; }));
    render(<OptionPanel executionId={EXEC} candidateKey={LEON} />);
    expect(screen.getAllByText('Loading…')).toHaveLength(2);
    expect(performance.getEntriesByName('sm-panel-open')).toHaveLength(0);
    release(reply(200, leonPanel));
    await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull());
    expect(performance.getEntriesByName('sm-panel-open')).toHaveLength(1);
  });
});

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
