import {
  INVITE_RESEND_COOLDOWN_SECONDS,
  type RegistrationActionRefusalCode,
  type RegistrationDetail,
} from '@haiwave/protocol';

export type InviteControl = 'resend' | 'retry' | 'none';

/**
 * Which invite control the detail page offers. resend: approved + provisioned;
 * retry: approved + none; none otherwise, including an absent
 * `provisioning_status` (an older core: fail closed).
 */
export function inviteControl(
  d: Pick<RegistrationDetail, 'status' | 'provisioning_status'>,
): InviteControl {
  if (d.status !== 'approved') return 'none';
  if (d.provisioning_status === 'provisioned') return 'resend';
  if (d.provisioning_status === 'none') return 'retry';
  return 'none';
}

export function resendAvailableAt(lastInviteSentAt: string | null | undefined): Date | null {
  if (!lastInviteSentAt) return null;
  const sentAt = new Date(lastInviteSentAt).getTime();
  if (Number.isNaN(sentAt)) return null;
  return new Date(sentAt + INVITE_RESEND_COOLDOWN_SECONDS * 1000);
}

export function isResendCoolingDown(lastInviteSentAt: string | null | undefined, now: Date): boolean {
  const availableAt = resendAvailableAt(lastInviteSentAt);
  return availableAt !== null && now < availableAt;
}

/** '2026-10-05 21:40 UTC' */
export function formatUtcMinute(t: string | Date): string {
  return `${new Date(t).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** '21:50 UTC' */
export function formatUtcTime(t: Date): string {
  return `${t.toISOString().slice(11, 16)} UTC`;
}

/**
 * One sentence per refusal code of the resend-invite and retry-provisioning
 * actions. `invite_cooldown_active` and `previous_link_live` are the sentence
 * without its time: `refusalSentence` completes them from the body's details.
 */
export const REFUSAL_SENTENCES: Record<RegistrationActionRefusalCode, string> = {
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

export function isRefusalCode(code: unknown): code is RegistrationActionRefusalCode {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(REFUSAL_SENTENCES, code);
}

interface RefusalError {
  code?: unknown;
  details?: {
    last_invite_sent_at?: string;
    previous_link_expires_at?: string;
    keycloak_status?: number | null;
  };
}

/**
 * Maps a non-OK response body to the one sentence the admin sees: the code
 * map, with the cooldown and live-link sentences completed from the server's
 * `details` (never the browser clock); the global rate limit; the 502
 * PROVISIONING_EMAIL_FAILED of the retry action; else a generic sentence.
 */
export function refusalSentence(body: unknown): string {
  const error = (body as { error?: RefusalError } | null)?.error;
  const code = error?.code;
  if (code === 'RATE_LIMIT_EXCEEDED') return 'Too many requests. Wait a minute and try again.';
  if (code === 'PROVISIONING_EMAIL_FAILED') {
    return 'The setup email could not be sent. Nothing changed; try again later.';
  }
  if (!isRefusalCode(code)) return 'The request failed. Please try again.';
  // A null Keycloak status: the send may or may not have gone out, and the wire cannot tell which.
  if (code === 'invite_email_failed' && error?.details?.keycloak_status === null) {
    return 'The setup email may not have been sent.';
  }
  if (code === 'invite_cooldown_active') {
    const availableAt = resendAvailableAt(error?.details?.last_invite_sent_at);
    if (availableAt) return `${REFUSAL_SENTENCES[code]} Available again at ${formatUtcTime(availableAt)}.`;
  }
  if (code === 'previous_link_live' && error?.details?.previous_link_expires_at) {
    return `The current setup link is valid until ${formatUtcMinute(error.details.previous_link_expires_at)}. A new one can be sent after it expires.`;
  }
  return REFUSAL_SENTENCES[code];
}
