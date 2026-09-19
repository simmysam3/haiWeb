import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_INQUIRY_PACKS } from '@haiwave/protocol';
import { InquiryPackPanelClient } from '../inquiry-pack-panel-client';
import type { InquiryPackConfig } from '@/lib/safe-room-types';

const initialPack: InquiryPackConfig = {
  pack: 'standard',
  figures: DEFAULT_INQUIRY_PACKS.standard,
  ceiling: { limit_per_hour: 50, source: 'platform_default' },
};

describe('InquiryPackPanelClient', () => {
  it('PUTs the newly selected pack to the BFF route, body carrying only { pack }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...initialPack, pack: 'open', figures: DEFAULT_INQUIRY_PACKS.open }),
    }));
    render(<InquiryPackPanelClient initialPack={initialPack} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Open' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/query-guard/pack', expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).toEqual({ pack: 'open' });
  });

  it('updates the displayed pack from the response after a successful save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...initialPack, pack: 'open', figures: DEFAULT_INQUIRY_PACKS.open }),
    }));
    render(<InquiryPackPanelClient initialPack={initialPack} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Open' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Open' })).toBeChecked());
  });
});
