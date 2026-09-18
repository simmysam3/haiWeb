import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_INQUIRY_PACKS } from '@haiwave/protocol';
import { InquiryPackPanel } from '../inquiry-pack-panel';
import type { InquiryPackConfig } from '@/lib/safe-room-types';

const current: InquiryPackConfig = {
  pack: 'standard',
  figures: DEFAULT_INQUIRY_PACKS.standard,
  ceiling: { limit_per_hour: 50, source: 'platform_default' },
};

describe('InquiryPackPanel', () => {
  it('shows the current pack and the ceiling with its source', () => {
    render(<InquiryPackPanel current={current} onSave={vi.fn()} />);
    expect(screen.getByText(/Platform ceiling/)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  // PF P12 — the assertion that would have caught six objects rendered as React children.
  it('renders every pack figure as text, object-valued ones included', () => {
    render(<InquiryPackPanel current={current} onSave={vi.fn()} />);
    expect(screen.getByText('4/hr · 8/day')).toBeInTheDocument(); // standard sku_repeat
  });

  it('calls onSave with the newly selected pack', () => {
    const onSave = vi.fn();
    render(<InquiryPackPanel current={current} onSave={onSave} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Open' }));
    expect(onSave).toHaveBeenCalledWith('open');
  });
});
