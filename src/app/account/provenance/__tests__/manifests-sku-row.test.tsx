import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ManifestSkuRow } from '@haiwave/protocol';
import { ManifestsSkuRow } from '../manifests-sku-row';

const sku = {
  origin_manifest_id: 'm-1',
  external_product_id: 'APX-BR-CART-15',
  product_name: 'Cartridge Valve Body Blank',
  updated_at: '2026-06-01T00:00:00.000Z',
} as unknown as ManifestSkuRow;

describe('ManifestsSkuRow — end-of-line open-drawer affordance', () => {
  it('renders the shared DetailChevron (SVG), not a bare › glyph', () => {
    render(<ManifestsSkuRow sku={sku} onInspect={vi.fn()} />);
    const row = screen.getByRole('treeitem', { name: /Cartridge Valve Body Blank/i });
    // The specified row-detail affordance is the DetailChevron (an SVG in a
    // teal circle), not the hand-rolled "small ›" span.
    expect(row.querySelector('svg')).toBeTruthy();
    expect(row).not.toHaveTextContent('›');
  });

  it('slides out the side panel (calls onInspect) when the row is clicked', () => {
    const onInspect = vi.fn();
    render(<ManifestsSkuRow sku={sku} onInspect={onInspect} />);
    fireEvent.click(screen.getByRole('treeitem', { name: /Cartridge Valve Body Blank/i }));
    expect(onInspect).toHaveBeenCalledWith(sku);
  });
});
