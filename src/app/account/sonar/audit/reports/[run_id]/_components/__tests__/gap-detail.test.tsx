import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GapDetail } from '../gap-detail';
import { makePerVendorReport } from '../__fixtures__/per-vendor-report';

describe('GapDetail', () => {
  it('renders one section per SKU with gap kind, resolution-class badge, and actionable suggestion', () => {
    const entries = makePerVendorReport().gap_detail;
    render(<GapDetail entries={entries} />);
    expect(screen.getByText('BEARING-7')).toBeInTheDocument();
    expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    expect(screen.getByText(/manifest disclosure/i)).toBeInTheDocument();
    expect(screen.getByText(/Agentic eligible/i)).toBeInTheDocument();
  });

  it('renders empty-state copy when no gaps', () => {
    render(<GapDetail entries={[]} />);
    expect(screen.getByText(/No unresolved gaps/i)).toBeInTheDocument();
  });
});
