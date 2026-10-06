import { describe, it, expect } from 'vitest';
import { TEAM_INVITE_LIFESPAN_SECONDS } from '../actions-email-lifespan';

describe('team-member invite lifespan', () => {
  it('TEAM_INVITE_LIFESPAN_SECONDS is four days, 345600 s (D-239)', () => {
    expect(TEAM_INVITE_LIFESPAN_SECONDS).toBe(345600);
  });
});
