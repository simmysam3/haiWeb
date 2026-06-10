import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useSWR from 'swr';
import { LibraryTab } from '../library-tab';
import type { LibraryView } from '@/lib/library-types';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

const mutate = vi.fn();

// One section, one element with NO artifact and NO attribute so EvidenceChip
// renders its "+ Add" button (the seam we click to open the modal), and one
// matrix cell we can toggle to exercise the onChanged -> mutate wiring.
const VIEW: LibraryView = {
  sections: [
    {
      section: 'quality',
      elements: [
        {
          key: 'iso9001',
          label: 'ISO 9001',
          kind: 'artifact',
          validity: true,
          modal_fields: [],
          attribute: null,
          artifacts: [],
          policies: {
            share: { premier: false, trading_pair: false, connection: false, qualified: false },
            require: { premier: false, trading_pair: false, connection: false, qualified: false },
          },
          gap: false,
        },
      ],
    },
  ],
};

beforeEach(() => {
  mockedUseSWR.mockReset();
  mutate.mockReset();
  mockedUseSWR.mockReturnValue({
    data: VIEW,
    error: undefined,
    isLoading: false,
    mutate,
  } as never);
});

describe('LibraryTab', () => {
  it('shows a loading note while the library is still fetching', () => {
    mockedUseSWR.mockReturnValueOnce({
      data: undefined,
      error: undefined,
      isLoading: true,
      mutate,
    } as never);
    render(<LibraryTab context="share" />);
    expect(screen.getByText(/loading library/i)).toBeInTheDocument();
  });

  it('opens the AddEvidenceModal when an element + Add affordance is clicked', () => {
    render(<LibraryTab context="require" />);
    expect(screen.queryByText(/add evidence — iso 9001/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByText(/add evidence — iso 9001/i)).toBeInTheDocument();
    // Cancel routes through onClose, which clears modalElement and hides it.
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/add evidence — iso 9001/i)).toBeNull();
  });

  it('calls mutate after a matrix cell toggle succeeds (onChanged wiring)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true } as Response)),
    );
    render(<LibraryTab context="share" />);
    // Matrix cells render as role="switch", labelled "<element> — <tier>".
    fireEvent.click(screen.getByRole('switch', { name: /ISO 9001 — Premier/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    vi.unstubAllGlobals();
  });
});
