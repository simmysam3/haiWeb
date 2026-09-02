import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDefinitionTab } from '../definition-tab';

/**
 * v1.85 — `parseDefinitionTab` is called by SERVER page components to read
 * `?tab=`. It first lived inside the 'use client' tabs module, which jsdom
 * tests happily import but Next refuses at runtime ("Attempted to call
 * parseDefinitionTab() from the server but parseDefinitionTab is on the
 * client") — both definition pages answered 500 on the walk server. The
 * parser therefore lives in a plain module, and this test pins that.
 */
describe('parseDefinitionTab', () => {
  it('opens configuration only for the exact value', () => {
    expect(parseDefinitionTab('configuration')).toBe('configuration');
  });

  it('opens runs for runs, absent, unknown, and repeated params', () => {
    expect(parseDefinitionTab('runs')).toBe('runs');
    expect(parseDefinitionTab(undefined)).toBe('runs');
    expect(parseDefinitionTab('bogus')).toBe('runs');
    expect(parseDefinitionTab(['configuration', 'runs'])).toBe('runs');
  });

  it('lives in a server-safe module (no "use client" directive)', () => {
    const src = readFileSync(resolve(__dirname, '../definition-tab.ts'), 'utf8');
    expect(src).not.toMatch(/^\s*['"]use client['"]/m);
  });
});
