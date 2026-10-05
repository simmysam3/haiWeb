// src/app/admin/help/__tests__/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import Page from '../page';

const CONV = '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10';
const CONV2 = '1c9b6b63-69c7-4b9f-8b4a-0b2e5d8f2a21';
const PID = '11111111-1111-1111-1111-111111111111';
const SUMMARY = {
  conversation_id: CONV,
  participant_id: PID,
  participant_name: 'Acme Corp',
  user_sub: 'kc-user-1',
  language: 'ko',
  started_at: '2026-10-07T10:00:00.000Z',
  last_message_at: '2026-10-07T10:05:00.000Z',
  message_count: 2,
  thumbs_down_count: 1,
  flags: ['served_mismatch'],
};
const DETAIL = {
  conversation_id: CONV,
  participant_id: PID,
  participant_name: 'Acme Corp',
  user_sub: 'kc-user-1',
  started_at: '2026-10-07T10:00:00.000Z',
  messages: [
    { message_id: 'aaaaaaaa-0000-4000-8000-000000000001', role: 'user', content: 'KEYCLOAK_CLIENT_SECRET=‹redacted› 401?', language: 'ko', page_route: '/account/agents', status: 'complete', input_tokens: null, cached_tokens: null, output_tokens: null, latency_ms: null, finish_reason: null, guard_flags: [], feedback: null, feedback_note: null, pack_version: null, created_at: '2026-10-07T10:00:00.000Z' },
    { message_id: 'aaaaaaaa-0000-4000-8000-000000000002', role: 'assistant', content: 'Rotate the secret on Agents.', language: 'ko', page_route: '/account/agents', status: 'complete', input_tokens: 105000, cached_tokens: 98000, output_tokens: 300, latency_ms: 4200, finish_reason: 'STOP', guard_flags: ['served_mismatch', 'unknown_env_var:AGENT_SECRET', 'case_summary'], feedback: 'down', feedback_note: 'Wrong page', pack_version: '2026-10-07.1', created_at: '2026-10-07T10:00:05.000Z' },
  ],
  packs: [{ version: '2026-10-07.1', manifest: { guide: { edition: '1.7' }, agent: { version: '1.102.0' }, brief: { date: '2026-10-06' } } }],
};

const fetchMock = vi.fn();
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const refused = (status: number) => ({ ok: false, status, json: async () => ({}) }) as Response;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith(`/api/admin/help/conversations/${CONV}`)) return ok(DETAIL);
    if (url.includes('cursor=cur-2')) return ok({ items: [{ ...SUMMARY, conversation_id: CONV2, participant_name: 'Beta LLC' }], next_cursor: null });
    return ok({ items: [SUMMARY], next_cursor: 'cur-2' });
  });
  vi.stubGlobal('fetch', fetchMock);
});

