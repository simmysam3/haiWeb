import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { supplyRisksList, riskOf } from '@/app/sourcing-map/__fixtures__/sp3';
import { openMapHref } from '@/lib/sourcing-map/backlogs';
import type { SmSupplyRiskListResponse } from '@/lib/sourcing-map/types';

import { SupplyRisksTable } from '../_components/supply-risks-table';

const LEON = supplyRisksList.risks[0]!;
const URL_OF = (id: string) => `/api/account/sourcing-map/supply-risks/${id}`;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(name) });
}

let fetchMock: ReturnType<typeof vi.fn>;

function renderTable(over: Partial<{ initial: SmSupplyRiskListResponse; nextHref: string | null }> = {}) {
  return render(<SupplyRisksTable initial={over.initial ?? supplyRisksList} nextHref={over.nextHref ?? null} />);
}

describe('SupplyRisksTable', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads León's row: supplier, requested / covered, origin, status select", () => {
    renderTable();
    const row = rowOf('León Cuero');
    expect(within(row).getByText('13,000 / 9,821')).toBeInTheDocument();
    expect(within(row).getByText('tier 2 · Chemicals · IT · moderate')).toBeInTheDocument();
    expect(within(row).getByLabelText('Status for León Cuero')).toHaveValue('open');
  });

  it('gives each row its own figures (R-4)', () => {
    renderTable();
    expect(within(rowOf('FlowKnit Mills')).getByText('11,000 / 8,200')).toBeInTheDocument();
    expect(within(rowOf('Mekong Tannery')).getByText('4,000 / 2,500')).toBeInTheDocument();
  });

  it('shows the slot label over its products', () => {
    renderTable();
    const row = rowOf('FlowKnit Mills');
    expect(within(row).getByText('Polyester knit uppers')).toBeInTheDocument();
    expect(within(row).getByText('Pegasus Trail, Court Classic')).toBeInTheDocument();
  });

  it('a closed row has no controls: the accepted row reads as text', () => {
    renderTable();
    const row = rowOf('FlowKnit Mills');
    expect(within(row).queryByRole('combobox')).toBeNull();
    expect(within(row).queryByRole('textbox')).toBeNull();
    expect(within(row).getByText('Accepted')).toBeInTheDocument();
    expect(within(row).getByText('Accepted: the shortfall is inside our safety stock.')).toBeInTheDocument();
    expect(within(row).getByText('Nov 2, 2026')).toBeInTheDocument();
  });

  it('the auto-cleared row has no Open map link and shows a dash', () => {
    renderTable();
    const row = rowOf('Mekong Tannery');
    expect(within(row).queryByRole('link', { name: 'Open map' })).toBeNull();
    expect(within(row).getAllByRole('cell').at(-1)!.textContent).toBe('—');
  });

  it("León's Open map link is the run with its query", () => {
    renderTable();
    expect(within(rowOf('León Cuero')).getByRole('link', { name: 'Open map' })).toHaveAttribute('href', openMapHref(LEON.open_map!));
  });

  it('shows no internal identifier', () => {
    const { container } = renderTable();
    expect(container.textContent).not.toMatch(/cpt_|binding_|signature/);
  });

  it('an empty list says so', () => {
    renderTable({ initial: { risks: [], open_count: 0, next_cursor: null } });
    expect(screen.getByText('No supply risks.')).toBeInTheDocument();
  });

  it('Show older links only when there is a next page', () => {
    const { unmount } = renderTable({ nextHref: '/account/sonar/supply-risks?status=open&cursor=c2' });
    expect(screen.getByRole('link', { name: 'Show older' })).toHaveAttribute('href', '/account/sonar/supply-risks?status=open&cursor=c2');
    unmount();
    renderTable({ nextHref: null });
    expect(screen.queryByRole('link', { name: 'Show older' })).toBeNull();
  });

  it('choosing Contacted sends only the status and shows the served row', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === URL_OF(LEON.risk_id)) return json(200, riskOf({ status: 'contacted', note: 'n' }));
      throw new Error(`unexpected ${url}`);
    });
    renderTable();
    fireEvent.change(screen.getByLabelText('Status for León Cuero'), { target: { value: 'contacted' } });
    await waitFor(() => expect(screen.getByLabelText('Note for León Cuero')).toHaveValue('n'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL_OF(LEON.risk_id));
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"status":"contacted"}');
    expect(screen.getByLabelText('Status for León Cuero')).toHaveValue('contacted');
  });

  it('a failed save reverts the field and says so', async () => {
    fetchMock.mockResolvedValue(json(409, { error: 'closed' }));
    renderTable();
    fireEvent.change(screen.getByLabelText('Status for León Cuero'), { target: { value: 'resolving' } });
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't save — the risk is unchanged.");
    expect(screen.getByLabelText('Status for León Cuero')).toHaveValue('open');
  });

  it('disables the field while its save is in flight', async () => {
    let release!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { release = r; }));
    renderTable();
    fireEvent.change(screen.getByLabelText('Status for León Cuero'), { target: { value: 'contacted' } });
    await waitFor(() => expect(screen.getByLabelText('Status for León Cuero')).toBeDisabled());
    release(json(200, riskOf({ status: 'contacted' })));
    await waitFor(() => expect(screen.getByLabelText('Status for León Cuero')).toBeEnabled());
  });

  it('a blur without a change sends nothing; a changed note is saved on blur', async () => {
    fetchMock.mockResolvedValue(json(200, riskOf({ note: 'call Monday' })));
    renderTable();
    const note = screen.getByLabelText('Note for León Cuero');
    fireEvent.blur(note);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(note, { target: { value: 'call Monday' } });
    fireEvent.blur(note);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBe('{"note":"call Monday"}');
  });

  it('a changed review date is saved on blur, and emptying it sends null', async () => {
    fetchMock.mockResolvedValueOnce(json(200, riskOf({ next_review: '2026-11-09' })));
    fetchMock.mockResolvedValueOnce(json(200, riskOf({ next_review: null })));
    renderTable();
    const date = screen.getByLabelText('Next review for León Cuero');
    fireEvent.change(date, { target: { value: '2026-11-09' } });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.blur(date);
    await waitFor(() => expect(date).toHaveValue('2026-11-09'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(date, { target: { value: '' } });
    fireEvent.blur(date);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBe('{"next_review":"2026-11-09"}');
    expect((fetchMock.mock.calls[1] as [string, RequestInit])[1].body).toBe('{"next_review":null}');
  });

  it('a date blur without a change sends nothing', () => {
    renderTable();
    fireEvent.blur(screen.getByLabelText('Next review for León Cuero'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clearing a note sends null, not an empty string', async () => {
    fetchMock.mockResolvedValue(json(200, riskOf({ note: null })));
    renderTable({ initial: { ...supplyRisksList, risks: [riskOf({ note: 'x' })] } });
    const note = screen.getByLabelText('Note for León Cuero');
    fireEvent.change(note, { target: { value: '' } });
    fireEvent.blur(note);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBe('{"note":null}');
  });

  it('caps the note at 2000 characters', () => {
    renderTable();
    expect(screen.getByLabelText('Note for León Cuero')).toHaveAttribute('maxlength', '2000');
  });

  it('records one render measure across a rerender (R-9)', () => {
    performance.clearMarks('sm-supply-risks-render-start');
    performance.clearMeasures('sm-supply-risks-render');
    const { rerender } = renderTable();
    rerender(<SupplyRisksTable initial={supplyRisksList} nextHref={null} />);
    expect(performance.getEntriesByName('sm-supply-risks-render', 'measure')).toHaveLength(1);
  });
});
