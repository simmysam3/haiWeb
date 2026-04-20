import { describe, it, expect } from 'vitest';
import { PROVENANCE_ERROR_COPY, mapProvenanceError } from '../provenance-key-errors';

const EXPECTED_CODES = [
  'PROVENANCE_KEY_NOT_FOUND',
  'PROVENANCE_KEY_REVOKED',
  'PROVENANCE_KEY_EXPIRED',
  'PROVENANCE_KEY_DISABLED',
  'SHARING_POLICY_MISMATCH',
  'INVALID_REQUESTED_FIELD',
  'ALREADY_INSTALLED',
  'NOT_GENERATOR',
  'NOT_INSTALLER',
  'INSTALLATION_NOT_FOUND',
  'INSTALLATION_REMOVED',
] as const;

describe('PROVENANCE_ERROR_COPY', () => {
  for (const code of EXPECTED_CODES) {
    it(`maps ${code} to non-empty user-facing copy`, () => {
      expect(PROVENANCE_ERROR_COPY[code]).toBeTruthy();
      expect(typeof PROVENANCE_ERROR_COPY[code]).toBe('string');
      expect(PROVENANCE_ERROR_COPY[code].length).toBeGreaterThan(0);
    });
  }
});

describe('mapProvenanceError', () => {
  it('returns mapped copy for a known error envelope', () => {
    const err = { error: { code: 'PROVENANCE_KEY_NOT_FOUND', message: 'x' } };
    expect(mapProvenanceError(err)).toBe(PROVENANCE_ERROR_COPY.PROVENANCE_KEY_NOT_FOUND);
  });

  it('returns generic fallback for unknown error code', () => {
    const err = { error: { code: 'UNKNOWN_CODE', message: 'x' } };
    expect(mapProvenanceError(err)).toMatch(/something went wrong/i);
  });

  it('returns generic fallback for a non-envelope value', () => {
    expect(mapProvenanceError(null)).toMatch(/something went wrong/i);
    expect(mapProvenanceError(undefined)).toMatch(/something went wrong/i);
    expect(mapProvenanceError('just a string')).toMatch(/something went wrong/i);
  });
});
