import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SharingPolicyPanel } from '../sharing-policy-panel';

describe('SharingPolicyPanel', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('on Save with narrowing, first does dry_run and shows confirm modal with warning count', async () => {
    // initial GET — current policy
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ shared_fields: ['facility_country', 'manufacturing_date'] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      // dry_run PUT — warnings from two installations
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            policy: { shared_fields: ['facility_country'] },
            warnings: [
              { installation_id: 'i1', key_id: 'k1', missing_fields: ['manufacturing_date'] },
              { installation_id: 'i2', key_id: 'k2', missing_fields: ['manufacturing_date'] },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    render(<SharingPolicyPanel />);
    await waitFor(() => {
      expect(screen.getByLabelText(/manufacturing_date/i)).toBeInTheDocument();
    });
    // Toggle manufacturing_date off (narrow)
    await userEvent.click(screen.getByLabelText(/manufacturing_date/i));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 installation/i)).toBeInTheDocument();
    });
    // Confirm button visible
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('on Confirm, commits the narrowing (dry_run=false)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ shared_fields: ['facility_country', 'manufacturing_date'] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            policy: { shared_fields: ['facility_country'] },
            warnings: [{ installation_id: 'i1', key_id: 'k1', missing_fields: ['manufacturing_date'] }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            policy: { shared_fields: ['facility_country'] },
            warnings: [{ installation_id: 'i1', key_id: 'k1', missing_fields: ['manufacturing_date'] }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    render(<SharingPolicyPanel />);
    await waitFor(() => screen.getByLabelText(/manufacturing_date/i));
    await userEvent.click(screen.getByLabelText(/manufacturing_date/i));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));

    // The 3rd fetch should be the real PUT (dry_run=false or omitted)
    await waitFor(() => {
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    });
    const realCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[2];
    const body = JSON.parse(realCall[1].body as string);
    expect(body.dry_run).not.toBe(true);
  });
});
