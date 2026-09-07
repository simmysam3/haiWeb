"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/use-toast";
import type {
  CounterpartyUpdateRow,
  CounterpartyUpdatesList,
  CounterpartyUpdateDecision,
  CounterpartyUpdateStatus,
} from "@/lib/counterparty-updates-types";
import { UpdatesTable } from "./updates-table";
import { WriteAlert } from "./write-alert";
import { SyncNowPanel } from "./sync-now-panel";

type FilterValue = "pending" | "decided" | "all";

const EMPTY_LIST: CounterpartyUpdatesList = { rows: [], sync_state: null, counterparties: [] };

function buildUrl(filter: FilterValue, counterparty: string): string {
  const params = new URLSearchParams({ status: filter });
  if (counterparty) params.set("counterparty", counterparty);
  return `/api/account/counterparty-updates?${params.toString()}`;
}

function optimisticStatusFor(decision: CounterpartyUpdateDecision): CounterpartyUpdateStatus {
  if ("link" in decision) return "approved";
  return decision.keep === "mine" ? "kept" : "approved";
}

function toastFor(decision: CounterpartyUpdateDecision): string {
  if ("link" in decision) return "Linked";
  return decision.keep === "mine" ? "Kept your value" : "Approved — your agent will apply it";
}

export default function CounterpartyUpdatesTab() {
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [counterparty, setCounterparty] = useState("");
  const [rows, setRows] = useState<CounterpartyUpdateRow[]>([]);
  const { toast, showToast } = useToast();

  const api = useApi<CounterpartyUpdatesList>({
    url: buildUrl(filter, counterparty),
    fallback: EMPTY_LIST,
  });

  // Sync local rows from every successful fetch — filter/counterparty
  // changes and the Sync all now poll all land here. Unlike
  // review-queue-panel's one-time "loaded" latch, this tab re-fetches
  // repeatedly and must reflect each new response, not just the first.
  useEffect(() => {
    if (!api.loading && !api.error) {
      setRows(api.data.rows ?? []);
    }
  }, [api.data, api.loading, api.error]);

  const counterparties = api.data.counterparties ?? [];
  const syncState = api.data.sync_state ?? null;

  async function handleDecide(id: string, decision: CounterpartyUpdateDecision) {
    const snapshot = rows;
    const target = rows.find((r) => r.id === id);
    if (!target) return;

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: optimisticStatusFor(decision) } : r)));

    try {
      const res = await fetch(`/api/account/counterparty-updates/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(decision),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: CounterpartyUpdateRow = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      showToast(toastFor(decision));
    } catch {
      setRows(snapshot);
      showToast("Could not save your decision — try again");
    }
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-navy text-white px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <Card>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <SyncNowPanel state={syncState} onStarted={api.refetch} />
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate">
              Status
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterValue)}
                className="ml-2 border border-slate/20 rounded px-2 py-1 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="decided">Decided</option>
                <option value="all">All</option>
              </select>
            </label>
            <label className="text-sm text-slate">
              Counterparty
              <select
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="ml-2 border border-slate/20 rounded px-2 py-1 text-sm"
              >
                <option value="">All counterparties</option>
                {counterparties.map((c) => (
                  <option key={c.participant_id} value={c.participant_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Card>

      <WriteAlert state={syncState} rows={rows} />

      <UpdatesTable rows={rows} counterparties={counterparties} onDecide={handleDecide} />
    </div>
  );
}
