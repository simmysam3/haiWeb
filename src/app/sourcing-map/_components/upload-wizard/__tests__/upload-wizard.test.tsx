// src/app/sourcing-map/_components/upload-wizard/__tests__/upload-wizard.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vomeroWorkbenchDetail, VOMERO_IDS } from '@/lib/sourcing-map/__fixtures__/vomero';
import { UploadWizard } from '../upload-wizard';

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
    expect(await screen.findByRole('alert')).toHaveTextContent('Map a column to Component.');
    fireEvent.change(screen.getByLabelText('Sheet'), { target: { value: '1' } });
    expect(screen.getByLabelText('Map column Description')).toHaveValue('component');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Upper leather tumbled')).toBeInTheDocument();
  });

});

// `describe('UploadWizard (demand)', …)` is created by Cycle 32.7 with its first `it` blocks:
// vitest fails an empty suite ("No test found in suite").
