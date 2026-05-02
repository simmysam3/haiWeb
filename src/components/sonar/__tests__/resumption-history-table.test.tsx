import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResumptionHistoryTable } from '../resumption-history-table';
import type { RunResumptionState } from '@haiwave/protocol';

const MOCK_STATE: RunResumptionState = {
  run_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  observation_class: 'audit',
  position: { vendor_index: 2 },
  resumption_count: 3,
  throttled_at: '2026-05-01T10:00:00.000Z',
  next_resume_at: '2026-05-01T11:00:00.000Z',
  last_resume_at: null,
  last_resume_position_advanced_to: null,
};

describe('ResumptionHistoryTable', () => {
  it('renders the section heading', () => {
    render(<ResumptionHistoryTable resumptionState={MOCK_STATE} />);
    expect(screen.getByText('Resumption status')).toBeInTheDocument();
  });

  it('renders three column headers', () => {
    render(<ResumptionHistoryTable resumptionState={MOCK_STATE} />);
    expect(screen.getByText('Throttled at')).toBeInTheDocument();
    expect(screen.getByText('Next resume')).toBeInTheDocument();
    expect(screen.getByText('Resumption count')).toBeInTheDocument();
  });

  it('renders resumption_count in the table body', () => {
    render(<ResumptionHistoryTable resumptionState={MOCK_STATE} />);
    // resumption_count = 3; rendered as a cell value
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders formatted date strings for throttled_at and next_resume_at', () => {
    render(<ResumptionHistoryTable resumptionState={MOCK_STATE} />);
    // toLocaleString format varies by environment, but both date cells must exist.
    // Check that the table body row has 3 cells.
    const cells = document.querySelectorAll('tbody td');
    expect(cells).toHaveLength(3);
    // The third cell contains the resumption_count
    expect(cells[2].textContent).toBe('3');
  });
});
