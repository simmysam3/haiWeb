// src/components/help/__tests__/help-storage.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import {
  HELP_STATE_KEY,
  HELP_LANG_KEY,
  HELP_MAX_STORED_MESSAGES,
  loadWidgetState,
  saveWidgetState,
  clearWidgetState,
  loadLanguage,
  saveLanguage,
  type HelpWidgetState,
  type StorageLike,
} from '../help-storage';

// The signed-in user the stored panel state belongs to (amendment P3-7): an opaque key, the same for one user.
const OWNER = 'owner-test';

const STATE: HelpWidgetState = {
  view: 'open',
  conversationId: '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10',
  messages: [
    { id: 'u1', serverId: 'b5d4c3a2-1f0e-4d9c-8b7a-6f5e4d3c2b1a', role: 'user', text: 'hi ‹redacted›', status: 'complete', redactionCount: 1 },
    { id: 'a1', role: 'assistant', text: 'Hello', status: 'complete', feedback: 'up' },
  ],
  pack: { guideEdition: '1.7', packDate: '2026-10-07', servedMatches: true },
  unread: false,
};

const throwing: StorageLike = {
  getItem: () => { throw new DOMException('blocked', 'SecurityError'); },
  setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
  removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
};

// A browser that blocks storage throws from the `window.sessionStorage` /
// `window.localStorage` getter itself, before any method is reached.
function blockWindowStorage(name: 'sessionStorage' | 'localStorage'): () => void {
  const original = Object.getOwnPropertyDescriptor(window, name);
  Object.defineProperty(window, name, {
    configurable: true,
    get() { throw new DOMException('blocked', 'SecurityError'); },
  });
  return () => {
    if (original) Object.defineProperty(window, name, original);
  };
}

// STATE with one field of its first message replaced. An undefined value drops the field from the stored JSON.
function firstMessageWith(patch: Record<string, unknown>): unknown {
  return { ...STATE, messages: [{ ...STATE.messages[0], ...patch }, STATE.messages[1]] };
}

