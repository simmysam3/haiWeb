import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResponseExportDialog } from '../response-export-dialog';

const PROPS = {
  draftId: 'draft-1',
  recipientName: 'US Customs',
  recipientType: 'customs' as const,
  sourceRunSummary: '1 run',
};

describe('ResponseExportDialog', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true, status: 201,
      json: async () => ({
        response_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        document_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      }),
    })) as never;
  });

  it('renders recipient summary and an Export button', () => {
    render(<ResponseExportDialog {...PROPS} />);
    expect(screen.getByText(/US Customs/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('on 201, shows response_id, truncated hash, and three download links', async () => {
    render(<ResponseExportDialog {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(
      screen.getByText(/aaaaaaaa-aaaa-aaaa/),
    ).toBeInTheDocument());
    expect(screen.getByText(/abcdef123456/)).toBeInTheDocument();
    // Three format links
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('format=pdf'))).toBe(true);
    expect(hrefs.some((h) => h.includes('format=html'))).toBe(true);
    expect(hrefs.some((h) => h.includes('format=json'))).toBe(true);
  });

  it('on 403, shows the export-role banner', async () => {
    global.fetch = vi.fn(async () => ({
      ok: false, status: 403,
      json: async () => ({ error: { message: 'Forbidden: missing scope' } }),
    })) as never;
    render(<ResponseExportDialog {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(
      screen.getByText(/export requires the export role/i),
    ).toBeInTheDocument());
  });

  it('POSTs to the correct BFF endpoint', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true, status: 201,
      json: async () => ({
        response_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        document_hash: 'a'.repeat(64),
      }),
    }));
    global.fetch = mockFetch as never;
    render(<ResponseExportDialog {...PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/account/sonar/compliance/evidence/draft/draft-1/export',
      expect.objectContaining({ method: 'POST' }),
    ));
  });
});
