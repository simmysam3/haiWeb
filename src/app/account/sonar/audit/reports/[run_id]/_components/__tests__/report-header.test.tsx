import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportHeader } from '../report-header';

const aggregateHeader = {
  run_id: '00000000-0000-0000-0000-000000000001',
  triggered_at: '2026-04-28T10:00:00.000Z',
  completed_at: '2026-04-28T10:05:00.000Z',
  scope_label: 'Acme key',
  scope_type: 'key' as const,
  provenance_key_id: '11111111-1111-1111-1111-111111111111',
  initiator_participant_id: '22222222-2222-2222-2222-222222222222',
  initiator_legal_name: 'Acme Corp',
};

describe('ReportHeader (aggregate)', () => {
  it('renders the truncated run id, scope label, and initiator legal name', () => {
    render(<ReportHeader variant="aggregate" header={aggregateHeader} />);
    expect(screen.getByText(/00000000/)).toBeInTheDocument();
    expect(screen.getByText('Acme key')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders the scope_type as a badge', () => {
    render(<ReportHeader variant="aggregate" header={aggregateHeader} />);
    expect(screen.getByText('key')).toBeInTheDocument();
  });

  it('renders triggered_at and completed_at timestamps', () => {
    render(<ReportHeader variant="aggregate" header={aggregateHeader} />);
    expect(screen.getByText(/Triggered/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
  });
});
