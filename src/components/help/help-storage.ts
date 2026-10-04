// src/components/help/help-storage.ts
import { z } from 'zod';
import type { HelpLanguage } from '@haiwave/protocol';
import { isHelpLanguage } from './strings';

export const HELP_STATE_KEY = 'hw-help:v1';
export const HELP_LANG_KEY = 'hw-help:lang';
export const HELP_MAX_STORED_MESSAGES = 40;

const HelpUiMessageSchema = z.object({
  id: z.string().min(1),
  serverId: z.string().optional(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  status: z.enum(['complete', 'streaming', 'interrupted', 'withheld', 'error']),
  feedback: z.enum(['up', 'down']).optional(),
  redactionCount: z.number().int().nonnegative().optional(),
});

const HelpWidgetStateSchema = z.object({
  view: z.enum(['open', 'minimized', 'closed']),
  conversationId: z.string().nullable(),
  messages: z.array(HelpUiMessageSchema),
  pack: z.object({ guideEdition: z.string(), packDate: z.string(), servedMatches: z.boolean() }).optional(),
  unread: z.boolean(),
});

export type HelpUiMessage = z.infer<typeof HelpUiMessageSchema>;
export type HelpMessageStatus = HelpUiMessage['status'];
export type HelpWidgetState = z.infer<typeof HelpWidgetStateSchema>;
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Storage can be absent (SSR), blocked (privacy settings) or throw on access; every
// read/write below is wrapped so the panel still works in memory (spec §7.2).
function sessionStore(): StorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function localStore(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadWidgetState(store: StorageLike | null = sessionStore()): HelpWidgetState | null {
  try {
    const raw = store?.getItem(HELP_STATE_KEY);
    if (!raw) return null;
    const parsed = HelpWidgetStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveWidgetState(state: HelpWidgetState, store: StorageLike | null = sessionStore()): void {
  const capped: HelpWidgetState = { ...state, messages: state.messages.slice(-HELP_MAX_STORED_MESSAGES) };
  try {
    store?.setItem(HELP_STATE_KEY, JSON.stringify(capped));
  } catch {
    // Quota exceeded or storage blocked: keep going in memory.
  }
}

export function clearWidgetState(store: StorageLike | null = sessionStore()): void {
  try {
    store?.removeItem(HELP_STATE_KEY);
  } catch {
    // Storage blocked: nothing persisted to clear.
  }
}

export function loadLanguage(store: StorageLike | null = localStore()): HelpLanguage | null {
  try {
    const value = store?.getItem(HELP_LANG_KEY);
    return isHelpLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveLanguage(lang: HelpLanguage, store: StorageLike | null = localStore()): void {
  try {
    store?.setItem(HELP_LANG_KEY, lang);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}
