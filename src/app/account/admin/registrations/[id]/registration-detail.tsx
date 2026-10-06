'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Pill } from '@/components/pill';
import { RiskTierPills } from '../risk-tier-pills';
import { Modal } from '@/components/modal';
import { useToast } from '@/lib/use-toast';
import type {
  RegistrationDetail as Detail,
  RegistrationStatus,
} from '@/lib/registration-types';
import { BLOCKED_REQUIRES_OVERRIDE } from '@/lib/registration-types';
import { REGISTRATION_TERMINAL } from './registration-terminal';
import {
  formatUtcMinute,
  formatUtcTime,
  inviteControl,
  isRefusalCode,
  isResendCoolingDown,
  REFUSAL_SENTENCES,
  refusalSentence,
  resendAvailableAt,
} from './invite-actions';

interface Props {
  detail: Detail;
}

type ModalKind = 'approve' | 'reject' | 'resend' | 'retry' | null;

/**
 * Re-reads the request from the BFF. A failed or malformed read is null: the
 * caller falls back to what the approve response alone says.
 */
async function readDetail(id: string): Promise<Detail | null> {
  try {
    const res = await fetch(`/api/admin/registration-requests/${id}`);
    const json = (await res.json()) as { request?: Detail };
    return typeof json?.request?.status === 'string' ? json.request : null;
  } catch {
    return null;
  }
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate">{label}</dt>
      <dd className="text-sm text-navy">{value ?? <span className="text-slate">—</span>}</dd>
    </div>
  );
}

/**
 * Gatekeeper detail + adjudication actions for one registration request.
 *
 * Approve: a blocked-tier request requires an audited override reason (the
 * confirm is gated until one is entered) and POSTs `{override:true,reason}`;
 * a standard/elevated request approves without forcing a reason. A 409
 * `blocked_requires_override` surfaces inline. Reject always requires a reason
 * behind a confirmation Modal. Success toasts and reflects the new status.
 */
