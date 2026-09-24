import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { ImportAgentDialog } from '../import-agent-dialog';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
const SKUS = { skus: [{ sku: 'METCON-CROSS-IRON', product_name: 'Metcon Cross Iron' }, { sku: 'VOMERO-SAILSTONE', product_name: null }] };

describe('ImportAgentDialog', () => {
  it("offers the seat's finished goods and copies the chosen BOM into the workbench", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, SKUS)).mockResolvedValueOnce(reply(200, { mode: 'copy', lines_created: 12, lines_unclassified: 2 }));
    const onImported = vi.fn();
    render(<ImportAgentDialog productId={VOMERO_IDS.metcon} open onClose={vi.fn()} onImported={onImported} />);
    await waitFor(() => expect(document.querySelector('datalist option[value="METCON-CROSS-IRON"]')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'METCON-CROSS-IRON' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith({ mode: 'copy', lines_created: 12, lines_unclassified: 2 }));
    const [path, init] = fetchMock.mock.calls[1]!;
    expect(path).toBe(`/api/account/sourcing-map/products/${VOMERO_IDS.metcon}/import-agent-bom`);
    expect(JSON.parse(init.body)).toEqual({ agent_root_sku: 'METCON-CROSS-IRON', mode: 'copy' });
  });

  it('says so when the agent is unreachable, and reports nothing created (spec §7.5, §10)', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, SKUS)).mockResolvedValueOnce(reply(502, { error: { code: 'agent_unreachable', message: 'upstream' } }));
    const onImported = vi.fn();
    render(<ImportAgentDialog productId={VOMERO_IDS.metcon} open onClose={vi.fn()} onImported={onImported} />);
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'UNLISTED-SKU-9' } });
    fireEvent.click(screen.getByRole('radio', { name: /Link/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your agent did not answer. Nothing was created.');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ agent_root_sku: 'UNLISTED-SKU-9', mode: 'link' });
    expect(onImported).not.toHaveBeenCalled();
  });

  it('shows the server message and creates nothing for a 422 agent_bom_not_found (a-G4: error.message must render)', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, SKUS))
      .mockResolvedValueOnce(reply(422, { error: { code: 'agent_bom_not_found', message: "METCON-CROSS-IRON has no BOM in the agent's manifest." } }));
    const onImported = vi.fn();
    render(<ImportAgentDialog productId={VOMERO_IDS.metcon} open onClose={vi.fn()} onImported={onImported} />);
    await waitFor(() => expect(document.querySelector('datalist option[value="METCON-CROSS-IRON"]')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Parent SKU'), { target: { value: 'METCON-CROSS-IRON' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("METCON-CROSS-IRON has no BOM in the agent's manifest.");
    expect(onImported).not.toHaveBeenCalled();
  });
});
