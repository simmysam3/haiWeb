import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { leonExceptions, vettaExceptions } from '@/app/sourcing-map/__fixtures__/sp3';
import type { SmDemandExceptionListResponse } from '@/lib/sourcing-map/types';

import { DemandExceptionsTable } from '../_components/demand-exceptions-table';

const CHAIN = leonExceptions.exceptions[0]!;
const IGNORE_URL = (id: string) => `/api/account/sourcing-map/demand-exceptions/${id}/ignore`;

/** Each fixture row's `<tr>`, in order (the header row is skipped). */
function rows(): HTMLElement[] {
  return screen.getAllByRole('row').slice(1);
}

let fetchMock: ReturnType<typeof vi.fn>;

function renderTable(over: Partial<{ initial: SmDemandExceptionListResponse; nextHref: string | null }> = {}) {
  return render(<DemandExceptionsTable initial={over.initial ?? leonExceptions} nextHref={over.nextHref ?? null} />);
}

describe('DemandExceptionsTable', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the Chain row: requestor, asked, answered and gap', () => {
    renderTable();
    const row = rows()[0]!;
    expect(within(row).getByText('CSG Footwear Vietnam')).toBeInTheDocument();
    expect(within(row).getByText('13,000')).toBeInTheDocument();
    expect(within(row).getByText('9,821 / 3,179')).toBeInTheDocument();
    expect(within(row).getByText('an input of yours ran short')).toBeInTheDocument();
  });

  it('names the cause and its detail per row', () => {
    renderTable();
    const chain = rows()[0]!;
    expect(within(chain).getByText('Chain')).toBeInTheDocument();
    expect(within(chain).getByText('an input of yours ran short')).toBeInTheDocument();
    const own = within(rows()[2]!).getByText('Own capacity').parentElement!;
    expect(own.textContent).toBe('Own capacity');
    expect(within(own).queryByRole('link')).toBeNull();
  });

  it('shows the SKU in the product cell', () => {
    renderTable();
    expect(within(rows()[0]!).getByText('LC-BOV-UP-01')).toBeInTheDocument();
  });

  it('reads the Posture row: asked and window, a dash for answered and gap', () => {
    renderTable();
    const row = rows()[1]!;
    expect(within(row).getByText('4,000')).toBeInTheDocument();
    expect(within(row).getByText('Dec 21, 2026 to May 24, 2027')).toBeInTheDocument();
    expect(within(row).getByText('— / —')).toBeInTheDocument();
  });

  it('reads the request status as plain text', () => {
    renderTable();
    expect(within(rows()[2]!).getByText(/Request closed/)).toBeInTheDocument();
    expect(within(rows()[0]!).getByText(/ · Open$/)).toBeInTheDocument();
  });

  it('renders neither cause nor request status as a Pill', () => {
    renderTable();
    expect(screen.queryAllByTestId('pill')).toHaveLength(0);
  });

  it('shows the repeat count on the Chain row', () => {
    renderTable();
    expect(within(rows()[0]!).getByText('×2')).toBeInTheDocument();
  });

  it('links the Posture row to Trust posture, and no anchor goes to Query Guard', () => {
    renderTable();
    expect(within(rows()[1]!).getByRole('link', { name: 'Trust posture' })).toHaveAttribute('href', '/account/settings/trust-posture');
    for (const a of screen.getAllByRole('link')) expect(a.getAttribute('href')).not.toContain('query-guard');
  });

  it("reads Vetta's figures", () => {
    renderTable({ initial: vettaExceptions });
    expect(screen.getByText('León Cuero')).toBeInTheDocument();
    expect(screen.getByText('156,000')).toBeInTheDocument();
    expect(screen.getByText('117,860 / 38,140')).toBeInTheDocument();
  });

  it('says so when the list is empty', () => {
    renderTable({ initial: { exceptions: [], next_cursor: null } });
    expect(screen.getByText('No demand exceptions.')).toBeInTheDocument();
  });

  it('its teal controls use the dark teal, which clears 4.5:1 on white (axe color-contrast, SP3-d Task 12)', () => {
    renderTable({ nextHref: '/account/sonar/demand-exceptions?cursor=c1' });
    const controls = [
      within(rows()[1]!).getByRole('link', { name: 'Trust posture' }),
      screen.getAllByRole('button', { name: 'Ignore' })[0]!,
      screen.getByRole('link', { name: 'Show older' }),
    ];
    for (const el of controls) {
      expect(el).toHaveClass('text-teal-dark');
      expect(el).not.toHaveClass('text-teal');
    }
  });

  it('links Show older only with a next href', () => {
    const view = renderTable();
    expect(screen.queryByRole('link', { name: 'Show older' })).toBeNull();
    view.unmount();
    renderTable({ nextHref: '/account/sonar/demand-exceptions?cursor=c1' });
    expect(screen.getByRole('link', { name: 'Show older' })).toHaveAttribute('href', '/account/sonar/demand-exceptions?cursor=c1');
  });

  it('Ignore posts once and a 204 removes that row only', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderTable();
    fireEvent.click(within(rows()[0]!).getByRole('button', { name: 'Ignore' }));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(IGNORE_URL(CHAIN.exception_id));
    expect(init.method).toBe('POST');
    expect(screen.queryByText('13,000')).toBeNull();
    expect(screen.getByText('4,000')).toBeInTheDocument();
  });

  it('disables Ignore while the request is in flight', async () => {
    let release: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((r) => { release = r; }));
    renderTable();
    const button = within(rows()[1]!).getByRole('button', { name: 'Ignore' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    expect(within(rows()[0]!).getByRole('button', { name: 'Ignore' })).toBeEnabled();
    release(new Response(null, { status: 204 }));
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it('a failed Ignore keeps the row and says so', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));
    renderTable();
    fireEvent.click(within(rows()[2]!).getByRole('button', { name: 'Ignore' }));
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't ignore — the row is unchanged.");
    expect(rows()).toHaveLength(3);
    expect(within(rows()[2]!).getByRole('button', { name: 'Ignore' })).toBeEnabled();
  });

  it('records one render measure (R-9)', () => {
    performance.clearMeasures('sm-demand-exceptions-render');
    renderTable();
    expect(performance.getEntriesByName('sm-demand-exceptions-render', 'measure')).toHaveLength(1);
  });
});
