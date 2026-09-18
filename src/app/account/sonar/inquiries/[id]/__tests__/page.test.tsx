import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const notFound = vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); });
vi.mock('next/navigation', () => ({ notFound }));

const ANSWERED = {
  inquiry_id: '22222222-2222-4222-8222-222222222222', outcome: 'satisfied', form_answered: 'qualified',
  // v1.101 L7 fix round (I1): carries a value + unit exactly as a raw POST response would (the
  // protocol's answered member admits both, verdict.ts:72-88) so the D-222 absence red below has
  // something real to catch.
  value: 61, unit: 'inch',
  granularity: 'aggregate', basis: 'declared_value', informational_use_only: true,
  commitment: { commitment_id: 'cm-1', hash: 'h'.repeat(8), signature: 's'.repeat(8), signed_at: '2026-09-16T00:00:00Z' },
};

describe('InquiryDetailPage', () => {
  it('renders the verdict outcome, form answered, and commitment id for a satisfied inquiry', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: ANSWERED })) }));
    const { default: InquiryDetailPage } = await import('../page');
    const el = await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-1' }) });
    render(el);
    expect(screen.getByText('satisfied')).toBeInTheDocument();
    expect(screen.getByText('cm-1')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  // PF P17 — the absence, with a present control in the same assertion block.
  it('never renders a Value panel, even for an answered inquiry (D-222)', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: ANSWERED })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-1' }) }));
    expect(screen.getByText('satisfied')).toBeInTheDocument();          // PRESENT CONTROL
    expect(screen.queryByText(/\bValue\b/)).toBeNull();
    expect(screen.queryByText('61')).toBeNull();
  });

  // PF P16 — the silent member is three keys; the answered-only fields must not be rendered at all.
  it('renders a declined inquiry without basis or granularity', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: { inquiry_id: '44444444-4444-4444-8444-444444444444', outcome: 'declined', informational_use_only: true } })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-4' }) }));
    expect(screen.getByText('declined')).toBeInTheDocument();           // PRESENT CONTROL
    expect(screen.queryByText('Basis')).not.toBeInTheDocument();
    expect(screen.queryByText('Granularity')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('renders a pending notice for { inquiry_id, status: "pending" } without treating it as an error', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: { inquiry_id: '33333333-3333-4333-8333-333333333333', status: 'pending' } })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-2' }) }));
    expect(screen.getByText(/still pending/)).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  // PF P15 / Q3 — the BFF turned the upstream 403 into this body.
  it('renders the fixed not-enabled state for the BFF not_enabled body', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: { not_enabled: true } })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'not-mine' }) }));
    expect(screen.getByText('Inquiry log is not enabled for this console')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound() on any fetch error', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'error', status: 502, message: 'upstream' })) }));
    const { default: InquiryDetailPage } = await import('../page');
    await expect(InquiryDetailPage({ params: Promise.resolve({ id: 'boom' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
