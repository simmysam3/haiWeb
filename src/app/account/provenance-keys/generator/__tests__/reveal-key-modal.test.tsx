import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RevealKeyModal } from '../reveal-key-modal';

describe('RevealKeyModal', () => {
  beforeEach(() => {
    // mock clipboard
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders provided keyValue directly (post-generate case)', () => {
    render(<RevealKeyModal open={true} onClose={() => {}} keyValue="plaintext-abc" />);
    expect(screen.getByText(/plaintext-abc/)).toBeInTheDocument();
  });

  it('fetches key_value when keyId is provided and no keyValue', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ key_value: 'fetched-abc' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;
    render(<RevealKeyModal open={true} onClose={() => {}} keyId="k1" />);
    await waitFor(() => expect(screen.getByText(/fetched-abc/)).toBeInTheDocument());
  });

  it('renders a copy button and a security-warning line', () => {
    render(<RevealKeyModal open={true} onClose={() => {}} keyValue="abc" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByText(/treat it like a password/i)).toBeInTheDocument();
  });
});
