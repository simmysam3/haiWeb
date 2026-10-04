// src/components/help/__tests__/help-state.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { helpReducer, INITIAL_HELP_STATE, rehydrate, toStored, type HelpState } from '../help-state';
import { loadWidgetState, saveWidgetState } from '../help-storage';

const CONV = '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10';
const UMSG = 'b5d4c3a2-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
const AMSG = 'c6e5d4b3-2a1f-4e0d-9c8b-7a6f5e4d3c2b';
const META = {
  conversation_id: CONV,
  user_message_id: UMSG,
  redacted_message: 'KEY=‹redacted›',
  redaction_count: 1,
  pack: { version: '2026-10-07.1', guide_edition: '1.7', pack_date: '2026-10-07' },
  served: { guide_sha: null, agent_version: null, matches_pack: false },
};
const DONE = { assistant_message_id: AMSG, finish_reason: 'STOP', usage: { input: 1, cached: 0, output: 1 } };

const openState: HelpState = { ...INITIAL_HELP_STATE, view: 'open' };
const sent = helpReducer(openState, { type: 'send', userId: 'u1', assistantId: 'a1', text: 'KEY=abc' });
const answer = (s: HelpState) => s.messages.find((m) => m.id === 'a1');

afterEach(() => {
  window.sessionStorage.clear();
});

