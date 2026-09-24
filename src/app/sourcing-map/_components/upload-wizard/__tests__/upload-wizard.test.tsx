// src/app/sourcing-map/_components/upload-wizard/__tests__/upload-wizard.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { readWorkbookSheets } from '@/lib/scope-import/parse-workbook';
import { UploadWizard } from '../upload-wizard';

// A pass-through: every test reads with the real reader. Only Ruling M1's test makes one read reject, as a failed
// load of the spreadsheet library's chunk does in a browser (jsdom cannot fail a dynamic import on its own).
vi.mock('@/lib/scope-import/parse-workbook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/scope-import/parse-workbook')>();
  return { ...actual, readWorkbookSheets: vi.fn(actual.readWorkbookSheets) };
});

const NL = String.fromCharCode(10);
const AXIS = vomeroWorkbenchDetail.variant_axis!;
const LEATHER = { class_id: 'cpt_full_grain_leather_hides', label: 'Full grain leather hides', class_path: ['Materials', 'Leather', 'Finished leather', 'Full grain leather hides'] };

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}
function csvFile(lines: string[], name = 'bom.csv'): File {
  return new File([lines.join(NL)], name, { type: 'text/csv' });
}
function fileInput(): HTMLElement {
  return screen.getByLabelText('Spreadsheet file');
}
/** Canned BFF answers by path; every default resolves the leather class and León Cuero. */
function route(overrides: { suggest?: unknown; match?: unknown; suppliers?: unknown; put?: unknown } = {}) {
  return async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.endsWith('/class-suggestions')) {
      return reply(200, overrides.suggest ?? { retrieval: 'hybrid', lines: body.lines.map(() => ({ suggestions: [{ ...LEATHER, band: 'high' }] })) });
    }
    if (url.endsWith('/supplier-matches')) {
      return reply(200, overrides.match ?? {
        matches: body.names.map((name: string) => ({ name, match: { participant_id: VOMERO_IDS.leon, legal_name: 'León Cuero', confidence: 'exact' }, note: null })),
      });
    }
    if (url.includes('/class-suppliers')) {
      return reply(200, overrides.suppliers ?? {
        class_id: LEATHER.class_id,
        suppliers: [{ participant_id: VOMERO_IDS.leon, legal_name: 'León Cuero', country: 'MX', skus: [{ supplier_sku: 'LC-BOV-UP-01', class_id: LEATHER.class_id, class_depth: 0 }] }],
      });
    }
    if (url.endsWith('/bom-lines')) return reply(200, overrides.put ?? vomeroWorkbenchDetail);
    return reply(404, { error: `unexpected ${url}` });
  };
}
function renderBom() {
  const onCommitted = vi.fn();
  render(<UploadWizard kind="bom" productId={VOMERO_IDS.pegasus} axis={AXIS} onCommitted={onCommitted} onClose={vi.fn()} />);
  return { onCommitted };
}

