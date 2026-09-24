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

});

// `describe('UploadWizard (demand)', …)` is created by Cycle 32.7 with its first `it` blocks:
// vitest fails an empty suite ("No test found in suite").
