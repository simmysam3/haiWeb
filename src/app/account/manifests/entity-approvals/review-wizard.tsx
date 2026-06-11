"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { FormError } from "@/components/form-error";
import { describeApiError } from "@/lib/api-error";
import { StepRail, type RailStep } from "@/app/account/sonar/_components/step-rail";
import { StepCard } from "@/app/account/sonar/_components/step-card";
import { useApi } from "@/lib/use-api";
import { LIBRARY_TIERS, TIER_LABELS, type LibraryTier, type Scorecard, type ScorecardRow } from "@/lib/library-types";
import type { EntityApprovalQueueRow } from "./approvals-queue";
import { ScorecardTable } from "./scorecard-table";

const DEFAULT_TIER: LibraryTier = "connection";
const REVOKE_REASON_MIN = 10;

type Mode = "approve" | "revoke";

/** Statuses that count as a gap (mirrors the haiCore eval rules). */
const GAP_STATUSES = new Set(["missing", "insufficient", "expired", "not_shared"]);

/**
 * Build the scorecard fetch URL. The request path is used when the row carries a
 * request_id; otherwise the proactive counterparty path is used.
 */
function scorecardUrl(row: EntityApprovalQueueRow, tier: LibraryTier): string {
  if (row.request_id) {
    return `/api/account/entity-approvals/${row.request_id}/scorecard?tier=${tier}`;
  }
  return `/api/account/entity-approvals/counterparty/${row.counterparty.id}/scorecard?tier=${tier}`;
}

interface Props {
  row: EntityApprovalQueueRow;
  onClose: () => void;
  onDecided: () => void;
  /** Proactive approval of a counterparty with no inbound submission (Task 14). Approve-only. */
  proactive?: boolean;
}

