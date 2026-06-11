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

  it('shows a pluralized draft count and bulk-accepts every draft via the affirm endpoint', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();
    render(<DraftReviewBanner draftIds={['d1', 'd2', 'd3']} onChanged={onChanged} />);

    expect(screen.getByText(/3 gathered items awaiting review/i)).toBeInTheDocument();
    // Live region so the count change is announced to assistive tech.
    expect(screen.getByRole('status')).toHaveTextContent(/3 gathered items awaiting review/i);

    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const id of ['d1', 'd2', 'd3']) {
      expect(fetchMock).toHaveBeenCalledWith(`/api/account/library/items/${id}/affirm`, {
        method: 'POST',
      });
    }
  });

  it('uses singular copy for exactly one draft', () => {
    render(<DraftReviewBanner draftIds={['d1']} onChanged={() => {}} />);
    expect(screen.getByText(/1 gathered item awaiting review/i)).toBeInTheDocument();
    expect(screen.queryByText(/items awaiting review/i)).toBeNull();
  });

  it('surfaces a partial accept-all failure while still revalidating', async () => {
    const fetchMock = vi.fn((url: unknown) =>
      Promise.resolve({ ok: !String(url).includes('/d2/') } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onChanged = vi.fn();
    render(<DraftReviewBanner draftIds={['d1', 'd2', 'd3']} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    expect(await screen.findByText("1 item couldn't be accepted.")).toBeInTheDocument();
    // Revalidation still happens so the successfully accepted drafts clear.
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('pluralizes the partial-failure message when several items fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false } as Response)),
    );
    render(<DraftReviewBanner draftIds={['d1', 'd2']} onChanged={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /accept all/i }));
    expect(await screen.findByText("2 items couldn't be accepted.")).toBeInTheDocument();
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
