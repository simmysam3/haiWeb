// src/components/help/__tests__/help-widget.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, configure, within } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { HelpProvider, HelpButton } from '..';
import { HELP_LANG_KEY, HELP_STATE_KEY, saveWidgetState, type HelpWidgetState } from '../help-storage';

// The aria-live region repeats each finished answer's text for screen readers, so *ByText would find the
// answer twice. Text queries skip it; the cases read it through getByTestId('help-live').
configure({ defaultIgnore: 'script, style, [aria-live]' });

const nav = vi.hoisted(() => ({ pathname: '/account/partners/3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

const CONV = '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10';
const UMSG = 'b5d4c3a2-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const AMSG = 'c6e5d4b3-2a1f-4e0d-9c8b-7a6f5e4d3c2b';
const QUESTION = 'How do I deploy?';

function meta(over: { redacted_message?: string; redaction_count?: number; matches_pack?: boolean } = {}) {
  return {
    conversation_id: CONV,
    user_message_id: UMSG,
    redacted_message: over.redacted_message ?? QUESTION,
    redaction_count: over.redaction_count ?? 0,
    pack: { version: '2026-10-07.1', guide_edition: '1.7', pack_date: '2026-10-07' },
    served: { guide_sha: 'a'.repeat(64), agent_version: '1.102.0', matches_pack: over.matches_pack ?? true },
  };
}
const DONE = { assistant_message_id: AMSG, finish_reason: 'STOP', usage: { input: 100, cached: 90, output: 20 } };
const ev = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const answer = (text: string, m = meta()) => ev('meta', m) + ev('delta', { text }) + ev('done', DONE);

function sseResponse(text: string): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(text));
        c.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  );
}

/** An SSE response that stays open: push() sends more, finish() closes it. */
function openStream() {
  const enc = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } }),
    push: (text: string) => controller?.enqueue(enc.encode(text)),
    finish: () => controller?.close(),
  };
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const fetchMock = vi.fn();
let replies: Response[] = [];

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  replies = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url === '/api/help/messages') {
      const next = replies.shift();
      if (!next) throw new Error('no /api/help/messages reply queued');
      return next;
    }
    if (url.endsWith('/feedback')) return new Response(null, { status: 204 });
    if (url.endsWith('/case-summary')) return jsonResponse(200, { summary: 'Problem: docker build fails at COPY.', contact: 'support@haiwave.ai' });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Amendment P3-7: the stored panel state belongs to one signed-in user, so every render passes an owner key.
const OWNER = 'owner-test';
const widget = (enabled = true, ownerKey: string | null = OWNER) => (
  <HelpProvider enabled={enabled} ownerKey={ownerKey}>
    <HelpButton variant="nav" />
  </HelpProvider>
);
const renderWidget = (enabled = true, ownerKey: string | null = OWNER) => render(widget(enabled, ownerKey));
// \b: the answer's own "Helpful" feedback button must not match.
const helpButton = () => screen.getByRole('button', { name: /^Help\b/ });
async function openPanel() {
  fireEvent.click(helpButton());
  return screen.findByRole('dialog', { name: 'HAIWAVE Help' });
}
function ask(text: string, labels = { box: 'Message', send: 'Send' }) {
  fireEvent.change(screen.getByRole('textbox', { name: labels.box }), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: labels.send }));
}
const helpBodies = () =>
  fetchMock.mock.calls
    .filter(([u]) => u === '/api/help/messages')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as Record<string, unknown>);
const RATE_LIMITED = () => jsonResponse(429, { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' } });
const footerSummarize = () => screen.getAllByRole('button', { name: 'Summarize for support' }).at(-1) as HTMLElement;

/** An SSE reply that sends meta and one delta, then stays open until the request's signal aborts it. */
function replyUntilAborted(text: string) {
  fetchMock.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(ev('meta', meta()) + ev('delta', { text })));
        init.signal?.addEventListener('abort', () => c.error(new DOMException('The operation was aborted.', 'AbortError')));
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
  });
}