describe('AdminHelpPage', () => {
  it('lists conversations from the BFF', async () => {
    render(<Page />);
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('kc-user-1')).toBeInTheDocument();
    expect(screen.getByText('2 msgs')).toBeInTheDocument();
    expect(screen.getByText('1 down')).toBeInTheDocument();
    expect(screen.getByText('served_mismatch')).toBeInTheDocument();
  });

  it('filters by thumbs-down, flagged and language', async () => {
    render(<Page />);
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thumbs-down only' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Flagged only' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ko' } });
    await waitFor(() => {
      const last = String(fetchMock.mock.calls.at(-1)?.[0]);
      expect(last).toContain('thumbs_down=true');
      expect(last).toContain('flagged=true');
      expect(last).toContain('language=ko');
    });
  });

  it('asks for 50 conversations per page', async () => {
    render(<Page />);
    await screen.findByText('Acme Corp');
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/help/conversations?page_size=50');
  });

  it('filters by participant id only once it is a whole UUID, trimmed', async () => {
    render(<Page />);
    await screen.findByText('Acme Corp');
    const input = screen.getByRole('textbox', { name: 'Participant id' });
    fireEvent.change(input, { target: { value: PID.slice(0, 20) } });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('participant_id'))).toBe(false);
    fireEvent.change(input, { target: { value: `  ${PID}  ` } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(`/api/admin/help/conversations?participant_id=${PID}&page_size=50`));
  });

  it('expands a conversation into its redacted transcript with tokens, flags, feedback and pack', async () => {
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    expect(await screen.findByText('KEYCLOAK_CLIENT_SECRET=‹redacted› 401?')).toBeInTheDocument();
    expect(screen.getByText('in 105000 (cached 98000) · out 300 · 4200 ms')).toBeInTheDocument();
    // Flags render generically, so new ones (e.g. case_summary, C.7) need no UI change.
    expect(screen.getByText('Flags: served_mismatch, unknown_env_var:AGENT_SECRET, case_summary')).toBeInTheDocument();
    expect(screen.getByText('feedback: down — "Wrong page"')).toBeInTheDocument();
    expect(screen.getByText('Pack 2026-10-07.1 · guide 1.7 · agent 1.102.0 · brief 2026-10-06')).toBeInTheDocument();
  });

  it('shows Loading… while a transcript is being read', async () => {
    const pending = deferred<Response>();
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith(`/api/admin/help/conversations/${CONV}`) ? pending.promise : ok({ items: [SUMMARY], next_cursor: null }),
    );
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await act(async () => pending.resolve(ok(DETAIL)));
    expect(await screen.findByText('Rotate the secret on Agents.')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('the row says whether it is open, and its chevron turns', async () => {
    render(<Page />);
    const row = await screen.findByRole('button', { name: `Conversation ${CONV}` });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(row.querySelector('svg')).not.toHaveClass('rotate-90');
    fireEvent.click(row);
    await screen.findByText('Rotate the secret on Agents.');
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(row.querySelector('svg')).toHaveClass('rotate-90');
  });

  it('a second click collapses the row', async () => {
    render(<Page />);
    const row = await screen.findByRole('button', { name: `Conversation ${CONV}` });
    fireEvent.click(row);
    await screen.findByText('Rotate the secret on Agents.');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Rotate the secret on Agents.')).toBeNull();
  });

  it('re-opening a row shows its transcript without reading it again', async () => {
    render(<Page />);
    const row = await screen.findByRole('button', { name: `Conversation ${CONV}` });
    fireEvent.click(row);
    await screen.findByText('Rotate the secret on Agents.');
    fireEvent.click(row);
    fireEvent.click(row);
    expect(screen.getByText('Rotate the secret on Agents.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith(`/api/admin/help/conversations/${CONV}`))).toHaveLength(1);
  });

  it('says so when a transcript is refused', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith(`/api/admin/help/conversations/${CONV}`) ? refused(500) : ok({ items: [SUMMARY], next_cursor: null }),
    );
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    expect(await screen.findByText("Couldn't load this conversation.")).toBeInTheDocument();
  });

  it('says so when the server cannot be reached for a transcript', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith(`/api/admin/help/conversations/${CONV}`)) throw new TypeError('fetch failed');
      return ok({ items: [SUMMARY], next_cursor: null });
    });
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    expect(await screen.findByText("Couldn't load this conversation.")).toBeInTheDocument();
  });

  it('re-opening a row whose transcript failed reads it again', async () => {
    let detailReads = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.startsWith(`/api/admin/help/conversations/${CONV}`)) return ok({ items: [SUMMARY], next_cursor: null });
      detailReads += 1;
      return detailReads === 1 ? refused(500) : ok(DETAIL);
    });
    render(<Page />);
    const row = await screen.findByRole('button', { name: `Conversation ${CONV}` });
    fireEvent.click(row);
    await screen.findByText("Couldn't load this conversation.");
    fireEvent.click(row);
    fireEvent.click(row);
    expect(await screen.findByText('Rotate the secret on Agents.')).toBeInTheDocument();
    expect(detailReads).toBe(2);
  });

  it('each message shows who wrote it, its status, language, page and the pack that produced it', async () => {
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    const answer = (await screen.findByText('Rotate the secret on Agents.')).closest('li') as HTMLElement;
    const question = screen.getByText('KEYCLOAK_CLIENT_SECRET=‹redacted› 401?').closest('li') as HTMLElement;
    for (const [message, author] of [[question, 'User'], [answer, 'HAIWAVE Help']] as const) {
      expect(within(message).getByText(author)).toBeInTheDocument();
      expect(within(message).getByText('complete')).toBeInTheDocument();
      expect(within(message).getByText('ko')).toBeInTheDocument();
      expect(within(message).getByText('/account/agents')).toBeInTheDocument();
    }
    expect(within(answer).getByText('pack 2026-10-07.1')).toBeInTheDocument();
    expect(within(question).queryByText(/^pack /)).toBeNull();
  });

  it('only answers show token usage and latency', async () => {
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    await screen.findByText('Rotate the secret on Agents.');
    const question = screen.getByText('KEYCLOAK_CLIENT_SECRET=‹redacted› 401?').closest('li') as HTMLElement;
    expect(within(question).queryByText(/^in /)).toBeNull();
  });

  it('a message with no guard flags or feedback shows neither line', async () => {
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    await screen.findByText('Rotate the secret on Agents.');
    const question = screen.getByText('KEYCLOAK_CLIENT_SECRET=‹redacted› 401?').closest('li') as HTMLElement;
    expect(within(question).queryByText(/^Flags:/)).toBeNull();
    expect(within(question).queryByText(/^feedback:/)).toBeNull();
  });

  it('an answer with no recorded usage shows zeros', async () => {
    const unmetered = { ...DETAIL.messages[1], input_tokens: null, cached_tokens: null, output_tokens: null, latency_ms: null };
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith(`/api/admin/help/conversations/${CONV}`)
        ? ok({ ...DETAIL, messages: [unmetered] })
        : ok({ items: [SUMMARY], next_cursor: null }),
    );
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    expect(await screen.findByText('in 0 (cached 0) · out 0 · 0 ms')).toBeInTheDocument();
  });

  it('feedback with no note shows no quote', async () => {
    const liked = { ...DETAIL.messages[1], feedback: 'up', feedback_note: null };
    fetchMock.mockImplementation(async (url: string) =>
      url.startsWith(`/api/admin/help/conversations/${CONV}`)
        ? ok({ ...DETAIL, messages: [liked] })
        : ok({ items: [SUMMARY], next_cursor: null }),
    );
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: `Conversation ${CONV}` }));
    expect(await screen.findByText('feedback: up')).toBeInTheDocument();
  });

  it('loads more with the cursor and appends', async () => {
    render(<Page />);
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Beta LLC')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('Load more keeps the active filters', async () => {
    render(<Page />);
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thumbs-down only' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Beta LLC');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/help/conversations?thumbs_down=true&page_size=50&cursor=cur-2');
  });

  it('says so when the list cannot be read', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response);
    render(<Page />);
    expect(await screen.findByRole('alert')).toHaveTextContent('haiCore answered 500');
  });

  it('says so when the server cannot be reached for the list', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('fetch failed');
    });
    render(<Page />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load help conversations — the server could not be reached. The list below is empty because of that, not because there are no conversations.",
    );
  });

  it('the list, Load more and the alert follow the latest read', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('thumbs_down=true')) throw new TypeError('fetch failed');
      if (url.includes('flagged=true')) return refused(503);
      return ok({ items: [SUMMARY], next_cursor: 'cur-2' });
    });
    render(<Page />);
    await screen.findByText('Acme Corp');
    const thumbsDown = screen.getByRole('checkbox', { name: 'Thumbs-down only' });

    fireEvent.click(thumbsDown); // unreachable
    expect(await screen.findByRole('alert')).toHaveTextContent('the server could not be reached');
    expect(screen.queryByText('Acme Corp')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();

    fireEvent.click(thumbsDown); // a good read again
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Flagged only' })); // refused
    expect(await screen.findByRole('alert')).toHaveTextContent('haiCore answered 503');
    expect(screen.queryByText('Acme Corp')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('a failed Load more says so and keeps the list', async () => {
    let moreReads = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes('cursor=cur-2')) return ok({ items: [SUMMARY], next_cursor: 'cur-2' });
      moreReads += 1;
      if (moreReads === 1) return refused(503);
      throw new TypeError('fetch failed');
    });
    render(<Page />);
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('haiCore answered 503');
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('the server could not be reached'));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('a read that lands after a newer one is ignored', async () => {
    const first = deferred<Response>();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('thumbs_down=true')
        ? ok({ items: [{ ...SUMMARY, conversation_id: CONV2, participant_name: 'Beta LLC' }], next_cursor: null })
        : first.promise,
    );
    render(<Page />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thumbs-down only' }));
    expect(await screen.findByText('Beta LLC')).toBeInTheDocument();
    await act(async () => first.resolve(ok({ items: [SUMMARY], next_cursor: 'cur-2' })));
    expect(screen.queryByText('Acme Corp')).toBeNull();
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
  });

  it('a read that fails after a newer one raises no alert', async () => {
    const first = deferred<Response>();
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('thumbs_down=true')
        ? ok({ items: [{ ...SUMMARY, conversation_id: CONV2, participant_name: 'Beta LLC' }], next_cursor: null })
        : first.promise,
    );
    render(<Page />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thumbs-down only' }));
    expect(await screen.findByText('Beta LLC')).toBeInTheDocument();
    await act(async () => first.reject(new TypeError('fetch failed')));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
  });

  it('is titled Help Conversations and says what the transcripts are', async () => {
    render(<Page />);
    await screen.findByText('Acme Corp');
    expect(screen.getByRole('heading', { level: 1, name: 'Help Conversations' })).toBeInTheDocument();
    expect(screen.getByText(/^Redacted HAIWAVE Help transcripts \(kept 90 days\)\./)).toBeInTheDocument();
  });

  it('shows the participant id when the participant has no name', async () => {
    fetchMock.mockImplementation(async () => ok({ items: [{ ...SUMMARY, participant_name: null }], next_cursor: null }));
    render(<Page />);
    expect(await screen.findByText(PID)).toBeInTheDocument();
  });

  it("shows each row's language and start time", async () => {
    render(<Page />);
    await screen.findByText('Acme Corp');
    expect(screen.getByText('ko')).toBeInTheDocument();
    expect(screen.getByText(new Date(SUMMARY.started_at).toLocaleString())).toBeInTheDocument();
  });

  it('says so when no conversation matches the filters', async () => {
    fetchMock.mockImplementation(async () => ok({ items: [], next_cursor: null }));
    render(<Page />);
    expect(await screen.findByText('No help conversations match the current filters.')).toBeInTheDocument();
  });
});
