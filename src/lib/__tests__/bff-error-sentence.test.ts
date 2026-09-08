import { describe, it, expect } from 'vitest';
import { bffErrorSentence } from '../bff-error-sentence';

describe('bffErrorSentence', () => {
  it('returns a string error verbatim', () => {
    expect(bffErrorSentence({ error: 'No counterparty manifest on file yet' }, 'fallback')).toBe('No counterparty manifest on file yet');
  });
  it('returns the fallback for a relayed haiCore envelope', () => {
    expect(bffErrorSentence({ error: { code: 'NOT_FOUND', message: 'internal' } }, 'The manifest could not be saved.')).toBe('The manifest could not be saved.');
  });
  it('returns the fallback for a missing or unparseable body', () => {
    expect(bffErrorSentence(null, 'fallback')).toBe('fallback');
    expect(bffErrorSentence(undefined, 'fallback')).toBe('fallback');
    expect(bffErrorSentence({}, 'fallback')).toBe('fallback');
  });
  it('returns the fallback for an empty string, which would render as nothing', () => {
    expect(bffErrorSentence({ error: '' }, 'fallback')).toBe('fallback');
  });
});