// A working in-memory store: shows that each function uses the store it is given.
function memoryStore(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: (key) => { map.delete(key); },
  };
}

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('widget state storage', () => {
  it('round-trips through sessionStorage under hw-help:v1', () => {
    saveWidgetState(STATE, OWNER);
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).not.toBeNull();
    expect(loadWidgetState(OWNER)).toEqual(STATE);
  });

  it('keeps only the last 40 messages', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ id: `m${i}`, role: 'user' as const, text: `q${i}`, status: 'complete' as const }));
    saveWidgetState({ ...STATE, messages: many }, OWNER);
    const loaded = loadWidgetState(OWNER);
    expect(loaded?.messages).toHaveLength(HELP_MAX_STORED_MESSAGES);
    expect(loaded?.messages[0].id).toBe('m5');
    expect(loaded?.messages.at(-1)?.id).toBe('m44');
  });

  it('returns null for missing, corrupt or wrongly shaped state', () => {
    expect(loadWidgetState(OWNER)).toBeNull();
    window.sessionStorage.setItem(HELP_STATE_KEY, '{not json');
    expect(loadWidgetState(OWNER)).toBeNull();
    window.sessionStorage.setItem(HELP_STATE_KEY, JSON.stringify({ owner: OWNER, state: { view: 'sideways', messages: [] } }));
    expect(loadWidgetState(OWNER)).toBeNull();
  });

  it('clear removes the key', () => {
    saveWidgetState(STATE, OWNER);
    clearWidgetState();
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();
  });

  it('never throws when storage is blocked or full', () => {
    expect(loadWidgetState(OWNER, throwing)).toBeNull();
    expect(() => saveWidgetState(STATE, OWNER, throwing)).not.toThrow();
    expect(() => clearWidgetState(throwing)).not.toThrow();
    expect(loadLanguage(throwing)).toBeNull();
    expect(() => saveLanguage('ko', throwing)).not.toThrow();
  });

  it('never throws when window.sessionStorage itself is blocked', () => {
    const restore = blockWindowStorage('sessionStorage');
    try {
      expect(() => window.sessionStorage).toThrow('blocked');
      expect(loadWidgetState(OWNER)).toBeNull();
      expect(() => saveWidgetState(STATE, OWNER)).not.toThrow();
      expect(() => clearWidgetState()).not.toThrow();
    } finally {
      restore();
    }
  });

  it('stores the state under the contract key, the literal hw-help:v1 (C.6)', () => {
    expect(HELP_STATE_KEY).toBe('hw-help:v1');
    saveWidgetState(STATE, OWNER);
    expect(window.sessionStorage.getItem('hw-help:v1')).not.toBeNull();
  });

  // States the panel really stores (spec §7.3). Each one must come back from storage exactly as it was saved.
  it.each<[string, HelpWidgetState]>([
    ['no conversation yet', { ...STATE, conversationId: null, messages: [] }],
    ['no pack yet', { view: 'open', conversationId: STATE.conversationId, messages: STATE.messages, unread: false }],
    ['a minimized panel', { ...STATE, view: 'minimized' }],
    ['a closed panel', { ...STATE, view: 'closed' }],
    ['a streaming answer', { ...STATE, messages: [{ id: 'a9', role: 'assistant', text: 'x', status: 'streaming' }] }],
    ['an interrupted answer', { ...STATE, messages: [{ id: 'a9', role: 'assistant', text: 'x', status: 'interrupted' }] }],
    ['a withheld answer', { ...STATE, messages: [{ id: 'a9', role: 'assistant', text: 'x', status: 'withheld' }] }],
    ['a failed answer', { ...STATE, messages: [{ id: 'a9', role: 'assistant', text: 'x', status: 'error' }] }],
    ['the empty answer before its first delta', { ...STATE, messages: [{ id: 'a9', role: 'assistant', text: '', status: 'streaming' }] }],
    ['a thumbs-down', { ...STATE, messages: [{ id: 'a9', role: 'assistant', text: 'x', status: 'complete', feedback: 'down' }] }],
    ['a message with nothing redacted (redactionCount 0)', { ...STATE, messages: [{ id: 'u9', role: 'user', text: 'x', status: 'complete', redactionCount: 0 }] }],
    ['an unread answer', { ...STATE, unread: true }],
  ])('round-trips %s', (name, state) => {
    saveWidgetState(state, OWNER);
    expect(loadWidgetState(OWNER), name).toEqual(state);
  });

  it('round-trips a minimized state that holds every message status, and a closed state with no conversation and no pack', () => {
    const minimized: HelpWidgetState = {
      view: 'minimized',
      conversationId: '0b8a5a52-58b6-4a8e-9a39-9a1d4c7f1f10',
      messages: [
        { id: 'a1', role: 'assistant', text: 'one', status: 'complete', feedback: 'down' },
        { id: 'a2', role: 'assistant', text: 'two', status: 'streaming' },
        { id: 'a3', role: 'assistant', text: 'three', status: 'interrupted' },
        { id: 'a4', role: 'assistant', text: 'four', status: 'withheld' },
        { id: 'a5', role: 'assistant', text: 'five', status: 'error' },
      ],
      pack: { guideEdition: '1.7', packDate: '2026-10-07', servedMatches: false },
      unread: true,
    };
    saveWidgetState(minimized, OWNER);
    expect(loadWidgetState(OWNER)).toEqual(minimized);

    const closed: HelpWidgetState = { view: 'closed', conversationId: null, messages: [], unread: false };
    saveWidgetState(closed, OWNER);
    expect(loadWidgetState(OWNER)).toEqual(closed);
  });

  // One wrong field is enough. The stored value is right everywhere else: the first assertion is the control.
  it.each<[string, unknown]>([
    ['view', { ...STATE, view: 'sideways' }],
    ['unread', { ...STATE, unread: 'no' }],
    ['conversationId', { ...STATE, conversationId: 42 }],
    ['pack', { ...STATE, pack: { guideEdition: '1.7' } }],
    ['the status of a message', firstMessageWith({ status: 'pending' })],
    ['the role of a message', firstMessageWith({ role: 'system' })],
    ['the text of a message (missing)', firstMessageWith({ text: undefined })],
    ['the feedback of a message', firstMessageWith({ feedback: 'meh' })],
  ])('refuses a stored state that is wrong only in %s', (field, wrong) => {
    window.sessionStorage.setItem('hw-help:v1', JSON.stringify({ owner: OWNER, state: STATE }));
    expect(loadWidgetState(OWNER), 'control').toEqual(STATE);
    window.sessionStorage.setItem('hw-help:v1', JSON.stringify({ owner: OWNER, state: wrong }));
    expect(loadWidgetState(OWNER), field).toBeNull();
  });

  it('saveWidgetState writes to the store it is given, not to sessionStorage', () => {
    const store = memoryStore();
    saveWidgetState(STATE, OWNER, store);
    expect(store.map.has('hw-help:v1')).toBe(true);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('loadWidgetState reads the store it is given', () => {
    const store = memoryStore();
    store.map.set('hw-help:v1', JSON.stringify({ owner: OWNER, state: STATE }));
    expect(loadWidgetState(OWNER, store)).toEqual(STATE);
  });

  it('clearWidgetState clears the store it is given', () => {
    const store = memoryStore();
    store.map.set('hw-help:v1', JSON.stringify(STATE));
    clearWidgetState(store);
    expect(store.map.has('hw-help:v1')).toBe(false);
  });
});

