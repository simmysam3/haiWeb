import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmUninstallModal } from '../confirm-uninstall-modal';

describe('ConfirmUninstallModal', () => {
  it('calls DELETE and onUninstalled on confirmation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ installation_id: 'i1' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;
    const onUninstalled = vi.fn();
    render(<ConfirmUninstallModal installationId="i1" open={true} onClose={() => {}} onUninstalled={onUninstalled} />);
    await userEvent.click(screen.getByRole('button', { name: /uninstall/i }));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/account/provenance-keys/installations/i1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(onUninstalled).toHaveBeenCalled();
  });
});
