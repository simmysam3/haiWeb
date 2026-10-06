import { describe, it, expect } from 'vitest';
import {
  REGISTRATION_ACTION_REFUSAL_CODES,
  type RegistrationActionRefusalCode,
  type RegistrationDetail,
} from '@haiwave/protocol';
import {
  formatUtcMinute,
  formatUtcTime,
  inviteControl,
  isRefusalCode,
  isResendCoolingDown,
  REFUSAL_SENTENCES,
  refusalSentence,
  resendAvailableAt,
} from '../invite-actions';

type Status = RegistrationDetail['status'];
type Prov = RegistrationDetail['provisioning_status'];

describe('inviteControl', () => {
  it.each<[Status, Prov, 'resend' | 'retry' | 'none']>([
    ['pending_approval', 'none', 'none'],
    ['pending_approval', 'provisioned', 'none'],
    ['pending_approval', undefined, 'none'],
    ['approved', 'none', 'retry'],
    ['approved', 'provisioned', 'resend'],
    ['approved', undefined, 'none'],
    ['rejected', 'none', 'none'],
    ['rejected', 'provisioned', 'none'],
    ['rejected', undefined, 'none'],
    ['under_review' as unknown as Status, 'none', 'none'],
    ['under_review' as unknown as Status, 'provisioned', 'none'],
    ['under_review' as unknown as Status, undefined, 'none'],
  ])('inviteControl(%s, %s) is %s', (status, provisioning_status, expected) => {
    expect(inviteControl({ status, provisioning_status })).toBe(expected);
  });
});

describe('isResendCoolingDown', () => {
  const T = '2026-10-05T21:40:00.000Z';
  const t0 = new Date(T).getTime();

  it('is true until exactly last + 600 s, then false; false with no last send', () => {
    expect(isResendCoolingDown(T, new Date(t0 + 599_999))).toBe(true);
    expect(isResendCoolingDown(T, new Date(t0 + 600_000))).toBe(false);
    expect(isResendCoolingDown(null, new Date(t0))).toBe(false);
    expect(isResendCoolingDown(undefined, new Date(t0))).toBe(false);
  });
});

describe('resendAvailableAt', () => {
  it('is last + 600 s as a Date, and null when there is no usable last send', () => {
    expect(resendAvailableAt('2026-10-05T21:40:00Z')?.toISOString()).toBe('2026-10-05T21:50:00.000Z');
    expect(resendAvailableAt(null)).toBeNull();
    expect(resendAvailableAt('not a date')).toBeNull();
  });
});

describe('UTC formatting', () => {
  it('formats UTC to the minute and to the time', () => {
    expect(formatUtcMinute('2026-10-05T21:40:59.000Z')).toBe('2026-10-05 21:40 UTC');
    expect(formatUtcMinute(new Date('2026-10-05T21:40:59.000Z'))).toBe('2026-10-05 21:40 UTC');
    expect(formatUtcTime(new Date('2026-10-05T21:50:00Z'))).toBe('21:50 UTC');
  });
});

const EXPECTED: Record<RegistrationActionRefusalCode, string> = {
  not_found: 'This registration request no longer exists.',
  request_rejected: 'This request was rejected. A setup link cannot be sent.',
  not_provisioned: 'This request has no account yet, so there is nothing to resend.',
  participant_suspended: 'This participant is suspended. Nothing was sent.',
  invite_cooldown_active: 'A setup email was sent recently.',
  keycloak_user_missing: 'The account for this request could not be found. Nothing was sent.',
  participant_mismatch: 'A different account already uses this email address. Nothing was sent.',
  email_mismatch: "The account's email address no longer matches this request. Nothing was sent.",
  user_disabled: 'The account is disabled. Nothing was sent.',
  user_has_credentials: 'This person has already set up their account. A new link is not needed.',
  invite_email_failed: 'The setup email could not be sent. Try again later.',
  not_approved: 'Only an approved request can be provisioned.',
  already_provisioned: 'This request is already provisioned. Use Resend setup email.',
  previous_link_live: 'The current setup link is still valid. A new one can be sent after it expires.',
};

describe('refusalSentence', () => {
  it.each(REGISTRATION_ACTION_REFUSAL_CODES)('refusalSentence maps %s to its sentence', (code) => {
    expect(REFUSAL_SENTENCES[code]).toBe(EXPECTED[code]);
    expect(refusalSentence({ error: { code } })).toBe(EXPECTED[code]);
  });

  it('has a non-empty, distinct sentence for every code', () => {
    const sentences = REGISTRATION_ACTION_REFUSAL_CODES.map((c) => REFUSAL_SENTENCES[c]);
    expect(sentences.every((x) => x.length > 0)).toBe(true);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it('completes the cooldown sentence from details.last_invite_sent_at', () => {
    expect(
      refusalSentence({
        error: {
          code: 'invite_cooldown_active',
          details: { last_invite_sent_at: '2026-10-05T21:40:00Z', retry_after_seconds: 300 },
        },
      }),
    ).toBe('A setup email was sent recently. Available again at 21:50 UTC.');
  });

  it('completes the previous_link_live sentence from details.previous_link_expires_at', () => {
    expect(
      refusalSentence({
        error: {
          code: 'previous_link_live',
          details: { previous_link_expires_at: '2026-10-09T21:40:30Z' },
        },
      }),
    ).toBe('The current setup link is valid until 2026-10-09 21:40 UTC. A new one can be sent after it expires.');
  });

  it('maps RATE_LIMIT_EXCEEDED to the rate-limit sentence', () => {
    expect(refusalSentence({ error: { code: 'RATE_LIMIT_EXCEEDED' } })).toBe(
      'Too many requests. Wait a minute and try again.',
    );
  });

  it('maps the 502 PROVISIONING_EMAIL_FAILED (R6) to its sentence', () => {
    expect(refusalSentence({ error: { code: 'PROVISIONING_EMAIL_FAILED' } })).toBe(
      'The setup email could not be sent. Nothing changed; try again later.',
    );
  });

  it('answers the generic sentence for an unknown code', () => {
    expect(refusalSentence({ error: { code: 'something_new' } })).toBe(
      'The request failed. Please try again.',
    );
  });

  it.each([
    [{ error: 'Failed to reach haiCore' }],
    [{}],
    [null],
    ['oops'],
    [{ error: { message: 'no code' } }],
  ])('answers the generic sentence for the body %j (the BFF 502, or no code)', (body) => {
    expect(refusalSentence(body)).toBe('The request failed. Please try again.');
  });

  it('keeps the map sentence when the cooldown or live-link details are missing', () => {
    expect(refusalSentence({ error: { code: 'invite_cooldown_active', details: {} } })).toBe(EXPECTED.invite_cooldown_active);
    expect(refusalSentence({ error: { code: 'previous_link_live', details: {} } })).toBe(EXPECTED.previous_link_live);
  });
});

describe('isRefusalCode', () => {
  it('is true for every refusal code and false for anything else, inherited names included', () => {
    for (const code of REGISTRATION_ACTION_REFUSAL_CODES) expect(isRefusalCode(code)).toBe(true);
    for (const other of ['nope', 'toString', 'RATE_LIMIT_EXCEEDED', '', 42, null, undefined]) {
      expect(isRefusalCode(other)).toBe(false);
    }
  });
});
