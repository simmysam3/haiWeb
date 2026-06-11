import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import useSWR from 'swr';
import ManifestsPage from '../page';
import type { LibraryView } from '@/lib/library-types';

vi.mock('swr');
const mockedUseSWR = vi.mocked(useSWR);

// CounterpartyManifest, PricingDefaults and SharingPolicyPanel each fetch via
// useApi/fetch on mount; stub fetch so they render without network noise.
beforeEach(() => {
  mockedUseSWR.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response),
    ),
  );
});

const LIBRARY_VIEW: LibraryView = {
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

function mockLibraryLoaded() {
  mockedUseSWR.mockReturnValue({
    data: LIBRARY_VIEW,
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  } as never);
}

describe('ManifestsPage tabs', () => {
  it('renders five tabs including the two Library tabs', () => {
    mockLibraryLoaded();
    render(<ManifestsPage />);
    expect(screen.getByRole('button', { name: 'Counterparty Manifest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Library — Sharing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Library — Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Baseline Pricing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sharing Policy' })).toBeInTheDocument();
  });

  it('switching to Library — Requirements renders the require-context legend', () => {
    mockLibraryLoaded();
    render(<ManifestsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Library — Requirements' }));
    expect(screen.getByText(/what you require of counterparties/i)).toBeInTheDocument();
  });

  it('switching to Library — Sharing renders the share-context legend', () => {
    mockLibraryLoaded();
    render(<ManifestsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Library — Sharing' }));
    expect(screen.getByText(/reconcile counterparty requirements/i)).toBeInTheDocument();
  });

  it('counterparty manifest tab no longer renders the retired mock sections', () => {
    mockLibraryLoaded();
    render(<ManifestsPage />);
    // Default tab is the counterparty manifest.
    expect(screen.queryByText(/W-9 Form/)).toBeNull();
    expect(screen.queryByText(/inbound requirements/i)).toBeNull();
    expect(screen.queryByText(/outbound postures/i)).toBeNull();
  });
});