// The stored panel state belongs to one signed-in user (amendment P3-7): the next user of the tab never gets it back.
describe('widget state owner', () => {
  it('round-trips under its owner, stored as { owner, state }', () => {
    saveWidgetState(STATE, OWNER);
    expect(JSON.parse(window.sessionStorage.getItem(HELP_STATE_KEY) ?? 'null')).toEqual({ owner: OWNER, state: STATE });
    expect(loadWidgetState(OWNER)).toEqual(STATE);
  });

  it('a load under a different owner returns null and removes the entry', () => {
    saveWidgetState(STATE, OWNER);
    expect(loadWidgetState('owner-other')).toBeNull();
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();
  });

  it('an entry in the old bare shape, with no owner, returns null and is removed', () => {
    window.sessionStorage.setItem(HELP_STATE_KEY, JSON.stringify(STATE));
    expect(loadWidgetState(OWNER)).toBeNull();
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();
  });

  it('with no owner, a load returns null and removes the entry, and a save writes nothing', () => {
    saveWidgetState(STATE, OWNER);
    expect(loadWidgetState(null)).toBeNull();
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();
    // An entry whose owner is also null still belongs to nobody.
    window.sessionStorage.setItem(HELP_STATE_KEY, JSON.stringify({ owner: null, state: STATE }));
    expect(loadWidgetState(null)).toBeNull();
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();

    saveWidgetState(STATE, null);
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();
  });

  it("a load that has to remove another user's entry never throws when removal is blocked", () => {
    let removals = 0;
    const store: StorageLike = {
      getItem: () => JSON.stringify({ owner: 'owner-other', state: STATE }),
      setItem: () => {},
      removeItem: () => {
        removals += 1;
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    expect(loadWidgetState(OWNER, store)).toBeNull();
    expect(removals).toBe(1);
  });
});

describe('language storage', () => {
  it('round-trips under hw-help:lang in localStorage', () => {
    saveLanguage('pt-BR');
    expect(window.localStorage.getItem(HELP_LANG_KEY)).toBe('pt-BR');
    expect(loadLanguage()).toBe('pt-BR');
  });

  it('ignores an unknown stored value', () => {
    window.localStorage.setItem(HELP_LANG_KEY, 'fr');
    expect(loadLanguage()).toBeNull();
  });

  it('never throws when window.localStorage itself is blocked', () => {
    const restore = blockWindowStorage('localStorage');
    try {
      expect(() => window.localStorage).toThrow('blocked');
      expect(loadLanguage()).toBeNull();
      expect(() => saveLanguage('ko')).not.toThrow();
    } finally {
      restore();
    }
  });

  it('stores the language under the contract key, the literal hw-help:lang (C.6)', () => {
    expect(HELP_LANG_KEY).toBe('hw-help:lang');
    saveLanguage('es');
    expect(window.localStorage.getItem('hw-help:lang')).toBe('es');
  });

  it('saveLanguage writes to the store it is given, not to localStorage', () => {
    const store = memoryStore();
    saveLanguage('ko', store);
    expect(store.map.get('hw-help:lang')).toBe('ko');
    expect(window.localStorage.length).toBe(0);
  });

  it('loadLanguage reads the store it is given', () => {
    const store = memoryStore();
    store.map.set('hw-help:lang', 'es');
    expect(loadLanguage(store)).toBe('es');
  });
});
