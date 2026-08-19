"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, Column } from "@/components/data-table";
import { useToast } from "@/lib/use-toast";
import { useApi } from "@/lib/use-api";

/**
 * v1.75 walk W7: this page was 100% mock theater — useState over
 * MOCK_ADMIN_PARTICIPANTS, with suspend/reactivate flipping client state and
 * never calling an API. It now renders GET /api/admin/participants and drives
 * both actions through POST /api/admin/actions (haiCore admin-action-service,
 * the one real jail writer). API failure surfaces as absence plus an error
 * notice, never as mock rows (F-4 lesson).
 *
 * Local mirror of haiCore's AdminParticipantRow (admin-dashboard-service.ts) —
 * the admin surface is BFF-only, so the shape is service-local there, mirrored
 * here, same as the dashboard's AdminOverview interface.
 */
interface AdminParticipantRow {
  participant_id: string;
  legal_name: string;
  status: string;
  business_address_city: string | null;
  business_address_state: string | null;
  business_address_country: string | null;
  registered_at: string | null;
  suspension_reason: string | null;
  agent_count: number;
  trading_pair_count: number;
}

interface AdminParticipantsList {
  participants: AdminParticipantRow[];
  total_count: number;
}

function locationOf(p: AdminParticipantRow): string {
  const cityState = [p.business_address_city, p.business_address_state].filter(Boolean).join(", ");
  return cityState || p.business_address_country || "—";
}

type AdminAction = "suspend" | "reactivate";

export default function ParticipantsPage() {
  const { data, loading, error, refetch } = useApi<AdminParticipantsList | null>({
    url: "/api/admin/participants",
    fallback: null,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [target, setTarget] = useState<{ participant: AdminParticipantRow; action: AdminAction } | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  function openAction(participant: AdminParticipantRow, action: AdminAction) {
    setTarget({ participant, action });
    setReason("");
    setActionError(null);
  }

  async function submitAction() {
    if (!target || !reason.trim() || submitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: target.action,
          participant_id: target.participant.participant_id,
          justification: reason.trim(),
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      showToast(
        `${target.participant.legal_name} ${target.action === "suspend" ? "suspended" : "reactivated"}`,
      );
      setTarget(null);
      setReason("");
      refetch();
    } catch (err) {
      // The row keeps its real state — nothing flips locally on failure.
      setActionError(
        `${target.action === "suspend" ? "Suspend" : "Reactivate"} failed (${err instanceof Error ? err.message : "network error"}). Nothing was changed.`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const participants = data?.participants ?? [];
  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.legal_name.toLowerCase().includes(q) || locationOf(p).toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<AdminParticipantRow>[] = [
    {
      key: "company",
      label: "Company",
      render: (p) => (
        <div>
          <p className="font-medium text-charcoal">{p.legal_name}</p>
          <p className="text-xs text-slate">{locationOf(p)}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (p) => (
        <div>
          <StatusBadge status={p.status} />
          {p.status === "suspended" && p.suspension_reason && (
            <p className="text-xs text-slate mt-1">{p.suspension_reason}</p>
          )}
        </div>
      ),
    },
    {
      key: "registered",
      label: "Registered",
      render: (p) => (
        <span className="text-slate">
          {p.registered_at ? new Date(p.registered_at).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "agents",
      label: "Agents",
      render: (p) => <span className="text-charcoal">{p.agent_count}</span>,
    },
    {
      key: "pairs",
      label: "Pairs",
      render: (p) => <span className="text-charcoal">{p.trading_pair_count}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (p) => (
        <div className="flex gap-2">
          {p.status === "suspended" ? (
            <Button size="sm" variant="secondary" onClick={() => openAction(p, "reactivate")}>
              Reactivate
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => openAction(p, "suspend")}>
              Suspend
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Participants"
        description="Manage all registered HAIWAVE participants."
      />

      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
          {toast}
        </div>
      )}

      {error && (
        <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem mb-4">
          Couldn&apos;t load participants — haiCore answered {error}. Nothing is shown rather than
          stale or fabricated rows.
        </div>
      )}

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or location..."
          className="flex-1 px-4 py-2.5 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-slate/15">
        <div className="p-4 border-b border-slate/15">
          <p className="text-sm text-slate">
            {loading ? "Loading participants…" : `${filtered.length} participants`}
          </p>
        </div>
        <DataTable columns={columns} data={filtered} keyFn={(p) => p.participant_id} />
      </div>

      {/* Suspend / Reactivate modal — both actions require a justification:
          it lands verbatim in the append-only admin action log (AU-9). */}
      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={target?.action === "reactivate" ? "Reactivate Participant" : "Suspend Participant"}
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            {target?.action === "reactivate" ? (
              <>
                Reactivate <strong>{target?.participant.legal_name}</strong>? Their agents will be
                released from quarantine and network participation restored.
              </>
            ) : (
              <>
                {/* P7d (ruled, verbatim) */}
                Suspend <strong>{target?.participant.legal_name}</strong>? Their agents will be
                quarantined and network participation disabled.
              </>
            )}
          </p>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                target?.action === "reactivate"
                  ? "Enter reactivation reason..."
                  : "Enter suspension reason..."
              }
              className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              required
            />
          </div>
          {actionError && <p className="text-sm text-problem">{actionError}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
            {target?.action === "reactivate" ? (
              <Button onClick={submitAction} disabled={!reason.trim() || submitting}>
                Reactivate
              </Button>
            ) : (
              <Button variant="danger" onClick={submitAction} disabled={!reason.trim() || submitting}>
                Suspend
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
