"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Pill } from "@/components/pill";
import { DetailChevron } from "@/components/sonar/observations/detail-chevron";
import { useApi } from "@/lib/use-api";
import { TIER_LABELS, type LibraryTier } from "@/lib/library-types";

/** A reviewer's Entity Approvals queue row (mirrors the haiCore QueueRow contract). */
export interface EntityApprovalQueueRow {
  request_id: string | null;
  counterparty: { id: string; name: string };
  submitted_at: string | null;
  gap_count: number;
  status: "pending" | "approved" | "revoked";
  last_decision: {
    decision: "approved" | "revoked";
    tier: string | null;
    decided_by: string;
    decided_at: string;
  } | null;
}

type StatusFilter = "pending" | "approved" | "all";
type Sort = "date_desc" | "date_asc";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "all", label: "All" },
];

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

interface Props {
  onReview: (row: EntityApprovalQueueRow) => void;
  onProactive: () => void;
}

export function ApprovalsQueue({ onReview, onProactive }: Props) {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [sort, setSort] = useState<Sort>("date_desc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // 300ms debounce on the name search, matching the partners-panel pattern.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const params = new URLSearchParams({ status, sort });
  if (search) params.set("search", search);
  // haiCore (passed through the BFF verbatim) wraps the list:
  // `{ rows: [...] }` — never a bare array.
  const { data, loading, error } = useApi<{ rows?: EntityApprovalQueueRow[] }>({
    url: `/api/account/entity-approvals?${params.toString()}`,
    fallback: {},
  });
  const rows = Array.isArray(data.rows) ? data.rows : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate/20 p-0.5 bg-slate/5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                status === f.key
                  ? "bg-white shadow-sm text-navy font-medium"
                  : "text-slate hover:text-charcoal"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search company name..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />

        <button
          type="button"
          onClick={() => setSort((s) => (s === "date_desc" ? "date_asc" : "date_desc"))}
          className="px-3 py-2 border border-slate/20 rounded-lg text-sm text-slate hover:text-charcoal"
        >
          Sort: {sort === "date_desc" ? "Newest first" : "Oldest first"}
        </button>

        <Button size="sm" className="ml-auto" onClick={onProactive}>
          Approve a company
        </Button>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-slate text-center py-8">Loading…</p>
        </Card>
      ) : error ? (
        <Card>
          <p className="text-sm text-problem text-center py-8">
            Couldn&apos;t load the approvals queue. Try again.
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate text-center py-8">
            {status === "pending" ? "No pending submissions." : "No submissions to show."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.request_id ?? row.counterparty.id}>
              <button
                type="button"
                onClick={() => onReview(row)}
                aria-label={`Review ${row.counterparty.name}`}
                className="group flex w-full items-center gap-4 text-left"
              >
                <div className="flex-1">
                  <p className="font-medium text-charcoal">{row.counterparty.name}</p>
                  <p className="text-xs text-slate mt-0.5">
                    {`Submitted ${formatDate(row.submitted_at)}`}
                    {row.last_decision &&
                      ` · ${row.last_decision.decision === "approved" ? "Approved" : "Revoked"}${
                        row.last_decision.tier && row.last_decision.tier in TIER_LABELS
                          ? ` to ${TIER_LABELS[row.last_decision.tier as LibraryTier]}`
                          : ""
                      } by ${row.last_decision.decided_by} on ${formatDate(row.last_decision.decided_at)}`}
                  </p>
                </div>

                <span className="text-xs text-slate whitespace-nowrap">
                  {row.gap_count === 0 ? "No gaps" : `${row.gap_count} gap${row.gap_count === 1 ? "" : "s"}`}
                </span>

                <Pill category="approval_status" value={row.status} />

                <DetailChevron />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
