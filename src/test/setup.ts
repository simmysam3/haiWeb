import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom in this environment does not expose window.localStorage (the document
// has an opaque origin, so the Storage API is unavailable). Components and tests
// that read session stickiness (LAST_ACCOUNT_PATH_KEY) need it, so provide a
// minimal in-memory polyfill when it's missing.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

// Make globalThis.crypto patchable so tests can mock crypto.subtle via Object.assign.
// Node's globalThis.crypto exposes `subtle` as a non-writable getter on the prototype,
// so Object.assign(globalThis.crypto, { subtle: ... }) throws. We replace crypto with a
// plain object that forwards real methods but allows tests to overwrite `subtle`.
{
  const _real = globalThis.crypto;
  const _stub = {
    getRandomValues: _real.getRandomValues.bind(_real),
    randomUUID: _real.randomUUID.bind(_real),
    subtle: _real.subtle,
  } as Crypto;
  Object.defineProperty(globalThis, 'crypto', {
    value: _stub,
    configurable: true,
    writable: true,
  });
}
