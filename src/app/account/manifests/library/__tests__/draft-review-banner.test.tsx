import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DraftReviewBanner } from '../draft-review-banner';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DraftReviewBanner', () => {
  it('renders nothing when there are no drafts', () => {
    const { container } = render(<DraftReviewBanner draftIds={[]} onChanged={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the draft count and bulk-accepts every draft via the affirm endpoint', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();
    render(<DraftReviewBanner draftIds={['d1', 'd2', 'd3']} onChanged={onChanged} />);

    expect(screen.getByText(/3 gathered item\(s\) awaiting review/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const id of ['d1', 'd2', 'd3']) {
      expect(fetchMock).toHaveBeenCalledWith(`/api/account/library/items/${id}/affirm`, {
        method: 'POST',
      });
    }
  });

  it('disables the button and shows the busy label while accepting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    render(<DraftReviewBanner draftIds={['d1']} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    const busyButton = await screen.findByRole('button', { name: /accepting…/i });
    expect(busyButton).toBeDisabled();
  });
});
