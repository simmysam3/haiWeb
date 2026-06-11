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

// Same shape as VIEW but the element carries a draft auto-gathered artifact,
// so the tab should surface the DraftReviewBanner and per-item draft actions.
const DRAFT_VIEW: LibraryView = {
  sections: [
    {
      section: 'quality',
      elements: [
        {
          ...VIEW.sections[0].elements[0],
          artifacts: [
            {
              id: 'dr1',
              elementKey: 'iso9001',
              title: 'ISO 9001 (gathered)',
              status: 'draft',
              origin: 'auto_gathered',
              sourceTier: 'auto_gathered',
              sourceUrl: 'https://example.com/cert',
              mimeType: null,
              validFrom: null,
              validUntil: null,
              affirmedBy: null,
              affirmedAt: null,
            },
          ],
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

  it('shows a failure note (not the loading text) when the fetch errors', () => {
    mockedUseSWR.mockReturnValueOnce({
      data: undefined,
      error: new Error('network down'),
      isLoading: false,
      mutate,
    } as never);
    render(<LibraryTab context="share" />);
    expect(screen.getByText(/couldn't load the library/i)).toBeInTheDocument();
    expect(screen.queryByText(/loading library/i)).toBeNull();
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

  it('shows the draft review banner when the view contains draft items', () => {
    mockedUseSWR.mockReturnValueOnce({
      data: DRAFT_VIEW,
      error: undefined,
      isLoading: false,
      mutate,
    } as never);
    render(<LibraryTab context="share" />);
    expect(screen.getByText(/1 gathered item\(s\) awaiting review/i)).toBeInTheDocument();
  });

  it('hides the draft review banner when nothing is in draft', () => {
    render(<LibraryTab context="share" />);
    expect(screen.queryByText(/awaiting review/i)).toBeNull();
  });

  it('posts to the gather endpoint and flips to a started state on 202', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 202 } as Response));
    vi.stubGlobal('fetch', fetchMock);
    render(<LibraryTab context="share" />);
    fireEvent.click(screen.getByRole('button', { name: /gather from website/i }));
    const started = await screen.findByRole('button', {
      name: /gather started — drafts will appear shortly/i,
    });
    expect(started).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith('/api/account/library/gather', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    vi.unstubAllGlobals();
  });

  it('surfaces the no-website-url message when gather returns 422', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 422 } as Response)),
    );
    render(<LibraryTab context="share" />);
    fireEvent.click(screen.getByRole('button', { name: /gather from website/i }));
    expect(
      await screen.findByText('No website URL on record for your company.'),
    ).toBeInTheDocument();
    // The button stays available for retry.
    expect(screen.getByRole('button', { name: /gather from website/i })).toBeEnabled();
    vi.unstubAllGlobals();
  });

  it('posts a per-item draft action and revalidates on success', async () => {
    mockedUseSWR.mockReturnValueOnce({
      data: DRAFT_VIEW,
      error: undefined,
      isLoading: false,
      mutate,
    } as never);
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, status: 200 } as Response));
    vi.stubGlobal('fetch', fetchMock);
    render(<LibraryTab context="share" />);
    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
    await waitFor(() => expect(mutate).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/account/library/items/dr1/affirm', {
      method: 'POST',
    });
    vi.unstubAllGlobals();
  });
});
