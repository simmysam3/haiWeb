import { describe, it, expect } from 'vitest';
import { RegistrationStatusSchema } from '@haiwave/protocol';
import { REGISTRATION_TERMINAL } from '../registration-terminal';

describe('registration terminality', () => {
  it('covers every RegistrationStatus member', () => {
    expect(Object.keys(REGISTRATION_TERMINAL).sort()).toEqual(
      [...RegistrationStatusSchema.options].sort(),
    );
  });
  it('only pending_approval is non-terminal', () => {
    expect(REGISTRATION_TERMINAL.pending_approval).toBe(false);
    expect(REGISTRATION_TERMINAL.approved).toBe(true);
    expect(REGISTRATION_TERMINAL.rejected).toBe(true);
  });
});
