import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { ScopeImportPanel } from '../scope-import-panel';
import { MAX_IMPORT_BYTES } from '@/lib/scope-import/parse-workbook';

afterEach(() => vi.unstubAllGlobals());

const PW = 'cccccccc-0000-0000-0000-000000000002';
const options = [{ counterparty_id: PW, counterparty_legal_name: 'Pratt & Whitney (Demo)' }];

function demoFile(): File {
  const rows: unknown[][] = [
    ['Company Key', 'Company Name', 'Product ID', 'Product Name'],
    ['airbus', 'Airbus (Demo)', 'A320NEO-PW1100G-ENGCTL-SHIPSET', 'Shipset'],
    ['pw', 'Pratt & Whitney (Demo)', '5328285', 'EEC'],
    ['pw', 'Pratt & Whitney (Demo)', '5331092', 'EEC 6.2'],
    ['ti', 'Texas Instruments', 'RM48L952', 'MCU'],
    ['meridian', 'Meridian Aerospace Fasteners', 'MAF-HL-T10-6', 'Hi-Lok'],
    ['nordkapp', 'Nordkapp Sensor Systems', 'NKS-EGT-T4-K', 'EGT probe'],
    ['gore', 'W.M. Gore Advanced Materials', 'WMG-CA-16AWG-260', 'Cable'],
    ['', '', 'ORPHAN', 'no company'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['README only']]), 'README');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Products');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], 'airbus-pw-demo.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function stubFetch() {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname === '/api/account/profile') return json({ legal_name: 'Airbus S.A.S. (Demo)', dba_name: 'Airbus (Demo)' });
      if (url.pathname === '/api/account/directory') {
        const q = url.searchParams.get('q') ?? '';
        if (q === 'Texas Instruments') return json([{ company_name: 'Texas Instruments' }]);
        if (q === 'W.M. Gore Advanced Materials') return json({ error: 'upstream' }, 502);
        return json([]);
      }
      throw new Error(`unexpected fetch ${url.pathname}`);
    }),
  );
}

function chooseFile(file: File) {
  const input = screen.getByLabelText(/choose a spreadsheet/i) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('ScopeImportPanel', () => {
  it('parses the file, says who is not on the network, and offers only pickable companies', async () => {
    stubFetch();
    render(
      <ScopeImportPanel universe="bilateral_connections" options={options} onImport={() => {}} result={null} importing={false} />,
    );
    chooseFile(demoFile());

    expect(
      await screen.findByText('airbus-pw-demo.xlsx: 7 products across 6 companies. 1 row skipped (no company or no SKU).'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Not on the HAIWAVE network: Meridian Aerospace Fasteners, Nordkapp Sensor Systems.'),
    ).toBeInTheDocument();
    expect(screen.getByText('On the network but not yet connected: Texas Instruments.')).toBeInTheDocument();
    expect(screen.getByText('Could not be verified: W.M. Gore Advanced Materials.')).toBeInTheDocument();
    // Airbus is the session company: omitted from every line.
    expect(screen.queryByText(/Airbus/)).not.toBeInTheDocument();

    const select = screen.getByLabelText('Import products for') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual(['Choose a company…', 'Pratt & Whitney (Demo) (2 SKUs in file)']);
  });

  it('fires onImport with the chosen company’s file SKUs and renders the result summary', async () => {
    stubFetch();
    const onImport = vi.fn();
    const { rerender } = render(
      <ScopeImportPanel universe="bilateral_connections" options={options} onImport={onImport} result={null} importing={false} />,
    );
    chooseFile(demoFile());
    const select = (await screen.findByLabelText('Import products for')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: PW } });
    expect(onImport).toHaveBeenCalledWith(PW, ['5328285', '5331092'], 'Pratt & Whitney (Demo)');

    rerender(
      <ScopeImportPanel
        universe="bilateral_connections"
        options={options}
        onImport={onImport}
        importing={false}
        result={{ id: 1, counterpartyId: PW, companyName: 'Pratt & Whitney (Demo)', matched: ['5328285'], notInCatalog: ['5331092'], notAccepted: [] }}
      />,
    );
    expect(screen.getByText('1 of 2 SKUs for Pratt & Whitney (Demo) matched and were checked below.')).toBeInTheDocument();
    expect(screen.getByText("Not in Pratt & Whitney (Demo)'s catalog: 5331092.")).toBeInTheDocument();
  });

  it('says a refusal in place and offers no select', async () => {
    stubFetch();
    render(<ScopeImportPanel universe="bilateral_connections" options={options} onImport={() => {}} result={null} importing={false} />);
    const pdf = new File([new TextEncoder().encode('%PDF-1.4')], 'x.pdf', { type: 'application/pdf' });
    chooseFile(pdf);
    await waitFor(() => expect(screen.queryByText(/Reading/)).not.toBeInTheDocument());
    expect(screen.getByText(/Could not read x\.pdf as a spreadsheet\.|No sheet has both a company column/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Import products for')).not.toBeInTheDocument();
  });

  it('says the byte ceiling in place without parsing', async () => {
    stubFetch();
    render(<ScopeImportPanel universe="bilateral_connections" options={options} onImport={() => {}} result={null} importing={false} />);
    const big = new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'big.xlsx');
    chooseFile(big);
    expect(await screen.findByText('big.xlsx is 10.0 MB; the limit is 10 MB.')).toBeInTheDocument();
  });
});
