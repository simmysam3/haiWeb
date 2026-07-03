"use client";

import { Pill } from "@/components/pill";
import { formatUsd } from "@/lib/library-types";
import type { Scorecard, ScorecardRow, ScorecardEvidence } from "@/lib/library-types";

/** "$3,000,000 held · $5,000,000 required" when either amount is present. */
function amountsLine(row: ScorecardRow): string | null {
  if (row.held_amount_usd == null && row.required_min_amount_usd == null) return null;
  const parts: string[] = [];
  if (row.held_amount_usd != null) parts.push(`${formatUsd(row.held_amount_usd)} held`);
  if (row.required_min_amount_usd != null) parts.push(`${formatUsd(row.required_min_amount_usd)} required`);
  return parts.join(" · ");
}

function evidenceSuffix(e: ScorecardEvidence): string {
  if (e.no_expiry) return " · no expiration";
  if (e.valid_until) return ` · valid until ${new Date(e.valid_until).toLocaleDateString()}`;
  return "";
}

const COUNT_ORDER = ["met", "claimed", "insufficient", "expired", "missing", "waived", "not_shared"] as const;

function EvidenceLink({ ownerId, e }: { ownerId: string; e: ScorecardEvidence }) {
  const suffix = evidenceSuffix(e);
  if (e.has_file && e.artifact_id) {
    return (
      <a
        href={`/api/account/entity-approvals/evidence/${ownerId}/${e.artifact_id}/file`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-teal hover:text-navy"
      >
        {e.title}
        {suffix && <span className="text-slate">{suffix}</span>}
      </a>
    );
  }
  if (e.source_url) {
    return (
      <a
        href={e.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-teal hover:text-navy"
      >
        {e.title}
        {suffix && <span className="text-slate">{suffix}</span>}
      </a>
    );
  }
  return (
    <span className="text-xs text-slate">
      {e.title}
      {suffix}
    </span>
  );
}

interface Props {
  ownerId: string;
  scorecard: Scorecard;
}

export function ScorecardTable({ ownerId, scorecard }: Props) {
  const countsLine = COUNT_ORDER.filter((k) => scorecard.counts[k])
    .map((k) => `${scorecard.counts[k]} ${k.replace(/_/g, " ")}`)
    .join(" · ");

  return (
    <div className="space-y-3">
      <p data-testid="scorecard-counts" className="text-xs text-slate">
        {countsLine ? `${countsLine} · ` : ""}gap count {scorecard.gap_count}
      </p>

      <div className="divide-y divide-slate/10 rounded-lg border border-slate/15">
        {scorecard.rows.map((row) => {
          const amounts = amountsLine(row);
          return (
            <div key={row.element_key} className="flex items-start gap-4 px-4 py-3">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-charcoal">{row.label}</p>
                {amounts && <p className="text-xs text-slate">{amounts}</p>}
                {row.evidence.length > 0 && (
                  <ul className="space-y-0.5">
                    {row.evidence.map((e, i) => (
                      <li key={e.artifact_id ?? `${row.element_key}-${i}`}>
                        <EvidenceLink ownerId={ownerId} e={e} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Pill
                category="eval_status"
                value={row.status}
                detail={row.status === "insufficient" ? amounts : row.status === "waived" ? row.waiver_reason : null}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