export function RegistrationDetail({ detail }: Props) {
  const { toast, showToast } = useToast();
  const [status, setStatus] = useState<RegistrationStatus>(detail.status);
  const [modal, setModal] = useState<ModalKind>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(detail.provisioning_status);
  const [lastSent, setLastSent] = useState(detail.last_invite_sent_at ?? null);
  const [lastExpires, setLastExpires] = useState(detail.last_invite_expires_at ?? null);
  // Re-render at the next moment Resend may become available (the cooldown ends, or the
  // latest link expires), so the button enables without a reload.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const boundaries = [resendAvailableAt(lastSent), lastExpires ? new Date(lastExpires) : null];
    const nowMs = Date.now();
    const next = boundaries
      .filter((b): b is Date => b !== null && !Number.isNaN(b.getTime()) && b.getTime() > nowMs)
      .sort((x, y) => x.getTime() - y.getTime())[0];
    if (!next) return;
    // setTimeout runs a delay past 2^31-1 ms at once (a hot loop); the tick re-arms it.
    const timer = setTimeout(() => setTick((n) => n + 1), Math.min(next.getTime() - nowMs, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [lastSent, lastExpires, tick]);

  const isBlocked = detail.risk_tier === 'blocked';
  // Unknown statuses fail CLOSED: an unrecognized status from a newer core is
  // treated as terminal so the approve/reject controls stay hidden. The
  // Record type, not this fallback, is what enforces exhaustiveness at build
  // time. This is the deliberate mirror image of the watcher-run-status
  // helpers (`?? false`, in `_lib/watcher-run-status.ts`): there, an unknown
  // status is safe to treat as non-terminal because the worst case is a
  // banner that never renders and polling that continues; here, the worst
  // case of treating an unknown status as non-terminal is exposing an admin
  // authorization surface, so the safe default flips to terminal.
  const terminal = REGISTRATION_TERMINAL[status] ?? true;

  function openModal(kind: Exclude<ModalKind, null>) {
    setNotice(null);
    setReason('');
    setError(null);
    setModal(kind);
  }
  function closeModal() {
    if (submitting) return;
    setModal(null);
    setReason('');
    setError(null);
  }

  async function submitApprove() {
    setSubmitting(true);
    setError(null);
    const body: { override?: boolean; reason?: string } = {};
    if (isBlocked) {
      body.override = true;
      body.reason = reason.trim();
    } else if (reason.trim()) {
      body.reason = reason.trim();
    }
    try {
      const res = await fetch(`/api/admin/registration-requests/${detail.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: { code?: string };
      };
      if (res.status === 409 && json?.error?.code === BLOCKED_REQUIRES_OVERRIDE) {
        setError(
          'This jurisdiction is blocked — an audited override reason is required to approve.',
        );
        return;
      }
      // The server may have approved even though the response was an error
      // (provisioning or its email failed after the approval): ask it.
      const fresh = await readDetail(detail.id);
      if (fresh) {
        setStatus(fresh.status);
        setProvisioning(fresh.provisioning_status);
        setLastSent(fresh.last_invite_sent_at ?? null);
        setLastExpires(fresh.last_invite_expires_at ?? null);
      }
      if (!res.ok) {
        if (fresh?.status === 'approved') {
          setModal(null);
          const code = json?.error?.code;
          if (isRefusalCode(code)) setNotice(REFUSAL_SENTENCES[code]);
          return;
        }
        if (fresh && (REGISTRATION_TERMINAL[fresh.status] ?? true)) {
          // Settled elsewhere (e.g. another admin rejected it): approve must not be clickable again.
          setModal(null);
          setNotice('This request is no longer pending approval.');
          return;
        }
        setError('Approval failed. Please try again.');
        return;
      }
      setStatus('approved');
      // No usable re-read: a 200 approve means it provisioned, but only claim it where the
      // server reports provisioning at all (an older core does not: fail closed).
      setProvisioning((p) => (p === undefined ? p : 'provisioned'));
      setModal(null);
      showToast('Registration approved.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * After a send, learn the new link's expiry from the server (never compute it here: the
   * lifespan is server-tunable). A failed re-read leaves the expiry unknown, which only
   * silences the "previous link has expired" wording.
   */
  async function adoptSentState(sentAt: string) {
    const fresh = await readDetail(detail.id);
    setLastSent(fresh?.last_invite_sent_at ?? sentAt);
    setLastExpires(fresh?.last_invite_expires_at ?? null);
  }

  async function submitResend() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registration-requests/${detail.id}/resend-invite`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => ({}))) as {
        last_invite_sent_at: string;
        error?: {
          code?: string;
          details?: { last_invite_sent_at?: string; previous_link_expires_at?: string };
        };
      };
      if (!res.ok) {
        // The server may know of a newer send than this page (another admin, an unconfirmed
        // send): re-read, and replace the stored expiry (unknown when the re-read fails).
        const fresh = await readDetail(detail.id);
        const code = json.error?.code;
        const details = json.error?.details;
        const sentAt =
          fresh?.last_invite_sent_at ??
          (code === 'invite_cooldown_active' ? details?.last_invite_sent_at : undefined);
        if (sentAt) setLastSent(sentAt);
        const expiry =
          fresh?.last_invite_expires_at ??
          (code === 'previous_link_live' ? details?.previous_link_expires_at : undefined) ??
          null;
        setLastExpires(expiry);
        // A live link outranks a cooldown time: Resend is not free again at that time.
        const linkLive = expiry !== null && new Date() < new Date(expiry);
        setError(
          code === 'invite_cooldown_active' && linkLive
            ? refusalSentence({
                error: { code: 'previous_link_live', details: { previous_link_expires_at: expiry } },
              })
            : refusalSentence(json),
        );
        return;
      }
      // Close and confirm first: a slow re-read must not trap the admin in the modal.
      setLastSent(json.last_invite_sent_at);
      setLastExpires(null); // unknown until the re-read answers
      setModal(null);
      showToast('Setup email sent.');
      void adoptSentState(json.last_invite_sent_at);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRetry() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registration-requests/${detail.id}/retry-provisioning`, {
        method: 'POST',
      });
      const json = (await res.json().catch(() => ({}))) as { last_invite_sent_at: string };
      if (!res.ok) {
        setError(refusalSentence(json));
        return;
      }
      setProvisioning('provisioned');
      setLastSent(json.last_invite_sent_at);
      setLastExpires(null); // unknown until the re-read answers
      setModal(null);
      showToast('Provisioning complete. Setup email sent.');
      void adoptSentState(json.last_invite_sent_at);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReject() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registration-requests/${detail.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        setError('Rejection failed. Please try again.');
        return;
      }
      setStatus('rejected');
      setModal(null);
      showToast('Registration rejected.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  const resendAvailableAtTime = resendAvailableAt(lastSent);
  const now = new Date();
  const resendCoolingDown = isResendCoolingDown(lastSent, now);
  const linkExpiry = lastExpires ? new Date(lastExpires) : null;
  const linkStillLive = linkExpiry !== null && now < linkExpiry;
  // Only claim an expiry the server told us about; an unknown expiry says nothing.
  const linkKnownExpired = linkExpiry !== null && now >= linkExpiry;
  const approveDisabled = submitting || (isBlocked && reason.trim().length === 0);
  const rejectDisabled = submitting || reason.trim().length === 0;
  const contactName = [detail.first_name, detail.last_name].filter(Boolean).join(' ');
  const cityLine = [
    detail.hq_city,
    [detail.hq_region, detail.hq_postal_code].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
  const hqAddress =
    detail.hq_street || cityLine ? (
      <span className="block">
        {detail.hq_street && <span className="block">{detail.hq_street}</span>}
        {cityLine && <span className="block">{cityLine}</span>}
      </span>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-navy">{detail.legal_entity_name}</h1>
        <RiskTierPills tier={detail.risk_tier} />
        <Pill category="registration_status" value={status} />
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Contact" value={contactName || null} />
        <Field label="Email" value={detail.contact_email} />
        <Field label="Role" value={detail.role_title} />
        <Field label="Headquarters country" value={detail.country_of_origin} />
        <Field label="Corporate website" value={detail.corporate_website} />
        <Field label="Terms page" value={detail.terms_url} />
        <Field label="Tax ID" value={detail.tax_id} />
        <Field label="DUNS" value={detail.duns} />
        <Field label="HQ address" value={hqAddress} />
        <Field label="Source" value={detail.source} />
        <Field label="Submitted" value={detail.submitted_at} />
      </dl>

      <div className="rounded border border-slate/15 bg-light-gray p-4">
        <h2 className="mb-1 text-xs uppercase tracking-wider text-slate">Screening rationale</h2>
        <p className="text-sm text-navy">{detail.screening_reason}</p>
      </div>

      {notice && (
        <p role="alert" className="text-sm text-problem">
          {notice}
        </p>
      )}

      {toast && (
        <p role="status" className="text-sm text-success">
          {toast}
        </p>
      )}

      {!terminal && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => openModal('approve')}
            className="rounded bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-dark"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => openModal('reject')}
            className="rounded border border-problem px-4 py-2 text-sm font-medium text-problem hover:bg-problem/5"
          >
            Reject
          </button>
        </div>
      )}

      {inviteControl({ status, provisioning_status: provisioning }) === 'resend' && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => openModal('resend')}
            disabled={resendCoolingDown || linkStillLive || submitting}
            aria-describedby={resendCoolingDown || linkStillLive ? 'resend-reason' : undefined}
            className="rounded border border-teal px-4 py-2 text-sm font-medium text-teal disabled:opacity-50"
          >
            Resend setup email
          </button>
          {lastSent && (
            <p className="text-sm text-slate">Last sent {formatUtcMinute(lastSent)}</p>
          )}
          {resendCoolingDown && !linkStillLive && resendAvailableAtTime && (
            <p id="resend-reason" className="text-sm text-slate">
              Available again at {formatUtcTime(resendAvailableAtTime)}
            </p>
          )}
          {linkStillLive && lastExpires && (
            <p id="resend-reason" className="text-sm text-slate">
              The current setup link is valid until {formatUtcMinute(lastExpires)}. A new one can
              be sent after it expires.
            </p>
          )}
        </div>
      )}

      {inviteControl({ status, provisioning_status: provisioning }) === 'retry' && (
        <div className="space-y-1">
          <p className="text-sm text-navy">Approved, but the setup email was not sent.</p>
          <button
            type="button"
            onClick={() => openModal('retry')}
            className="rounded border border-teal px-4 py-2 text-sm font-medium text-teal"
          >
            Retry provisioning
          </button>
        </div>
      )}

      <Modal
        open={modal === 'approve'}
        onClose={closeModal}
        title={isBlocked ? 'Override blocked registration' : 'Approve registration'}
      >
        <div className="space-y-4">
          {isBlocked ? (
            <p className="text-sm text-navy">
              <strong>{detail.legal_entity_name}</strong> is in a <strong>blocked</strong>{' '}
              jurisdiction. Approving requires an audited override reason.
            </p>
          ) : (
            <p className="text-sm text-navy">
              Approve <strong>{detail.legal_entity_name}</strong> and provision a participant
              identity?
            </p>
          )}
          <label className="block text-sm">
            <span className="text-slate">{isBlocked ? 'Override reason' : 'Reason (optional)'}</span>
            <textarea
              aria-label={isBlocked ? 'Override reason' : 'Approval reason'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate/20 p-2 text-sm"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-problem">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-3 py-1.5 text-sm text-slate">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitApprove}
              disabled={approveDisabled}
              className="rounded bg-teal px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm approval
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'resend'} onClose={closeModal} title="Resend setup email">
        <div className="space-y-4">
          <p className="text-sm text-navy">
            Send a new setup link to <strong>{detail.contact_email}</strong>? It lasts 4 days.
            {linkKnownExpired && ' The previous link has expired.'}
          </p>
          {error && (
            <p role="alert" className="text-sm text-problem">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-3 py-1.5 text-sm text-slate">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitResend}
              disabled={submitting}
              className="rounded bg-teal px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm resend
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'retry'} onClose={closeModal} title="Retry provisioning">
        <div className="space-y-4">
          <p className="text-sm text-navy">
            Finish provisioning <strong>{detail.legal_entity_name}</strong> and send a setup link to{' '}
            <strong>{detail.contact_email}</strong>? It lasts 4 days.
          </p>
          {error && (
            <p role="alert" className="text-sm text-problem">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-3 py-1.5 text-sm text-slate">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitRetry}
              disabled={submitting}
              className="rounded bg-teal px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm retry
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'reject'} onClose={closeModal} title="Reject registration">
        <div className="space-y-4">
          <p className="text-sm text-navy">
            Reject <strong>{detail.legal_entity_name}</strong>? Their PII will be redacted to a
            tombstone.
          </p>
          <label className="block text-sm">
            <span className="text-slate">Rejection reason</span>
            <textarea
              aria-label="Rejection reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate/20 p-2 text-sm"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-problem">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-3 py-1.5 text-sm text-slate">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitReject}
              disabled={rejectDisabled}
              className="rounded bg-problem px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirm rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
