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

  // Important (review-L7-4, fix round): volume_band is the schema's only nullable field pair
  // (packs.ts's InquiryPackSchema), and DEFAULT_INQUIRY_PACKS.open sets both to null since the
  // Open pack has no volume ceiling by design. The current pack here is 'standard', so the
  // Open column renders DEFAULT_INQUIRY_PACKS.open — the one column able to reach the nullable
  // arm. Spec §10.6's own text for that cell is "alert only", not "null–null% → alert".
  it('renders "alert only" for the Open pack\'s volume band, never the raw null interpolation', () => {
    render(<InquiryPackPanel current={current} onSave={vi.fn()} />);
    expect(screen.getByText('alert only')).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });
});