describe('UploadWizard (BOM)', () => {
  // cycles 31.1 … 32.5 add their `it` blocks here
  it('reads a CSV in the browser and pre-maps its columns from header synonyms (AC 5)', async () => {
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage,UOM,Vendor,Notes', 'Upper leather tumbled,0.25,sq ft,Leon Cuero SA,see memo']));
    expect(await screen.findByLabelText('Map column Description')).toHaveValue('component');
    expect(screen.getByLabelText('Map column Usage')).toHaveValue('qty_per_unit');
    expect(screen.getByLabelText('Map column Vendor')).toHaveValue('supplier');
    expect(screen.getByLabelText('Map column Notes')).toHaveValue('ignore');
    expect(screen.getByText('2 Map columns')).toHaveAttribute('aria-current', 'step');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a pre-mapped column be overridden, then builds the lines and continues to Resolve', async () => {
    fetchMock.mockImplementation(route());
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage,UOM,Remark', 'Upper leather tumbled,0.25,sq ft,Leather']));
    fireEvent.change(await screen.findByLabelText('Map column Remark'), { target: { value: 'class' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Accept all confident' })).toBeInTheDocument();
    expect(screen.getByText('File says: Leather')).toBeInTheDocument();
  });

  it('rejects make and multi-level rows by number and stays on the mapping step (AC 5)', async () => {
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Level,Description,Usage', '1,Upper,1', '2,Upper lining,1']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Row 3 is a make or sub-assembly line. Only single-level purchased lines can be uploaded; nothing was flattened.');
    expect(screen.getByLabelText('Map column Level')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('remembers a mapping on Continue and recalls it for the same header row (spec §7.3)', async () => {
    fetchMock.mockImplementation(route());
    const first = render(<UploadWizard kind="bom" productId={VOMERO_IDS.pegasus} axis={AXIS} onCommitted={vi.fn()} onClose={vi.fn()} />);
    await userEvent.upload(fileInput(), csvFile(['Description,Usage,UOM,Remark', 'x,1,ea,y']));
    fireEvent.change(await screen.findByLabelText('Map column Remark'), { target: { value: 'class' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('button', { name: 'Accept all confident' });
    first.unmount();
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage,UOM,Remark', 'z,2,ea,w']));
    expect(await screen.findByLabelText('Map column Remark')).toHaveValue('class');
  });

  it('refuses a file over 10 MB before reading it', async () => {
    renderBom();
    const big = csvFile(['a,b']);
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    const read = vi.spyOn(big, 'arrayBuffer');
    await userEvent.upload(fileInput(), big);
    expect(await screen.findByRole('alert')).toHaveTextContent('bom.csv is 11.0 MB; the limit is 10 MB.');
    expect(read).not.toHaveBeenCalled();
  });

  it('is a wide, labelled modal on SmDialog: focus moves in, and Escape or Close call onClose (controller ruling, I07)', () => {
    const onClose = vi.fn();
    render(<UploadWizard kind="bom" productId={VOMERO_IDS.pegasus} axis={AXIS} onCommitted={vi.fn()} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Upload BOM' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    // The Map step's column table needs the wide panel; a tall one scrolls under a dim that stays put, never clips.
    expect(dialog).toHaveClass('max-w-5xl');
    expect(dialog.parentElement).toHaveClass('items-start', 'overflow-y-auto');
    expect(dialog.previousElementSibling).toHaveClass('fixed', 'inset-0');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps focus inside the dialog when a step change removes the focused control (keyboard)', async () => {
    fetchMock.mockImplementation(route());
    renderBom();
    const dialog = screen.getByRole('dialog', { name: 'Upload BOM' });
    await userEvent.upload(fileInput(), csvFile(['Description,Usage', 'Upper leather tumbled,0.25']));
    await screen.findByLabelText('Map column Description');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole('group', { name: 'Map columns' }));
    const next = screen.getByRole('button', { name: 'Continue' });
    next.focus();
    fireEvent.click(next);
    await screen.findByRole('button', { name: 'Accept all confident' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByRole('group', { name: 'Resolve' }));
  });

  it('goes Back from a refused mapping to a File step without the stale error', async () => {
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Notes,Remark', 'see memo,none']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Map a column to Component.');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Spreadsheet file')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('re-maps the columns when the header row is corrected, and drops the error the old header caused (I16)', async () => {
    fetchMock.mockImplementation(route());
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Pegasus Trail BOM,Spring 2027', 'Description,Usage,UOM', 'Upper leather tumbled,0.25,sq ft']));
    expect(await screen.findByLabelText('Header row')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Map a column to Component.');
    fireEvent.change(screen.getByLabelText('Header row'), { target: { value: '1' } });
    expect(screen.getByLabelText('Map column Description')).toHaveValue('component');
    expect(screen.getByLabelText('Map column Usage')).toHaveValue('qty_per_unit');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Upper leather tumbled')).toBeInTheDocument();
  });

  it('reads an .xlsx, lets another sheet be picked, re-maps it, and drops the error the old sheet caused (AC 5, I16)', async () => {
    fetchMock.mockImplementation(route());
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Spring 2027 costed BOM'], ['Prepared by', 'Costing']]), 'Cover');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Description', 'Usage', 'UOM'], ['Upper leather tumbled', 0.25, 'sq ft']]), 'BOM');
    const bytes: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    renderBom();
    await userEvent.upload(fileInput(), new File([bytes], 'bom.xlsx'));
    expect(await screen.findByLabelText('Sheet')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('There are no rows under the header row (Row 2).');
    fireEvent.change(screen.getByLabelText('Sheet'), { target: { value: '1' } });
    expect(screen.getByLabelText('Map column Description')).toHaveValue('component');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Upper leather tumbled')).toBeInTheDocument();
  });

  it('says an empty file has no rows, and stays on the File step', async () => {
    renderBom();
    await userEvent.upload(fileInput(), new File([], 'empty.csv', { type: 'text/csv' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('empty.csv has no rows.');
    expect(screen.queryByLabelText('Header row')).toBeNull();
  });

  it('pre-maps an Excel "CSV UTF-8" (byte-order mark, then semicolons) exactly like the comma file (Review Focus 1)', async () => {
    const BOM = String.fromCharCode(0xfeff);
    renderBom();
    await userEvent.upload(fileInput(), new File([BOM + ['Description,Usage,UOM', 'Upper leather tumbled,0.25,sq ft'].join(NL)], 'bom.csv', { type: 'text/csv' }));
    expect(await screen.findByLabelText('Map column Description')).toHaveValue('component');
    expect(screen.getByLabelText('Map column Usage')).toHaveValue('qty_per_unit');
    expect(screen.getByLabelText('Map column UOM')).toHaveValue('uom');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await userEvent.upload(fileInput(), new File([BOM + ['Description;Usage;UOM', 'Upper leather tumbled;0,25;sq ft'].join(NL)], 'bom.csv', { type: 'text/csv' }));
    expect(await screen.findByLabelText('Map column Description')).toHaveValue('component');
    expect(screen.getByLabelText('Map column Usage')).toHaveValue('qty_per_unit');
    expect(screen.getByLabelText('Map column UOM')).toHaveValue('uom');
    expect(screen.getByRole('cell', { name: '0,25' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a header with no rows under it, and stays on the mapping step', async () => {
    fetchMock.mockImplementation(route());
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage,UOM']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('There are no rows under the header row (Row 1).');
    expect(screen.getByLabelText('Map column Description')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept all confident' })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the decimal commas of a semicolon file through to the row builder (Review Focus 1)', async () => {
    fetchMock.mockImplementation(route());
    renderBom();
    // '1.234.567,5' reads only with decimal commas; without them the row has no quantity and never reaches Resolve.
    await userEvent.upload(fileInput(), csvFile(['Description;Usage;UOM', 'Upper leather tumbled;0,25;sq ft', 'Leather hide lot;1.234.567,5;sq ft']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Upper leather tumbled')).toBeInTheDocument();
    expect(screen.getByText('Leather hide lot')).toBeInTheDocument();
  });

  it('asks for class suggestions with component labels only (deduplicated), and "Accept all confident" takes only high bands', async () => {
    fetchMock.mockImplementation(route({
      suggest: {
        retrieval: 'text_only',
        lines: [
          { suggestions: [{ ...LEATHER, band: 'high' }] },
          { suggestions: [{ class_id: 'cpt_metal_eyelets', label: 'Metal eyelets', class_path: ['Metal eyelets'], band: 'low' }] },
        ],
      },
    }));
    renderBom();
    await userEvent.upload(fileInput(), csvFile(["Description,Mat'l #,Usage", 'Upper leather tumbled,LTH-4471,0.25', 'Metal eyelet,EY-5,12', 'Metal eyelet,EY-6,12']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByRole('button', { name: /Full grain leather hides/ });
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/class-suggestions'))!;
    expect(JSON.parse(call[1].body)).toEqual({ lines: [{ label: 'Upper leather tumbled' }, { label: 'Metal eyelet' }] });
    expect(call[1].body).not.toContain('LTH-4471');
    expect(screen.getByText(/text search only/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept all confident' }));
    const leather = screen.getByRole('row', { name: /Upper leather tumbled/ });
    expect(within(leather).queryByRole('button', { name: /Full grain leather hides/ })).toBeNull();
    expect(leather).toHaveTextContent('Full grain leather hides');
    for (const eyelet of screen.getAllByRole('row', { name: /Metal eyelet/ })) {
      expect(within(eyelet).getByRole('button', { name: /Metal eyelets/ })).toBeInTheDocument();
    }
  });

  it('lists row errors with their source rows in Review and keeps Save disabled; nothing is saved (AC 5)', async () => {
    fetchMock.mockImplementation(route());
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage', 'Upper leather tumbled,0.25', 'Lining,two']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Row 3: 'two' is not a quantity per unit.");
    expect(screen.getByRole('button', { name: 'Save 1 line' })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/bom-lines'))).toBe(false);
  });

  it('the upload request carries no file bytes', async () => {
    fetchMock.mockImplementation(route({
      match: {
        matches: [
          { name: 'Leon Cuero SA', match: { participant_id: VOMERO_IDS.leon, legal_name: 'León Cuero', confidence: 'exact' }, note: null },
          { name: 'Kwang Il', match: null, note: 'not_a_trading_partner' },
        ],
      },
    }));
    const { onCommitted } = renderBom();
    const text = [
      "Description,Mat'l #,Usage,UOM,Vendor,Share,Notes",
      'Upper leather tumbled,LTH-4471,0.25,sq ft,Leon Cuero SA,60%,SECRET-NOTE-7741',
      'Heel counter TPU,HC-9,1,pr,Kwang Il,,',
    ].join(NL);
    await userEvent.upload(fileInput(), new File([text], 'bom.csv', { type: 'text/csv' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findAllByRole('button', { name: /Full grain leather hides/ });
    // supplier matches arrive after the suggestions; wait for them before picking classes
    await screen.findByText('Exact');
    fireEvent.click(screen.getByRole('button', { name: 'Accept all confident' }));
    await waitFor(() => expect(screen.queryByText(/has no SKU picked/)).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save 2 lines' }));
    await waitFor(() => expect(onCommitted).toHaveBeenCalledWith(vomeroWorkbenchDetail));
    // AC 5, AC 7: one PUT with the resolved lines — classes, a pin from an exact match, a note for a non-partner.
    const put = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/bom-lines'))!;
    expect(put[0]).toBe(`/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}/bom-lines`);
    expect(put[1].method).toBe('PUT');
    expect(Object.keys(JSON.parse(put[1].body))).toEqual(['lines']);
    const { lines } = JSON.parse(put[1].body);
    expect(lines[0]).toMatchObject({
      component_label: 'Upper leather tumbled', class_id: 'cpt_full_grain_leather_hides', origin: 'uploaded',
      pins: [{ supplier_participant_id: VOMERO_IDS.leon, supplier_sku: 'LC-BOV-UP-01', share_pct: 60 }], note: null,
    });
    expect(lines[1]).toMatchObject({ component_label: 'Heel counter TPU', pins: [], note: "Supplier 'Kwang Il' is not a trading partner" });
    // spec §12: no request carries the file, its bytes, or a column that was not mapped.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
    for (const [, init] of fetchMock.mock.calls) {
      const body = (init as RequestInit | undefined)?.body;
      expect(body === undefined || typeof body === 'string').toBe(true);
      expect(body instanceof Blob || body instanceof ArrayBuffer || body instanceof FormData).toBe(false);
      if (typeof body === 'string') {
        expect(body).not.toContain('SECRET-NOTE-7741');
        expect(body).not.toContain(text.slice(0, 40));
      }
    }
    // ...and every request, URL included, is exactly its mapped values as JSON: nothing else rides along, in any
    // encoding (a base64 or byte-array copy of the file would pass the text checks above, never this one).
    expect(fetchMock.mock.calls).toHaveLength(4);
    const sent = Object.fromEntries(fetchMock.mock.calls.map(([u, init]) => {
      const body = (init as RequestInit | undefined)?.body;
      return [String(u), { method: (init as RequestInit | undefined)?.method, body: typeof body === 'string' ? JSON.parse(body) : body }];
    }));
    expect(sent).toEqual({
      '/api/account/sourcing-map/class-suggestions': {
        method: 'POST', body: { lines: [{ label: 'Upper leather tumbled' }, { label: 'Heel counter TPU' }] },
      },
      '/api/account/sourcing-map/supplier-matches': { method: 'POST', body: { names: ['Leon Cuero SA', 'Kwang Il'] } },
      '/api/account/sourcing-map/class-suppliers?class_id=cpt_full_grain_leather_hides': { method: 'GET', body: undefined },
      [`/api/account/sourcing-map/products/${VOMERO_IDS.pegasus}/bom-lines`]: {
        method: 'PUT',
        body: {
          lines: [
            {
              component_label: 'Upper leather tumbled', part_ref: 'LTH-4471', class_id: 'cpt_full_grain_leather_hides', uom: 'sq ft',
              qty_per_unit: 0.25, variant_bound: false, qty_by_variant: null,
              pins: [{ supplier_participant_id: VOMERO_IDS.leon, supplier_sku: 'LC-BOV-UP-01', share_pct: 60 }], origin: 'uploaded', note: null,
            },
            {
              component_label: 'Heel counter TPU', part_ref: 'HC-9', class_id: 'cpt_full_grain_leather_hides', uom: 'pr',
              qty_per_unit: 1, variant_bound: false, qty_by_variant: null,
              pins: [], origin: 'uploaded', note: "Supplier 'Kwang Il' is not a trading partner",
            },
          ],
        },
      },
    });
  });

  it("drops a failed save's message on Back, so it never reappears on the next Review or on Map (a-G4)", async () => {
    const answer = route();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith('/bom-lines')
        ? reply(409, { error: { code: 'product_not_workbench', message: 'This product reads its BOM from your agent.' } })
        : answer(url, init));
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage', 'Upper leather tumbled,0.25']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save 1 line' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This product reads its BOM from your agent.');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue to review' }));
    expect(await screen.findByRole('button', { name: 'Save 1 line' })).toBeEnabled();
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('button', { name: 'Continue to review' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Map column Description')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the file cannot be read when the reader rejects, and stays on the File step (Ruling M1)', async () => {
    vi.mocked(readWorkbookSheets).mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'));
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage', 'Upper leather tumbled,0.25']));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read bom.csv as a spreadsheet.');
    expect(fileInput()).toBeInTheDocument();
    expect(screen.queryByLabelText('Header row')).toBeNull();
  });

  it("drops a refused mapping's error when a column is re-mapped (Ruling M2)", async () => {
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Notes,Remark', 'see memo,none']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Map a column to Component.');
    fireEvent.change(screen.getByLabelText('Map column Notes'), { target: { value: 'component' } });
    expect(screen.getByLabelText('Map column Notes')).toHaveValue('component');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps focus inside the dialog when a class pick (a suggestion or a search result) replaces the control that made it (keyboard)', async () => {
    const answer = route({ suggest: { retrieval: 'hybrid', lines: [{ suggestions: [{ ...LEATHER, band: 'medium' }] }, { suggestions: [] }] } });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes('/classes?q=')
        ? reply(200, { classes: [{ class_id: 'cpt_textile_linings', label: 'Textile linings', class_path: ['Materials', 'Textile linings'] }] })
        : answer(url, init));
    renderBom();
    const dialog = screen.getByRole('dialog', { name: 'Upload BOM' });
    await userEvent.upload(fileInput(), csvFile(['Description,Usage', 'Upper leather tumbled,0.25', 'Lining mesh,1']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    // a suggestion chip
    const chip = await screen.findByRole('button', { name: /Full grain leather hides/ });
    chip.focus();
    fireEvent.click(chip);
    expect(screen.getByRole('row', { name: /Upper leather tumbled/ })).toHaveTextContent('Full grain leather hides');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(screen.getByRole('row', { name: /Upper leather tumbled/ })).getByRole('textbox'));
    // a search result
    const lining = screen.getByRole('row', { name: /Lining mesh/ });
    fireEvent.change(within(lining).getByRole('textbox'), { target: { value: 'lining' } });
    fireEvent.click(within(lining).getByRole('button', { name: /^Find class for/ }));
    const result = await within(lining).findByRole('button', { name: /Textile linings/ });
    result.focus();
    fireEvent.click(result);
    expect(screen.getByRole('row', { name: /Lining mesh/ })).toHaveTextContent('Textile linings');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(screen.getByRole('row', { name: /Lining mesh/ })).getByRole('textbox'));
  });

  it("shows the message when the supplier's SKUs in the picked class cannot be read (a-G4)", async () => {
    const answer = route();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes('/class-suppliers')
        ? reply(502, { error: { code: 'agent_unreachable', message: 'The class catalog did not answer.' } })
        : answer(url, init));
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage,Vendor', 'Upper leather tumbled,0.25,Leon Cuero SA']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByText('Exact');
    fireEvent.click(screen.getByRole('button', { name: 'Accept all confident' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The class catalog did not answer.');
    expect(screen.getByText("Supplier 'Leon Cuero SA' has no SKU picked in this class; not pinned")).toBeInTheDocument();
  });

  it('holds "Continue to review" until the supplier names are looked up, and after a failed lookup, so no line carries a false note (AC 7, a-G4)', async () => {
    const answer = route();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (!url.endsWith('/supplier-matches')) return answer(url, init);
      await held;
      return reply(503, { error: { code: 'unavailable', message: 'Supplier matching is unavailable.' } });
    });
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage,Vendor', 'Upper leather tumbled,0.25,Leon Cuero SA']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByRole('button', { name: /Full grain leather hides/ });
    // the lookup is in flight: no verdict on the name yet, so none is shown or saved
    expect(screen.queryByText(/is not on the network/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue to review' })).toBeDisabled();
    release();
    expect(await screen.findByRole('alert')).toHaveTextContent('Supplier matching is unavailable.');
    expect(screen.queryByText(/is not on the network/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue to review' })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/bom-lines'))).toBe(false);
  });

  it('shows the message when class suggestions fail, and a line can still be classified by search (a-G4)', async () => {
    const answer = route();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith('/class-suggestions')
        ? reply(503, { error: { code: 'unavailable', message: 'Class suggestions are unavailable.' } })
        : answer(url, init));
    renderBom();
    await userEvent.upload(fileInput(), csvFile(['Description,Usage', 'Upper leather tumbled,0.25']));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Class suggestions are unavailable.');
    const row = screen.getByRole('row', { name: /Upper leather tumbled/ });
    expect(within(row).getByRole('textbox', { name: /^Class search for/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to review' })).toBeEnabled();
  });

});

describe('UploadWizard (demand)', () => {
  const PRODUCTS = [
    { product_id: VOMERO_IDS.pegasus, name: 'Pegasus Trail', variant_values: AXIS.values },
    { product_id: VOMERO_IDS.court, name: 'Court Classic', variant_values: AXIS.values },
  ];

  it('reads a demand file, reviews the drops per product, and applies the build (spec §7.3, §7.4 "Upload schedule")', async () => {
    const onApply = vi.fn();
    render(<UploadWizard kind="demand" products={PRODUCTS.slice(0, 1)} onApply={onApply} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Upload schedule' })).toBeInTheDocument();
    await userEvent.upload(fileInput(), csvFile(['Style,Due,Size,Pairs', 'Pegasus Trail,46402,9,300', 'Pegasus Trail,46433,9,400'], 'demand.csv'));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Pegasus Trail: 2 drops · 700 units')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply schedule' }));
    expect(onApply).toHaveBeenCalledWith({
      perProduct: [{
        product_id: VOMERO_IDS.pegasus,
        drops: [
          { due_date: '2027-01-15', qty: 300, pairs: { '9': 300 } },
          { due_date: '2027-02-15', qty: 400, pairs: { '9': 400 } },
        ],
      }],
      errors: [],
      ignoredColumns: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a two-product run on the mapping step when the file has no Product column', async () => {
    render(<UploadWizard kind="demand" products={PRODUCTS} onApply={vi.fn()} onClose={vi.fn()} />);
    await userEvent.upload(fileInput(), csvFile(['Due,Pairs', '2027-01-15,300'], 'demand.csv'));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Map a Product column; this run has 2 products.');
    expect(screen.getByLabelText('Map column Due')).toBeInTheDocument();
  });

  it('refuses a schedule with no rows under the header, and stays on the mapping step', async () => {
    const onApply = vi.fn();
    render(<UploadWizard kind="demand" products={PRODUCTS.slice(0, 1)} onApply={onApply} onClose={vi.fn()} />);
    await userEvent.upload(fileInput(), csvFile(['Due,Pairs'], 'demand.csv'));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('There are no rows under the header row (Row 1).');
    expect(screen.getByLabelText('Map column Due')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply schedule' })).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });
});
