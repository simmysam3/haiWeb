import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GenerateKeyModal } from '../generate-key-modal';

describe('GenerateKeyModal', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('submits the form and invokes onGenerated with the key + key_value', async () => {
    const generated = { key: { key_id: 'k1', friendly_name: 'Test Key' }, key_value: 'plain' };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(generated), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const onGenerated = vi.fn();
    render(<GenerateKeyModal open={true} onClose={() => {}} onGenerated={onGenerated} />);
    await userEvent.type(screen.getByLabelText(/friendly name/i), 'Test Key');
    await userEvent.click(screen.getByLabelText(/facility_country/i));
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    expect(onGenerated).toHaveBeenCalledWith(generated);
  });
});
