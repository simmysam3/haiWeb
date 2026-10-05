import { describe, it, expect } from 'vitest';
import { sessionFor } from '@/test/role-gate';
import { helpOwnerKey } from '../help-owner';

// The literal keys of amendment P3-7, computed once outside this test
// (`printf 'participant-1:user-1' | shasum -a 256`), never recomputed here.
const KEY_PARTICIPANT_1_USER_1 = 'b161539033611f261ba7bcd678a2474a0b0235073d8c96352ba1e92c62179c57';
const KEY_PARTICIPANT_2_USER_1 = 'd4b2802f8708d739fac88697e49a8de067f8aca2195b763dfad2a18de2afe777';
// `printf ':user-1' | shasum -a 256` (Task 3.9 review): an empty participant id still keys.
const KEY_EMPTY_PARTICIPANT_USER_1 = '8b044bb5709c9a55e39a6c370bf76840b73de86f2c64de3903b2a84996ed0d88';

describe('helpOwnerKey', () => {
  it('is the lowercase hex SHA-256 of "<participant id>:<user id>", so another participant gets another key', () => {
    const session = sessionFor('account_admin');
    expect(helpOwnerKey(session)).toBe(KEY_PARTICIPANT_1_USER_1);
    expect(helpOwnerKey({ ...session, participant: { ...session.participant, id: 'participant-2' } })).toBe(
      KEY_PARTICIPANT_2_USER_1,
    );
  });

  it('is null without a session', () => {
    expect(helpOwnerKey(null)).toBeNull();
  });

  it('is null for a session whose user id is empty', () => {
    const session = sessionFor('account_admin');
    expect(helpOwnerKey({ ...session, user: { ...session.user, id: '' } })).toBeNull();
  });

  it('still keys a session whose participant id is empty: only no session or no user id gives null (Task 3.9 review)', () => {
    // getSession gives participant.id '' for a token without the participant claim (src/lib/auth.ts).
    const session = sessionFor('account_admin');
    expect(helpOwnerKey({ ...session, participant: { ...session.participant, id: '' } })).toBe(
      KEY_EMPTY_PARTICIPANT_USER_1,
    );
  });
});
