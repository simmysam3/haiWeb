// src/components/help/help-state.ts
import type { HelpDoneEvent, HelpErrorEvent, HelpMetaEvent } from '@haiwave/protocol';
import type { HelpUiMessage, HelpWidgetState } from './help-storage';

/** Panel-level notices (spec §7.5). Never persisted. */
export type HelpNotice =
  | { kind: 'budget_exhausted'; resetAt: string | null; contact: string }
  | { kind: 'rate_limited' }
  | { kind: 'unavailable' }
  | { kind: 'session_expired' };

export interface HelpState extends HelpWidgetState {
  notice: HelpNotice | null;
}

export type HelpAction =
  | { type: 'open' }
  | { type: 'minimize' }
  | { type: 'close' }
  | { type: 'reset' }
  | { type: 'send'; userId: string; assistantId: string; text: string }
  | { type: 'meta'; userId: string; assistantId: string; meta: HelpMetaEvent }
  | { type: 'delta'; assistantId: string; text: string }
  | { type: 'done'; assistantId: string; done: HelpDoneEvent }
  | { type: 'stream_error'; assistantId: string; code: HelpErrorEvent['code'] }
  | { type: 'interrupted'; assistantId: string }
  | { type: 'errored'; assistantId: string }
  | { type: 'failed'; assistantId: string; notice: HelpNotice }
  | { type: 'remove_exchange'; assistantId: string }
  | { type: 'notice'; notice: HelpNotice | null }
  | { type: 'feedback'; messageId: string; rating: 'up' | 'down' };

export const INITIAL_HELP_STATE: HelpState = {
  view: 'closed',
  conversationId: null,
  messages: [],
  unread: false,
  notice: null,
};

export function rehydrate(stored: HelpWidgetState | null): HelpState {
  if (!stored) return INITIAL_HELP_STATE;
  return {
    ...stored,
    notice: null,
    // A stored 'streaming' answer was cut off by a reload or by crossing between the
    // account and sourcing-map layouts (Review Focus #5): show it as interrupted.
    messages: stored.messages.map((m) => (m.status === 'streaming' ? { ...m, status: 'interrupted' } : m)),
  };
}

export function toStored(state: HelpState): HelpWidgetState {
  return {
    view: state.view,
    conversationId: state.conversationId,
    messages: state.messages,
    unread: state.unread,
    ...(state.pack ? { pack: state.pack } : {}),
  };
}

function patchMessage(state: HelpState, id: string, patch: (m: HelpUiMessage) => HelpUiMessage): HelpState {
  if (!state.messages.some((m) => m.id === id)) return state;
  return { ...state, messages: state.messages.map((m) => (m.id === id ? patch(m) : m)) };
}

function flagUnread(state: HelpState): HelpState {
  return state.view === 'minimized' ? { ...state, unread: true } : state;
}

export function helpReducer(state: HelpState, action: HelpAction): HelpState {
  switch (action.type) {
    case 'open':
      return { ...state, view: 'open', unread: false };
    case 'minimize':
      return state.view === 'open' ? { ...state, view: 'minimized' } : state;
    case 'close':
      return INITIAL_HELP_STATE;
    case 'reset':
      return { ...INITIAL_HELP_STATE, view: 'open', ...(state.pack ? { pack: state.pack } : {}) };
    case 'send':
      return {
        ...state,
        notice: null,
        messages: [
          ...state.messages,
          { id: action.userId, role: 'user', text: action.text, status: 'complete' },
          { id: action.assistantId, role: 'assistant', text: '', status: 'streaming' },
        ],
      };
    case 'meta': {
      const { meta } = action;
      const next = patchMessage(state, action.userId, (m) => ({
        ...m,
        serverId: meta.user_message_id,
        text: meta.redacted_message,
        redactionCount: meta.redaction_count,
      }));
      return {
        ...next,
        conversationId: meta.conversation_id,
        pack: { guideEdition: meta.pack.guide_edition, packDate: meta.pack.pack_date, servedMatches: meta.served.matches_pack },
      };
    }
    case 'delta':
      return patchMessage(state, action.assistantId, (m) => ({ ...m, text: m.text + action.text }));
    case 'done':
      return flagUnread(
        patchMessage(state, action.assistantId, (m) => ({ ...m, serverId: action.done.assistant_message_id, status: 'complete' })),
      );
    case 'stream_error':
      return flagUnread(
        patchMessage(state, action.assistantId, (m) =>
          action.code === 'withheld' ? { ...m, text: '', status: 'withheld' } : { ...m, status: 'error' },
        ),
      );
    case 'interrupted':
      return patchMessage(state, action.assistantId, (m) => ({ ...m, status: 'interrupted' }));
    case 'errored':
      return patchMessage(state, action.assistantId, (m) => ({ ...m, status: 'error' }));
    case 'failed':
      return { ...state, notice: action.notice, messages: state.messages.filter((m) => m.id !== action.assistantId) };
    case 'remove_exchange': {
      const at = state.messages.findIndex((m) => m.id === action.assistantId);
      if (at === -1) return state;
      const from = at > 0 && state.messages[at - 1].role === 'user' ? at - 1 : at;
      return { ...state, messages: [...state.messages.slice(0, from), ...state.messages.slice(at + 1)] };
    }
    case 'notice':
      return { ...state, notice: action.notice };
    case 'feedback':
      return patchMessage(state, action.messageId, (m) => ({ ...m, feedback: action.rating }));
  }
}
