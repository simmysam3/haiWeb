import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

import Page from '../page';

const EMPTY_RESPONSE = { events: [], total: 0, page: 1, page_size: 50 };

const DOWN_EVENT = {
  event_id: 'aaaaaaaa-0000-0000-0000-000000000001',
  occurred_at: '2026-07-09T10:00:00Z',
  received_at: '2026-07-09T10:00:05Z',
  session_id: 'sess-1',
  message_id: 'msg-1',
  sentiment: 'down' as const,
  feedback_text: 'Wrong SKU count',
  user_query: 'What is the lead time for SKU-123?',
  assistant_response: 'The lead time is 5 days.',
  end_user: 'jane@acme.com',
  client_version: '1.57.1',
  protocol_version: '3.45.0',
  deployment: 'external' as const,
  answer_provenance: 'catalog',
  agent_id: 'agent-42',
  participant_id: '11111111-1111-1111-1111-111111111111',
  participant_legal_name: 'Acme Corp',
};

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe('AdminFeedbackPage', () => {
  it('renders rows from /api/admin/chat-feedback — company name, end user, sentiment pill', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ events: [DOWN_EVENT], total: 1, page: 1, page_size: 50 }),
    );

    render(<Page />);

    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
    expect(screen.getByText('jane@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Down', { selector: '[data-testid="pill"]' })).toBeInTheDocument();
  });

  it('re-fetches with ?sentiment=down when the sentiment filter changes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(EMPTY_RESPONSE));
    const user = userEvent.setup();

    render(<Page />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const select = screen.getByLabelText(/sentiment/i);
    await user.selectOptions(select, 'down');

    await waitFor(() => {
      const lastUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      expect(lastUrl).toContain('sentiment=down');
    });
  });

  it('clicking a row toggles the detail region showing user_query and assistant_response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ events: [DOWN_EVENT], total: 1, page: 1, page_size: 50 }),
    );
    const user = userEvent.setup();

    render(<Page />);
    const toggle = await screen.findByRole('button', { name: /feedback from jane@acme\.com/i });

    expect(screen.queryByText(DOWN_EVENT.user_query)).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByText(DOWN_EVENT.user_query)).toBeInTheDocument();
    expect(screen.getByText(DOWN_EVENT.assistant_response)).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText(DOWN_EVENT.user_query)).not.toBeInTheDocument();
  });

  it('the Download link href contains the export path and the active filter params', async () => {
    fetchMock.mockResolvedValue(jsonResponse(EMPTY_RESPONSE));
    const user = userEvent.setup();

    render(<Page />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const download = screen.getByRole('link', { name: /download/i });
    expect(download).toHaveAttribute('href', expect.stringContaining('/api/admin/chat-feedback/export'));

    const select = screen.getByLabelText(/sentiment/i);
    await user.selectOptions(select, 'down');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /download/i })).toHaveAttribute(
        'href',
        expect.stringContaining('sentiment=down'),
      );
    });
  });

  it('setting the To date yields an inclusive end-of-day upper bound (T23:59:59.999Z)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(EMPTY_RESPONSE));
    const user = userEvent.setup();

    render(<Page />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const toInput = screen.getByLabelText(/to date/i);
    await user.type(toInput, '2026-07-09');

    await waitFor(() => {
      const lastUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
      const to = new URLSearchParams(lastUrl.split('?')[1]).get('to');
      expect(to).toBe('2026-07-09T23:59:59.999Z');
    });
  });

  it('shows an empty-state message with no crash when the feed has no events', async () => {
    fetchMock.mockResolvedValue(jsonResponse(EMPTY_RESPONSE));

    render(<Page />);

    await waitFor(() => expect(screen.getByText(/no feedback/i)).toBeInTheDocument());
  });
});