export function ReviewWizard({ row, onClose, onDecided, proactive = false }: Props) {
  const [tier, setTier] = useState<LibraryTier>(DEFAULT_TIER);
  const [active, setActive] = useState("requirements");
  // Revoke is only meaningful for an already-approved relationship, and never in
  // proactive mode (there is nothing yet to revoke).
  const canRevoke = !proactive && row.status === "approved";
  const [mode, setMode] = useState<Mode>("approve");
  const [reason, setReason] = useState("");
  const [outOfBand, setOutOfBand] = useState("");
  const [outstanding, setOutstanding] = useState<Record<string, boolean>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: scorecard, loading, error } = useApi<Scorecard | null>({
    url: scorecardUrl(row, tier),
    fallback: null,
  });

  const gapCount = scorecard?.gap_count ?? row.gap_count;
  const gapRows: ScorecardRow[] = useMemo(
    () => (scorecard?.rows ?? []).filter((r) => GAP_STATUSES.has(r.status)),
    [scorecard],
  );

  // Prefill the outstanding-elements multiselect from the current gap rows.
  // Recomputed key set keeps the default checked when the scorecard changes.
  const outstandingChecked = (key: string) => outstanding[key] ?? true;

  const decisionValid =
    mode === "approve"
      ? gapCount === 0 || reason.trim().length > 0
      : reason.trim().length >= REVOKE_REASON_MIN;

  const steps: RailStep[] = [
    { id: "requirements", label: "Requirements review", state: active === "requirements" ? "active" : "done" },
    {
      id: "decision",
      label: "Decision",
      state: active === "decision" ? "active" : validationError ? "error" : decisionValid ? "done" : "todo",
    },
    {
      id: "confirm",
      label: "Confirm",
      state: active === "confirm" ? "active" : decisionValid ? "todo" : "locked",
    },
  ];

  function jump(id: string) {
    if (id === "confirm" && !decisionValid) return; // locked until the decision is valid
    setActive(id);
    const el = document.getElementById(`step-${id}`);
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth" });
  }

  function selectMode(next: Mode) {
    setMode(next);
    setValidationError(null);
    setServerError(null);
  }

  async function submit() {
    setValidationError(null);
    setServerError(null);
    setSessionExpired(false);

    if (mode === "approve" && gapCount > 0 && reason.trim().length === 0) {
      setValidationError("A reason is required when requirements remain unmet at this tier.");
      return;
    }
    if (mode === "revoke" && reason.trim().length < REVOKE_REASON_MIN) {
      setValidationError(`Provide a reason of at least ${REVOKE_REASON_MIN} characters.`);
      return;
    }

    const { url, body } = buildRequest();
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setServerError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      onDecided();
    } catch {
      setServerError("Network error — could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function buildRequest(): { url: string; body: Record<string, unknown> } {
    if (mode === "revoke") {
      const keys = gapRows.map((r) => r.element_key).filter(outstandingChecked);
      return {
        url: `/api/account/entity-approvals/counterparty/${row.counterparty.id}/revoke`,
        body: {
          reason: reason.trim(),
          outstanding_element_keys: keys.length ? keys : undefined,
          out_of_band_request: outOfBand.trim() || undefined,
        },
      };
    }
    const body: Record<string, unknown> = { tier };
    if (reason.trim()) body.reason = reason.trim();
    const url = row.request_id
      ? `/api/account/entity-approvals/${row.request_id}/approve`
      : `/api/account/entity-approvals/counterparty/${row.counterparty.id}/approve`;
    return { url, body };
  }

  const outstandingLabels = gapRows.filter((r) => outstandingChecked(r.element_key)).map((r) => r.label);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-charcoal">Review — {row.counterparty.name}</p>
          {proactive && (
            <p className="text-xs text-slate">Proactive approval — no inbound submission.</p>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Back to queue
        </Button>
      </div>

      <div className="flex gap-6">
        <div className="pt-1">
          <StepRail steps={steps} onJump={jump} />
        </div>

        <div className="flex-1 max-w-3xl space-y-4">
          <StepCard id="requirements" index={0} title="Requirements review">
            {loading ? (
              <p className="text-sm text-slate py-6 text-center">Loading scorecard…</p>
            ) : error || !scorecard ? (
              <p className="text-sm text-problem py-6 text-center">
                Couldn&apos;t load the scorecard. Try again.
              </p>
            ) : (
              <ScorecardTable ownerId={row.counterparty.id} scorecard={scorecard} />
            )}
          </StepCard>

          <StepCard id="decision" index={1} title="Decision">
            <div className="space-y-4">
              {canRevoke && (
                <div role="radiogroup" aria-label="Decision type" className="flex gap-3">
                  {(["approve", "revoke"] as Mode[]).map((m) => (
                    <label key={m} className="inline-flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name="decision-mode"
                        aria-label={m === "approve" ? "Approve" : "Revoke"}
                        checked={mode === m}
                        onChange={() => selectMode(m)}
                      />
                      {m === "approve" ? "Approve" : "Revoke"}
                    </label>
                  ))}
                </div>
              )}

              {mode === "approve" && (
                <fieldset>
                  <legend className="text-xs font-medium uppercase tracking-wider text-slate mb-2">
                    Tier ({gapCount === 0 ? "no gaps" : `${gapCount} gap${gapCount === 1 ? "" : "s"}`})
                  </legend>
                  <div role="radiogroup" aria-label="Tier" className="flex flex-wrap gap-2">
                    {LIBRARY_TIERS.map((t) => (
                      <label
                        key={t}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                          tier === t ? "border-teal bg-teal/5 text-navy" : "border-slate/20 text-slate"
                        }`}
                      >
                        <input
                          type="radio"
                          name="tier"
                          aria-label={TIER_LABELS[t]}
                          className="sr-only"
                          checked={tier === t}
                          onChange={() => setTier(t)}
                        />
                        {TIER_LABELS[t]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {mode === "revoke" && gapRows.length > 0 && (
                <fieldset>
                  <legend className="text-xs font-medium uppercase tracking-wider text-slate mb-2">
                    Outstanding requirements
                  </legend>
                  <div className="space-y-1">
                    {gapRows.map((r) => (
                      <label key={r.element_key} className="flex items-center gap-2 text-sm text-charcoal">
                        <input
                          type="checkbox"
                          aria-label={r.label}
                          checked={outstandingChecked(r.element_key)}
                          onChange={(e) =>
                            setOutstanding((prev) => ({ ...prev, [r.element_key]: e.target.checked }))
                          }
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              <div>
                <label htmlFor="decision-reason" className="block text-xs font-medium uppercase tracking-wider text-slate mb-1">
                  Reason{mode === "revoke" || gapCount > 0 ? " (required)" : " (optional)"}
                </label>
                <textarea
                  id="decision-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    mode === "revoke"
                      ? "Why are you revoking? The counterparty sees this in-app."
                      : "Optional context for this approval (required while gaps remain)."
                  }
                  className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                />
              </div>

              {mode === "revoke" && (
                <div>
                  <label htmlFor="out-of-band" className="block text-xs font-medium uppercase tracking-wider text-slate mb-1">
                    Out-of-band request (optional)
                  </label>
                  <textarea
                    id="out-of-band"
                    value={outOfBand}
                    onChange={(e) => setOutOfBand(e.target.value)}
                    placeholder="e.g. email the certificate of insurance to compliance@…"
                    className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
                  />
                </div>
              )}

              {validationError && <p className="text-sm text-problem">{validationError}</p>}
            </div>
          </StepCard>

          <StepCard id="confirm" index={2} title="Confirm" locked={!decisionValid}>
            <div className="space-y-3">
              <div className="text-sm text-charcoal">
                <p>
                  <span className="text-slate">Counterparty:</span> {row.counterparty.name}
                </p>
                <p>
                  <span className="text-slate">Decision:</span>{" "}
                  {mode === "approve" ? `Approve to ${TIER_LABELS[tier]}` : "Revoke"}
                </p>
                <p>
                  <span className="text-slate">Open gaps:</span> {gapCount}
                </p>
                {reason.trim() && (
                  <p>
                    <span className="text-slate">Reason:</span> {reason.trim()}
                  </p>
                )}
              </div>

              <Card>
                <div data-testid="decision-preview" className="space-y-1 py-2 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate">What they&apos;ll be told</p>
                  {mode === "approve" ? (
                    <p>
                      {row.counterparty.name} — approved to <strong>{TIER_LABELS[tier]}</strong>.
                    </p>
                  ) : (
                    <>
                      <p>
                        {row.counterparty.name} — approval revoked.
                      </p>
                      {outstandingLabels.length > 0 && (
                        <p className="text-slate">Outstanding: {outstandingLabels.join(", ")}.</p>
                      )}
                    </>
                  )}
                </div>
              </Card>

              {serverError && <FormError message={serverError} sessionExpired={sessionExpired} />}

              <Button onClick={submit} disabled={saving}>
                {saving ? "Saving…" : mode === "approve" ? "Submit approval" : "Submit revocation"}
              </Button>
            </div>
          </StepCard>
        </div>
      </div>
    </div>
  );
}
