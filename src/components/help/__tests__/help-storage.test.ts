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

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('widget state storage', () => {
  it('round-trips through sessionStorage under hw-help:v1', () => {
    saveWidgetState(STATE);
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).not.toBeNull();
    expect(loadWidgetState()).toEqual(STATE);
  });

  it('keeps only the last 40 messages', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ id: `m${i}`, role: 'user' as const, text: `q${i}`, status: 'complete' as const }));
    saveWidgetState({ ...STATE, messages: many });
    const loaded = loadWidgetState();
    expect(loaded?.messages).toHaveLength(HELP_MAX_STORED_MESSAGES);
    expect(loaded?.messages[0].id).toBe('m5');
    expect(loaded?.messages.at(-1)?.id).toBe('m44');
  });

  it('returns null for missing, corrupt or wrongly shaped state', () => {
    expect(loadWidgetState()).toBeNull();
    window.sessionStorage.setItem(HELP_STATE_KEY, '{not json');
    expect(loadWidgetState()).toBeNull();
    window.sessionStorage.setItem(HELP_STATE_KEY, JSON.stringify({ view: 'sideways', messages: [] }));
    expect(loadWidgetState()).toBeNull();
  });

  it('clear removes the key', () => {
    saveWidgetState(STATE);
    clearWidgetState();
    expect(window.sessionStorage.getItem(HELP_STATE_KEY)).toBeNull();
  });

  it('never throws when storage is blocked or full', () => {
    expect(loadWidgetState(throwing)).toBeNull();
    expect(() => saveWidgetState(STATE, throwing)).not.toThrow();
    expect(() => clearWidgetState(throwing)).not.toThrow();
    expect(loadLanguage(throwing)).toBeNull();
    expect(() => saveLanguage('ko', throwing)).not.toThrow();
  });

  it('never throws when window.sessionStorage itself is blocked', () => {
    const restore = blockWindowStorage('sessionStorage');
    try {
      expect(() => window.sessionStorage).toThrow('blocked');
      expect(loadWidgetState()).toBeNull();
      expect(() => saveWidgetState(STATE)).not.toThrow();
      expect(() => clearWidgetState()).not.toThrow();
    } finally {
      restore();
    }
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
});
