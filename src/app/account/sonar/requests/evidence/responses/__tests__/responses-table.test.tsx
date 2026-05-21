import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsesTable } from '../responses-table';
import type { EvidenceResponseListItem } from '@haiwave/protocol';

const ROWS: EvidenceResponseListItem[] = [
  {
    response_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    scope_shape: 'sku_list',
    sku_count: 3,
    recipient_name: 'US Customs',
    recipient_type: 'customs',
    exported_at: '2026-05-19T10:00:00.000Z',
    exported_by: '33333333-3333-3333-3333-333333333333',
    document_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  },
];

describe('ResponsesTable', () => {
  it('renders a row with truncated hash, recipient, and a PDF download link', () => {
    render(<ResponsesTable rows={ROWS} />);
    // Recipient name appears in the table
    expect(screen.getByText(/US Customs/)).toBeInTheDocument();
    // Truncated hash (first 12 chars)
    expect(screen.getByText(/abcdef123456/)).toBeInTheDocument();
    // Download link to document route with format=pdf
    const link = screen.getByRole('link', { name: /pdf/i });
    expect(link).toHaveAttribute(
      'href',
      '/api/account/sonar/compliance/evidence/responses/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/document?format=pdf',
    );
  });

  it('renders a detail link to the response page', () => {
    render(<ResponsesTable rows={ROWS} />);
    const link = screen.getByRole('link', { name: /aaaaaaaa/i });
    expect(link).toHaveAttribute(
      'href',
      '/account/sonar/requests/evidence/responses/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
  });

  it('renders an empty state when no rows', () => {
    render(<ResponsesTable rows={[]} />);
    expect(screen.getByText(/no evidence responses/i)).toBeInTheDocument();
  });
});
