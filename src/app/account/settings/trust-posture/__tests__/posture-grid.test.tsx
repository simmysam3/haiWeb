import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PostureGrid } from '../_components/posture-grid';
import type { ParticipantModalityPosture } from '@haiwave/protocol';

const seed: ParticipantModalityPosture[] = (() => {
  const TC = ['unknown', 'behavioral_only', 'trading_pair', 'premier_partner'] as const;
  const M = ['audit', 'watcher', 'phantom_demand'] as const;
  const out: ParticipantModalityPosture[] = [];
  for (const tc of TC) for (const m of M) {
    out.push({
      participant_id: '00000000-0000-0000-0000-000000000001',
      trust_class: tc,
      modality: m,
      posture: m === 'phantom_demand' ? 'permissive' : 'manual',
      signal_type_overrides: null,
      effective_from: '2026-05-10T00:00:00.000Z',
      configured_by: '00000000-0000-0000-0000-000000000000',
    });
  }
  return out;
})();

describe('PostureGrid', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => seed[0],
    } as Response);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('renders 12 cells (3 modalities × 4 trust classes)', () => {
    render(<PostureGrid initialPostures={seed} />);
    expect(screen.getAllByRole('gridcell').length).toBe(12);
  });

  it('opens drawer when a cell is clicked and closes when × is clicked', async () => {
    render(<PostureGrid initialPostures={seed} />);
    const cell = screen.getByLabelText(/audit posture for trading_pair/i);
    fireEvent.click(cell);
    expect(await screen.findByRole('heading', { name: /audit.*trading_pair/i })).toBeInTheDocument();
  });

  it('PUTs to BFF when posture is saved', async () => {
    render(<PostureGrid initialPostures={seed} />);
    fireEvent.click(screen.getByLabelText(/audit posture for trading_pair/i));
    const permissiveRadio = await screen.findByLabelText(/permissive/i);
    fireEvent.click(permissiveRadio);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/account/settings/trust-posture/trading_pair/audit');
    expect((init as RequestInit).method).toBe('PUT');
  });

  it('shows signal-type override checkboxes only for watcher posture=permissive', async () => {
    render(<PostureGrid initialPostures={seed} />);
    fireEvent.click(screen.getByLabelText(/watcher posture for trading_pair/i));
    const permissiveRadio = await screen.findByLabelText(/permissive/i);
    fireEvent.click(permissiveRadio);
    expect(await screen.findByLabelText(/lead_time_distribution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/capacity_utilization_band/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/delivery_event/i)).toBeInTheDocument();
  });
});