describe('helpReducer', () => {
  it('open clears the unread dot; minimize keeps the conversation; close empties it', () => {
    const minimized = helpReducer({ ...sent, unread: true, view: 'minimized' }, { type: 'open' });
    expect(minimized).toMatchObject({ view: 'open', unread: false });
    expect(helpReducer(sent, { type: 'minimize' })).toMatchObject({ view: 'minimized', messages: sent.messages });
    expect(helpReducer(sent, { type: 'close' })).toEqual(INITIAL_HELP_STATE);
  });

  it('minimize does nothing while closed', () => {
    expect(helpReducer(INITIAL_HELP_STATE, { type: 'minimize' })).toBe(INITIAL_HELP_STATE);
  });

  it('reset clears messages and the conversation but stays open', () => {
    const withConv = helpReducer(sent, { type: 'meta', userId: 'u1', assistantId: 'a1', meta: META });
    const reset = helpReducer(withConv, { type: 'reset' });
    expect(reset).toMatchObject({ view: 'open', conversationId: null, messages: [], notice: null });
  });

  it('reset keeps the pack info, so the footer still shows the edition line', () => {
    const pack = { guideEdition: '1.7', packDate: '2026-10-07', servedMatches: true };
    expect(helpReducer({ ...sent, pack }, { type: 'reset' }).pack).toEqual(pack);
  });

  it('send appends the question and a streaming answer, and clears any notice', () => {
    const s = helpReducer({ ...openState, notice: { kind: 'rate_limited' } }, { type: 'send', userId: 'u1', assistantId: 'a1', text: 'hi' });
    expect(s.notice).toBeNull();
    expect(s.messages).toEqual([
      { id: 'u1', role: 'user', text: 'hi', status: 'complete' },
      { id: 'a1', role: 'assistant', text: '', status: 'streaming' },
    ]);
  });

  it('a second send keeps the earlier exchange above the new one', () => {
    const s = helpReducer(sent, { type: 'send', userId: 'u2', assistantId: 'a2', text: 'and then?' });
    expect(s.messages.map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
  });

  it('meta swaps in the redacted question, the conversation id and the pack info', () => {
    const s = helpReducer(sent, { type: 'meta', userId: 'u1', assistantId: 'a1', meta: META });
    expect(s.messages[0]).toMatchObject({ serverId: UMSG, text: 'KEY=‹redacted›', redactionCount: 1 });
    expect(s.conversationId).toBe(CONV);
    expect(s.pack).toEqual({ guideEdition: '1.7', packDate: '2026-10-07', servedMatches: false });
  });

  it('meta records a served guide that matches the pack', () => {
    const matching = { ...META, served: { guide_sha: 'a'.repeat(64), agent_version: '1.103.0', matches_pack: true } };
    expect(helpReducer(sent, { type: 'meta', userId: 'u1', assistantId: 'a1', meta: matching }).pack?.servedMatches).toBe(true);
  });

  it('delta appends; done completes the answer with its server id', () => {
    let s = helpReducer(sent, { type: 'delta', assistantId: 'a1', text: 'Run ' });
    s = helpReducer(s, { type: 'delta', assistantId: 'a1', text: 'npm ci' });
    s = helpReducer(s, { type: 'done', assistantId: 'a1', done: DONE });
    expect(answer(s)).toMatchObject({ text: 'Run npm ci', status: 'complete', serverId: AMSG });
  });

  it('done while minimized raises the unread dot; while open it does not', () => {
    expect(helpReducer({ ...sent, view: 'minimized' }, { type: 'done', assistantId: 'a1', done: DONE }).unread).toBe(true);
    expect(helpReducer(sent, { type: 'done', assistantId: 'a1', done: DONE }).unread).toBe(false);
  });

  it('withheld drops the partial text; a model error keeps it and marks error', () => {
    const partial = helpReducer(sent, { type: 'delta', assistantId: 'a1', text: 'The brief says' });
    expect(answer(helpReducer(partial, { type: 'stream_error', assistantId: 'a1', code: 'withheld' }))).toMatchObject({ text: '', status: 'withheld' });
    expect(answer(helpReducer(partial, { type: 'stream_error', assistantId: 'a1', code: 'model_error' }))).toMatchObject({ text: 'The brief says', status: 'error' });
  });

  it('a model timeout keeps the partial text and marks error, like a model error', () => {
    const partial = helpReducer(sent, { type: 'delta', assistantId: 'a1', text: 'The brief says' });
    expect(answer(helpReducer(partial, { type: 'stream_error', assistantId: 'a1', code: 'model_timeout' }))).toMatchObject({ text: 'The brief says', status: 'error' });
  });

  it('a stream error while minimized raises the unread dot; while open it does not', () => {
    expect(helpReducer({ ...sent, view: 'minimized' }, { type: 'stream_error', assistantId: 'a1', code: 'withheld' }).unread).toBe(true);
    expect(helpReducer(sent, { type: 'stream_error', assistantId: 'a1', code: 'withheld' }).unread).toBe(false);
  });

  it('interrupted and errored set their statuses', () => {
    expect(answer(helpReducer(sent, { type: 'interrupted', assistantId: 'a1' }))?.status).toBe('interrupted');
    expect(answer(helpReducer(sent, { type: 'errored', assistantId: 'a1' }))?.status).toBe('error');
  });

  it('interrupted and errored keep the partial answer (spec §7.5)', () => {
    const partial = helpReducer(sent, { type: 'delta', assistantId: 'a1', text: 'Open Agents, then' });
    expect(answer(helpReducer(partial, { type: 'interrupted', assistantId: 'a1' }))?.text).toBe('Open Agents, then');
    expect(answer(helpReducer(partial, { type: 'errored', assistantId: 'a1' }))?.text).toBe('Open Agents, then');
  });

  it('failed drops the empty answer, keeps the question and shows the notice', () => {
    const s = helpReducer(sent, { type: 'failed', assistantId: 'a1', notice: { kind: 'session_expired' } });
    expect(s.messages.map((m) => m.id)).toEqual(['u1']);
    expect(s.notice).toEqual({ kind: 'session_expired' });
  });

  it('remove_exchange drops the answer and the question before it', () => {
    expect(helpReducer(sent, { type: 'remove_exchange', assistantId: 'a1' }).messages).toEqual([]);
  });

  it('remove_exchange of an answer that is not there leaves the state as it was', () => {
    const two = helpReducer(sent, { type: 'send', userId: 'u2', assistantId: 'a2', text: 'and then?' });
    const s = helpReducer(two, { type: 'remove_exchange', assistantId: 'gone' });
    expect(s.messages.map((m) => m.id)).toEqual(['u1', 'a1', 'u2', 'a2']);
    expect(s).toBe(two);
  });

  it('remove_exchange keeps the exchanges before and after it', () => {
    const two = helpReducer(sent, { type: 'send', userId: 'u2', assistantId: 'a2', text: 'and then?' });
    const three = helpReducer(two, { type: 'send', userId: 'u3', assistantId: 'a3', text: 'and after that?' });
    expect(helpReducer(three, { type: 'remove_exchange', assistantId: 'a2' }).messages.map((m) => m.id)).toEqual(['u1', 'a1', 'u3', 'a3']);
  });

  it('remove_exchange of an answer at the top of the list removes only that answer (the 40-message cap can cut its question off)', () => {
    const topAnswer: HelpState = {
      ...sent,
      messages: [{ id: 'a0', role: 'assistant', text: 'Earlier answer', status: 'complete' }, ...sent.messages],
    };
    expect(helpReducer(topAnswer, { type: 'remove_exchange', assistantId: 'a0' }).messages.map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('remove_exchange takes the message before the answer only when it is a question', () => {
    const twoAnswers: HelpState = {
      ...sent,
      messages: [...sent.messages, { id: 'a2', role: 'assistant', text: 'Another answer', status: 'complete' }],
    };
    expect(helpReducer(twoAnswers, { type: 'remove_exchange', assistantId: 'a2' }).messages.map((m) => m.id)).toEqual(['u1', 'a1']);
  });

  it('notice sets the panel notice and clears it with null, leaving the messages alone', () => {
    const budget = { kind: 'budget_exhausted' as const, resetAt: '2026-10-08T00:00:00Z', contact: 'support@haiwave.ai' };
    const shown = helpReducer(sent, { type: 'notice', notice: budget });
    expect(shown).toMatchObject({ notice: budget, messages: sent.messages });
    expect(helpReducer(shown, { type: 'notice', notice: null }).notice).toBeNull();
  });

  it('feedback records the rating on the message', () => {
    expect(answer(helpReducer(sent, { type: 'feedback', messageId: 'a1', rating: 'down' }))?.feedback).toBe('down');
  });

  it('ignores updates for a message that no longer exists', () => {
    expect(helpReducer(sent, { type: 'delta', assistantId: 'gone', text: 'x' })).toBe(sent);
  });
});

describe('persistence', () => {
  it('rehydrated streaming message becomes interrupted (Review Focus #5)', () => {
    const streaming = helpReducer(sent, { type: 'delta', assistantId: 'a1', text: 'Partial' });
    saveWidgetState(toStored(streaming));
    const restored = rehydrate(loadWidgetState());
    expect(answer(restored)).toMatchObject({ text: 'Partial', status: 'interrupted' });
    expect(restored.view).toBe('open');
  });

  it('rehydrate leaves every message that was not streaming as it was', () => {
    const finished: HelpState = {
      ...sent,
      messages: [
        { id: 'u1', role: 'user', text: 'q1', status: 'complete' },
        { id: 'a1', role: 'assistant', text: 'done', status: 'complete' },
        { id: 'a2', role: 'assistant', text: '', status: 'withheld' },
        { id: 'a3', role: 'assistant', text: 'part', status: 'error' },
        { id: 'a4', role: 'assistant', text: 'cut', status: 'interrupted' },
      ],
    };
    expect(rehydrate(toStored(finished)).messages).toEqual(finished.messages);
  });

  it('never persists the notice', () => {
    expect(toStored({ ...sent, notice: { kind: 'unavailable' } })).not.toHaveProperty('notice');
    expect(rehydrate(toStored(sent)).notice).toBeNull();
  });

  it('toStored keeps the pack info and a raised unread dot', () => {
    const pack = { guideEdition: '1.7', packDate: '2026-10-07', servedMatches: true };
    const minimized: HelpState = { ...sent, view: 'minimized', conversationId: CONV, unread: true, pack };
    expect(toStored(minimized)).toEqual({ view: 'minimized', conversationId: CONV, messages: sent.messages, unread: true, pack });
  });

  it('rehydrate(null) is the initial closed state', () => {
    expect(rehydrate(null)).toEqual(INITIAL_HELP_STATE);
  });

  it('the initial state is closed and empty, with no unread dot, notice or pack info', () => {
    expect(INITIAL_HELP_STATE).toStrictEqual({ view: 'closed', conversationId: null, messages: [], unread: false, notice: null });
  });
});
