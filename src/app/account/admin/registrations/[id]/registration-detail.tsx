'use client';

import { useState, type ReactNode } from 'react';
import { Pill } from '@/components/pill';
import { RiskTierPills } from '../risk-tier-pills';
import { Modal } from '@/components/modal';
import { useToast } from '@/lib/use-toast';
import type {
  RegistrationDetail as Detail,
  RegistrationStatus,
} from '@/lib/registration-types';
import { BLOCKED_REQUIRES_OVERRIDE } from '@/lib/registration-types';

interface Props {
  detail: Detail;
}

type ModalKind = 'approve' | 'reject' | null;

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

  const isBlocked = detail.risk_tier === 'blocked';
  const terminal = status !== 'pending_approval';

  function openModal(kind: Exclude<ModalKind, null>) {
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
      if (!res.ok) {
        setError('Approval failed. Please try again.');
        return;
      }
      setStatus('approved');
      setModal(null);
      showToast('Registration approved.');
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
        <Field label="Country of origin" value={detail.country_of_origin} />
        <Field label="Corporate website" value={detail.corporate_website} />
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
