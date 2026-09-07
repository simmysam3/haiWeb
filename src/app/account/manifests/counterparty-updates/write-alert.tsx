"use client";

import type { CounterpartySyncState, CounterpartyUpdateRow } from "@/lib/counterparty-updates-types";

/**
 * §6.4 ruling 3 (task-5-brief round-2 refinement): the banner means "the
 * write is not enabled at all" — every write_capabilities flag false while
 * an `approved` row exists (dirty or not). Every other refusal or failure is
 * the agent's own apply_detail on that row's Why cell, never this banner.
 * Verbatim text: docs/superpowers/specs/2026-09-04-counterparty-attribute-
 * ownership-and-updates-design.md:184 (the §6.4 layout section this task
 * implements — supersedes the shorter paraphrases at that doc's lines 23
 * and 134, which describe the same alert less precisely).
 */
export const WRITE_NOT_ALLOWED_MESSAGE =
  "Write not allowed — your agent is not permitted to update your ERP. Please update these records directly in your ERP; they will clear on the next refresh.";

interface WriteAlertProps {
  state: CounterpartySyncState | null;
  rows: CounterpartyUpdateRow[];
}

export function WriteAlert({ state, rows }: WriteAlertProps) {
  const caps = state?.write_capabilities;
  if (!caps) return null;

  const allFalse = !caps.customer_fields && !caps.vendor_fields && !caps.customer_ship_to && !caps.vendor_purchase_point;
  if (!allFalse) return null;

  const hasApprovedRow = rows.some((r) => r.status === "approved");
  if (!hasApprovedRow) return null;

  return (
    <div role="alert" className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
      {WRITE_NOT_ALLOWED_MESSAGE}
    </div>
  );
}
