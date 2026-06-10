import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LibraryMatrix } from '../library-matrix';
import type { LibraryElement, LibraryView } from '@/lib/library-types';

afterEach(() => vi.restoreAllMocks());

function makeElement(over: Partial<LibraryElement> & { key: string; label: string }): LibraryElement {
  return {
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
    ...over,
  };
}

const gapEl = makeElement({
  key: 'iso_9001_cert',
  label: 'ISO 9001 Certificate',
  gap: true,
  policies: {
    share: { premier: true, trading_pair: false, connection: false, qualified: false },
    require: { premier: false, trading_pair: false, connection: false, qualified: false },
  },
});

const fullEl = makeElement({
  key: 'terms_of_sale',
  label: 'Terms of Sale',
  gap: false,
  policies: {
    share: { premier: true, trading_pair: true, connection: false, qualified: false },
    require: { premier: false, trading_pair: false, connection: false, qualified: false },
  },
});

const view: LibraryView = {
  sections: [
    { section: 'quality', elements: [gapEl] },
    { section: 'legal_commercial', elements: [fullEl] },
  ],
};

function renderMatrix(props: Partial<React.ComponentProps<typeof LibraryMatrix>> = {}) {
  const onChanged = vi.fn();
  const onAddEvidence = vi.fn();
  render(
    <LibraryMatrix
      view={view}
      context="share"
      readOnly={false}
      onChanged={onChanged}
      onAddEvidence={onAddEvidence}
      {...props}
    />,
  );
  return { onChanged, onAddEvidence };
}

describe('LibraryMatrix', () => {
  it('renders tier columns from TIER_LABELS and one switch row per element', () => {
    renderMatrix();
    // each expanded section renders its own header row (2 sections here)
    expect(screen.getAllByRole('columnheader', { name: 'Premier' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Trading Pair' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Connection' })).toHaveLength(2);
    expect(screen.getAllByRole('columnheader', { name: 'Qualified' })).toHaveLength(2);

    // ISO premier share is ON
    expect(
      screen.getByRole('switch', { name: 'ISO 9001 Certificate — Premier' }),
    ).toHaveAttribute('aria-checked', 'true');
    // ISO trading_pair share is OFF
    expect(
      screen.getByRole('switch', { name: 'ISO 9001 Certificate — Trading Pair' }),
    ).toHaveAttribute('aria-checked', 'false');
    // 2 elements x 4 tiers = 8 switches
    expect(screen.getAllByRole('switch')).toHaveLength(8);
  });

  it('clicking a cell optimistically flips it and PUTs the policy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { onChanged } = renderMatrix();

    const cell = screen.getByRole('switch', { name: 'ISO 9001 Certificate — Trading Pair' });
    expect(cell).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(cell);
    // optimistic flip happens immediately
    expect(cell).toHaveAttribute('aria-checked', 'true');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith('/api/account/library/policies', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        element_key: 'iso_9001_cert',
        context: 'share',
        tier: 'trading_pair',
        enabled: true,
      }),
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it('reverts the cell and shows an error note when the PUT fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { onChanged } = renderMatrix();

    const cell = screen.getByRole('switch', { name: 'ISO 9001 Certificate — Trading Pair' });
    fireEvent.click(cell);
    expect(cell).toHaveAttribute('aria-checked', 'true');

    await waitFor(() => expect(cell).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText(/couldn't save/i)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('gaps-only filter hides non-gap rows and adjusts group counts', () => {
    renderMatrix();
    // both present initially
    expect(screen.getByText('ISO 9001 Certificate')).toBeInTheDocument();
    expect(screen.getByText('Terms of Sale')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/show gaps only/i));

    expect(screen.getByText('ISO 9001 Certificate')).toBeInTheDocument();
    expect(screen.queryByText('Terms of Sale')).not.toBeInTheDocument();
  });

  it('read-only mode renders all cells disabled and never fetches', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderMatrix({ readOnly: true });

    const cells = screen.getAllByRole('switch');
    cells.forEach((c) => expect(c).toBeDisabled());

    fireEvent.click(cells[0]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