describe('HelpProvider + HelpButton + HelpPanel', () => {
  it('renders no button when the help agent is disabled or outside the provider', () => {
    const { unmount } = renderWidget(false);
    expect(screen.queryByRole('button', { name: /^Help/ })).toBeNull();
    unmount();
    render(<HelpButton variant="nav" />);
    expect(screen.queryByRole('button', { name: /^Help/ })).toBeNull();
  });

  it('opens from the button with focus in the composer; Escape minimizes and keeps the conversation', async () => {
    replies.push(sseResponse(answer('Use **Agents → Provisioning**.')));
    renderWidget();
    expect(helpButton()).toHaveAttribute('aria-expanded', 'false');
    await openPanel();
    expect(helpButton()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus();
    ask(QUESTION);
    expect(await screen.findByText('Agents → Provisioning')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(helpButton()).toHaveAttribute('aria-expanded', 'false');
    await openPanel();
    expect(screen.getByText('Agents → Provisioning')).toBeInTheDocument();
  });

  it('sends the route pattern and language, swaps in the redacted question, and shows the guide edition', async () => {
    replies.push(sseResponse(answer('Rotate the secret.', meta({ redacted_message: 'KEYCLOAK_CLIENT_SECRET=‹redacted› why 401?', redaction_count: 1 }))));
    renderWidget();
    await openPanel();
    ask('KEYCLOAK_CLIENT_SECRET=s3cr3t why 401?');
    await screen.findByText('Rotate the secret.');
    expect(helpBodies()[0]).toEqual({
      message: 'KEYCLOAK_CLIENT_SECRET=s3cr3t why 401?',
      page_route: '/account/partners/[id]',
      language: 'en',
    });
    expect(screen.getByText('KEYCLOAK_CLIENT_SECRET=‹redacted› why 401?')).toBeInTheDocument();
    expect(screen.queryByText(/s3cr3t/)).toBeNull();
    expect(screen.getByText('Secrets masked before sending: 1')).toBeInTheDocument();
    expect(screen.getByText('Guide 1.7 · help pack 2026-10-07')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByTestId('help-live')).toHaveTextContent('Rotate the secret.');
  });

  it('carries the conversation id on the next question and flags a guide mismatch (Q1)', async () => {
    replies.push(sseResponse(answer('First.', meta({ matches_pack: false }))));
    replies.push(sseResponse(answer('Second.', meta({ redacted_message: 'And then?' }))));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('First.');
    expect(screen.getByRole('note')).toHaveTextContent('Help may be ahead of or behind the guide you downloaded.');
    ask('And then?');
    await screen.findByText('Second.');
    expect(helpBodies()[1]).toMatchObject({ conversation_id: CONV, message: 'And then?' });
  });

  it('shows an unread dot when an answer lands while minimized', async () => {
    const stream = openStream();
    replies.push(stream.response);
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText(QUESTION);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    await act(async () => {
      stream.push(answer('Answer'));
      stream.finish();
    });
    await waitFor(() => expect(helpButton()).toHaveAccessibleName('Help — new answer'));
    await openPanel();
    expect(helpButton()).toHaveAccessibleName('Help');
  });

  it('restores an open conversation after a reload', async () => {
    replies.push(sseResponse(answer('Answer one.')));
    const first = renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Answer one.');
    first.unmount();
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).not.toBeNull();
    renderWidget();
    expect(await screen.findByRole('dialog', { name: 'HAIWAVE Help' })).toBeInTheDocument();
    expect(screen.getByText('Answer one.')).toBeInTheDocument();
  });

  it('unmount mid-stream, remount → interrupted + Retry resends (Review Focus #5)', async () => {
    const stream = openStream();
    replies.push(stream.response);
    const first = renderWidget();
    await openPanel();
    ask(QUESTION);
    await act(async () => {
      stream.push(ev('meta', meta()) + ev('delta', { text: 'Partial' }));
    });
    await screen.findByText('Partial');
    first.unmount(); // crossing from /account to /sourcing-map remounts the widget
    replies.push(sseResponse(answer('Full answer')));
    renderWidget();
    expect(await screen.findByText('Interrupted — ask again.')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Full answer')).toBeInTheDocument();
    expect(screen.queryByText('Interrupted — ask again.')).toBeNull();
    expect(helpBodies().at(-1)).toMatchObject({ message: QUESTION, conversation_id: CONV });
  });

  it('Close clears the conversation and its storage; reopening shows the intro', async () => {
    replies.push(sseResponse(answer('Answer one.')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Answer one.');
    fireEvent.click(screen.getByRole('button', { name: 'Close and clear this conversation' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull());
    await openPanel();
    expect(screen.getByText(/Ask where to find something in the console/)).toBeInTheDocument();
    expect(screen.queryByText('Answer one.')).toBeNull();
  });

  it('Reset starts a new conversation and stays open', async () => {
    replies.push(sseResponse(answer('Answer one.')));
    replies.push(sseResponse(answer('Fresh.')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Answer one.');
    fireEvent.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Answer one.')).toBeNull();
    ask(QUESTION);
    await screen.findByText('Fresh.');
    expect(helpBodies()[1]).not.toHaveProperty('conversation_id');
  });

  it('budget exhausted → daily-limit notice with the support contact', async () => {
    replies.push(jsonResponse(429, { error: { code: 'BUDGET_EXHAUSTED', message: 'x', details: { reset_at: '2026-10-08T00:00:00.000Z', contact: 'support@haiwave.ai' } } }));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText(/Daily help limit reached; resets 00:00 UTC\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@haiwave.ai' })).toHaveAttribute('href', 'mailto:support@haiwave.ai');
  });

  it('429 from the rate limiter shows "One moment…" and retries once after 6 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(jsonResponse(429, { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' } }));
    replies.push(sseResponse(answer('Answer')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(await screen.findByText('Answer')).toBeInTheDocument();
    expect(helpBodies()).toHaveLength(2);
    expect(screen.getAllByText(QUESTION)).toHaveLength(1);
    expect(screen.queryByText('One moment…')).toBeNull();
  });

  it('503 → "Help is temporarily unavailable."', async () => {
    replies.push(jsonResponse(503, { error: { code: 'NO_ACTIVE_PACK', message: 'x' } }));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Help is temporarily unavailable.')).toBeInTheDocument();
  });

  it('session expiry keeps the transcript and shows the sign-in notice (Review Focus #4)', async () => {
    replies.push(sseResponse(answer('First answer')));
    replies.push(jsonResponse(401, { error: 'Unauthorized' }));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('First answer');
    ask('And then?');
    expect(await screen.findByText('Your session ended — reload the page to sign in.')).toBeInTheDocument();
    expect(screen.getByText('First answer')).toBeInTheDocument();
    expect(screen.getByText('And then?')).toBeInTheDocument();
  });

  it('withheld answer offers the support summary', async () => {
    replies.push(sseResponse(ev('meta', meta()) + ev('error', { code: 'withheld', retryable: false })));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText("I can't help with that one.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Summarize for support' })[0]);
    expect(await screen.findByText('Problem: docker build fails at COPY.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@haiwave.ai' })).toHaveAttribute('href', 'mailto:support@haiwave.ai');
    expect(fetchMock.mock.calls.some(([u]) => u === `/api/help/conversations/${CONV}/case-summary`)).toBe(true);
  });

  it('model error → "Something went wrong" with Retry that resends the question', async () => {
    replies.push(sseResponse(ev('meta', meta()) + ev('error', { code: 'model_error', retryable: true })));
    replies.push(sseResponse(answer('Recovered.')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Something went wrong — try again.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Recovered.')).toBeInTheDocument();
    expect(helpBodies()).toHaveLength(2);
    expect(screen.getAllByText(QUESTION)).toHaveLength(1);
  });

  it('thumbs-down posts feedback, then the optional note', async () => {
    replies.push(sseResponse(answer('Answer')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Answer');
    fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'What was wrong? (optional)' }), { target: { value: 'Wrong page' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    await screen.findByText('Thanks for the feedback.');
    const posts = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/feedback'));
    expect(posts.map(([u]) => u)).toEqual([`/api/help/messages/${AMSG}/feedback`, `/api/help/messages/${AMSG}/feedback`]);
    expect(posts.map(([, init]) => JSON.parse((init as RequestInit).body as string))).toEqual([
      { rating: 'down' },
      { rating: 'down', note: 'Wrong page' },
    ]);
    expect(screen.getByRole('button', { name: 'Not helpful' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching language relabels the panel, persists, and is sent with the next question', async () => {
    replies.push(sseResponse(answer('답변')));
    renderWidget();
    await openPanel();
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'ko' } });
    expect(screen.getByRole('dialog', { name: 'HAIWAVE 도움말' })).toBeInTheDocument();
    expect(window.localStorage.getItem(HELP_LANG_KEY)).toBe('ko');
    ask('배포 방법?', { box: '메시지', send: '보내기' });
    await waitFor(() => expect(helpBodies()[0]).toMatchObject({ language: 'ko', message: '배포 방법?' }));
  });

  it('defaults to the browser language when it is one of the four', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['es-MX', 'en']);
    renderWidget();
    fireEvent.click(await screen.findByRole('button', { name: /^Ayuda/ }));
    expect(await screen.findByRole('dialog', { name: 'Ayuda de HAIWAVE' })).toBeInTheDocument();
  });
});

describe('HelpProvider: the stored panel state belongs to one signed-in user (amendment P3-7)', () => {
  const OWNER_A = 'owner-a';
  const OWNER_B = 'owner-b';
  const stateOfA: HelpWidgetState = {
    view: 'open',
    conversationId: CONV,
    unread: false,
    messages: [
      { id: 'u-a', role: 'user', text: 'Owner A private question', status: 'complete' },
      { id: 'a-a', role: 'assistant', text: 'Owner A private answer', status: 'complete' },
    ],
  };

  it("a state saved under owner A is neither shown to owner B nor left in storage", () => {
    saveWidgetState(stateOfA, OWNER_A);
    renderWidget(true, OWNER_B);
    expect(screen.queryAllByText(/Owner A private/)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(helpButton()).toHaveAttribute('aria-expanded', 'false');
    expect(window.sessionStorage.getItem(HELP_STATE_KEY) ?? '').not.toContain('Owner A private');
  });

  it("owner A's question and answer leave the screen and storage when the provider's owner becomes B", async () => {
    replies.push(sseResponse(answer('Owner A private answer.', meta({ redacted_message: 'Owner A private question' }))));
    const { rerender } = renderWidget(true, OWNER_A);
    await openPanel();
    ask('Owner A private question');
    await screen.findByText('Owner A private answer.');
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toContain('Owner A private answer.');
    rerender(widget(true, OWNER_B));
    expect(screen.queryAllByText(/Owner A private/)).toHaveLength(0);
    expect(window.sessionStorage.getItem(HELP_STATE_KEY) ?? '').not.toContain('Owner A private');
  });

  it('with no owner a question is still asked and answered in memory, and nothing is written to storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    replies.push(sseResponse(answer('Answer in memory.')));
    renderWidget(true, null);
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Answer in memory.')).toBeInTheDocument();
    expect(setItem.mock.calls.filter(([key]) => key === HELP_STATE_KEY)).toEqual([]);
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();
  });
});

// Implementer's pins (Task 3.8): listing lines that no case above drives, each red first.
describe('HelpProvider + HelpButton + HelpPanel (implementer pins)', () => {
  it('a second 429 on the automatic retry shows the error with Retry and schedules no further resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(RATE_LIMITED(), RATE_LIMITED());
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(await screen.findByText('Something went wrong — try again.')).toBeInTheDocument();
    expect(screen.getByText('One moment…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(helpBodies()).toHaveLength(2);
  });

  it('the automatic resend waits 6 s, not less', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(RATE_LIMITED(), sseResponse(answer('Answer')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(helpBodies()).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(await screen.findByText('Answer')).toBeInTheDocument();
    expect(helpBodies()).toHaveLength(2);
  });

  it('Close during the 6 s wait cancels the automatic resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(RATE_LIMITED());
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close and clear this conversation' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(helpBodies()).toHaveLength(1);
  });

  it('a new question during the 6 s wait replaces the automatic resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(RATE_LIMITED(), sseResponse(answer('Fresh answer.', meta({ redacted_message: 'Another question' }))));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    ask('Another question');
    expect(await screen.findByText('Fresh answer.')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(helpBodies().map((b) => b.message)).toEqual([QUESTION, 'Another question']);
  });

  it('leaving the page during the 6 s wait cancels the automatic resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(RATE_LIMITED());
    const { unmount } = renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(helpBodies()).toHaveLength(1);
  });

  it('404 (help switched off) → "Help is temporarily unavailable." and the question leaves no answer behind', async () => {
    replies.push(jsonResponse(404, { error: 'Not found' }));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Help is temporarily unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('Thinking…')).toBeNull();
  });

  it('any other HTTP error (400 VALIDATION_ERROR) → "Something went wrong" with Retry, and no automatic resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'bad' } }));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Something went wrong — try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(helpBodies()).toHaveLength(1);
  });

  it("the footer's Summarize waits for a finished answer, then asks for this conversation's summary", async () => {
    const stream = openStream();
    replies.push(stream.response);
    renderWidget();
    await openPanel();
    expect(footerSummarize()).toBeDisabled();
    ask(QUESTION);
    await act(async () => {
      stream.push(ev('meta', meta()) + ev('delta', { text: 'Partial' }));
    });
    await screen.findByText('Partial');
    expect(footerSummarize()).toBeDisabled();
    await act(async () => {
      stream.push(ev('done', DONE));
      stream.finish();
    });
    await waitFor(() => expect(footerSummarize()).toBeEnabled());
    fireEvent.click(footerSummarize());
    expect(await screen.findByText('Problem: docker build fails at COPY.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => u === `/api/help/conversations/${CONV}/case-summary`)).toBe(true);
  });

  it("the footer's Summarize stays disabled while there is no conversation yet, even beside an error answer", async () => {
    replies.push(jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'bad' } }));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Something went wrong — try again.')).toBeInTheDocument();
    expect(footerSummarize()).toBeDisabled();
  });

  it("a language the user chose before wins over the browser's", async () => {
    window.localStorage.setItem(HELP_LANG_KEY, 'pt-BR');
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['es-MX', 'en']);
    renderWidget();
    fireEvent.click(await screen.findByRole('button', { name: /^Ajuda/ }));
    expect(await screen.findByRole('dialog', { name: 'Ajuda HAIWAVE' })).toBeInTheDocument();
  });

  it('Stop ends the streaming answer: its text stays, marked interrupted with Retry, and Send is back', async () => {
    replyUntilAborted('Partial');
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Partial');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText('Interrupted — ask again.')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('a connection that breaks mid-answer keeps the text as interrupted; one that breaks before any text shows the error', async () => {
    replies.push(sseResponse(ev('meta', meta()) + ev('delta', { text: 'Half an answer' })));
    replies.push(sseResponse(ev('meta', meta({ redacted_message: 'And then?' }))));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Interrupted — ask again.')).toBeInTheDocument();
    expect(screen.getByText('Half an answer')).toBeInTheDocument();
    ask('And then?');
    expect(await screen.findByText('Something went wrong — try again.')).toBeInTheDocument();
    expect(screen.getAllByText('Interrupted — ask again.')).toHaveLength(1);
  });

  it('Close while an answer streams stops the request, and the reopened panel offers Send', async () => {
    replyUntilAborted('Partial');
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Partial');
    fireEvent.click(screen.getByRole('button', { name: 'Close and clear this conversation' }));
    const init = fetchMock.mock.calls.find(([u]) => u === '/api/help/messages')?.[1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
    await openPanel();
    expect(await screen.findByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.queryByText('Partial')).toBeNull();
  });

  it('Reset clears the support summary and the announcement of the last answer', async () => {
    replies.push(sseResponse(answer('Answer one.')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Answer one.');
    expect(screen.getByTestId('help-live')).toHaveTextContent('Answer one.');
    fireEvent.click(footerSummarize());
    expect(await screen.findByText('Problem: docker build fails at COPY.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(screen.queryByText('Problem: docker build fails at COPY.')).toBeNull();
    expect(screen.getByTestId('help-live')).toBeEmptyDOMElement();
  });

  it('the Help button minimizes an open panel and keeps the conversation', async () => {
    replies.push(sseResponse(answer('Answer one.')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    await screen.findByText('Answer one.');
    fireEvent.click(helpButton());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(helpButton()).toHaveAttribute('aria-expanded', 'false');
    await openPanel();
    expect(screen.getByText('Answer one.')).toBeInTheDocument();
  });

  it('the Help button names the panel it controls (aria-controls = the dialog id)', async () => {
    renderWidget();
    expect(helpButton()).toHaveAttribute('aria-controls', 'hw-help-panel');
    expect(await openPanel()).toHaveAttribute('id', 'hw-help-panel');
  });

  // Agreed with the Sourcing Map program (its run page has a page-wide Escape listener that skips targets
  // inside a role="dialog"): the panel is a non-modal dialog rendered in place, handles Escape on its own
  // element, stops it there, and never listens for keys on document or window.
  it('is a non-modal dialog rendered in place; Escape inside it minimizes, stops there, and no key listener goes on document or window', async () => {
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    const onDocument = vi.spyOn(document, 'addEventListener');
    const onWindow = vi.spyOn(window, 'addEventListener');
    try {
      replies.push(sseResponse(answer('Answer one.')));
      const { container } = renderWidget();
      const dialog = await openPanel();
      expect(dialog).toHaveAttribute('aria-modal', 'false');
      expect(container.contains(dialog)).toBe(true);
      ask(QUESTION);
      await screen.findByText('Answer one.');
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Message' }), { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(outside).not.toHaveBeenCalled();
      const keyListeners = [...onDocument.mock.calls, ...onWindow.mock.calls].filter(([type]) => /^key/i.test(String(type)));
      expect(keyListeners).toEqual([]);
    } finally {
      document.removeEventListener('keydown', outside);
    }
  });

  it('hydrates the server markup without a mismatch when storage holds an open panel, then shows that panel', async () => {
    const serverHtml = renderToString(widget()); // the server has no storage: closed, English
    saveWidgetState(
      {
        view: 'open',
        conversationId: CONV,
        unread: false,
        messages: [
          { id: 'u1', role: 'user', text: QUESTION, status: 'complete' },
          { id: 'a1', role: 'assistant', text: 'Stored answer.', status: 'complete' },
        ],
      },
      OWNER,
    );
    window.localStorage.setItem(HELP_LANG_KEY, 'ko');
    const host = document.createElement('div');
    host.innerHTML = serverHtml;
    document.body.appendChild(host);
    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(host, widget(), { onRecoverableError: recoverable });
      });
      expect(recoverable).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(await within(host).findByRole('dialog', { name: 'HAIWAVE 도움말' })).toBeInTheDocument();
      expect(within(host).getByText('Stored answer.')).toBeInTheDocument();
    } finally {
      act(() => root?.unmount());
      host.remove();
    }
  });

  it('a budget answer that names no contact falls back to support@haiwave.ai', async () => {
    replies.push(jsonResponse(429, { error: { code: 'BUDGET_EXHAUSTED', message: 'x', details: { reset_at: '2026-10-08T00:00:00.000Z' } } }));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText(/Daily help limit reached; resets 00:00 UTC\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'support@haiwave.ai' })).toHaveAttribute('href', 'mailto:support@haiwave.ai');
  });

  it('a support summary that cannot be made shows the failure line', async () => {
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.endsWith('/case-summary') ? jsonResponse(503, { error: { code: 'NO_ACTIVE_PACK', message: 'x' } }) : base?.(url, init),
    );
    replies.push(sseResponse(ev('meta', meta()) + ev('error', { code: 'withheld', retryable: false })));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText("I can't help with that one.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Summarize for support' })[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't create the summary — try again.");
  });
});

// Task 3.8 review, round 1: defects in the listing's widget (S1/D1, D2, D3, D4) and the missing pins.
describe('HelpProvider + HelpButton + HelpPanel (review round 1)', () => {
  const MODEL_ERROR = () => sseResponse(ev('meta', meta()) + ev('error', { code: 'model_error', retryable: true }));

  it('Retry on an older answer while a newer one streams keeps Stop offered for the retried answer', async () => {
    replies.push(MODEL_ERROR());
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Something went wrong — try again.')).toBeInTheDocument();
    replyUntilAborted('Streaming two');
    ask('Second question');
    await screen.findByText('Streaming two');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    replyUntilAborted('Retried one');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    // One help request at a time: the retry aborts the second answer, whose call ends after the retry began.
    expect(await screen.findByText('Interrupted — ask again.')).toBeInTheDocument();
    await screen.findByText('Retried one');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('Retry during the 6 s wait cancels the automatic resend, so nothing aborts the retried answer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    replies.push(MODEL_ERROR(), RATE_LIMITED(), sseResponse(answer('Retried answer.')), sseResponse(answer('Automatic resend.')));
    renderWidget();
    await openPanel();
    ask(QUESTION);
    expect(await screen.findByText('Something went wrong — try again.')).toBeInTheDocument();
    ask('Second question');
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]); // the first question's answer
    expect(await screen.findByText('Retried answer.')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(helpBodies().map((b) => b.message)).toEqual([QUESTION, 'Second question', QUESTION]);
    expect(screen.getByText('Retried answer.')).toBeInTheDocument();
    expect(screen.queryByText('Automatic resend.')).toBeNull();
  });

  it('a question rate-limited just before leaving the page is restored with Retry, and Retry resends it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const UNANSWERED = 'My unanswered question';
    replies.push(RATE_LIMITED());
    const first = renderWidget();
    await openPanel();
    ask(UNANSWERED);
    expect(await screen.findByText('One moment…')).toBeInTheDocument();
    first.unmount(); // crossing from /account to /sourcing-map during the 6 s wait
    replies.push(sseResponse(answer('Answered after all.', meta({ redacted_message: UNANSWERED }))));
    renderWidget();
    expect(await screen.findByText(UNANSWERED)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(helpBodies()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Answered after all.')).toBeInTheDocument();
    expect(helpBodies().map((b) => b.message)).toEqual([UNANSWERED, UNANSWERED]);
    expect(screen.getAllByText(UNANSWERED)).toHaveLength(1);
  });
});
