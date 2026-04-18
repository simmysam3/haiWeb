import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

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
