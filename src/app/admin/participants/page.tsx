"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, Column } from "@/components/data-table";
import { MOCK_ADMIN_PARTICIPANTS, MockParticipant } from "@/lib/mock-data";

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState(MOCK_ADMIN_PARTICIPANTS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suspendTarget, setSuspendTarget] = useState<MockParticipant | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleSuspend() {
    if (!suspendTarget || !suspendReason) return;
    setParticipants(participants.map((p) =>
      p.id === suspendTarget.id
        ? { ...p, status: "suspended" as const, suspension_reason: suspendReason }
        : p
    ));
    setSuspendTarget(null);
    setSuspendReason("");
    showToast(`${suspendTarget.company_name} suspended`);
  }

  function handleReactivate(participant: MockParticipant) {
    setParticipants(participants.map((p) =>
      p.id === participant.id
        ? { ...p, status: "active" as const, suspension_reason: undefined }
        : p
    ));
    showToast(`${participant.company_name} reactivated`);
  }

  const filtered = participants.filter((p) => {
    const matchesSearch = p.company_name.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<MockParticipant>[] = [
    {
      key: "company",
      label: "Company",
      render: (p) => (
        <div>
          <p className="font-medium text-charcoal">{p.company_name}</p>
          <p className="text-xs text-slate">{p.location}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "registered",
      label: "Registered",
      render: (p) => <span className="text-slate">{new Date(p.registered_at).toLocaleDateString()}</span>,
    },
    {
      key: "agents",
      label: "Agents",
      render: (p) => <span className="text-charcoal">{p.agent_count}</span>,
    },
    {
      key: "pairs",
      label: "Pairs",
      render: (p) => <span className="text-charcoal">{p.trading_pairs}</span>,
    },
    {
      key: "actions",
      label: "",
      render: (p) => (
        <div className="flex gap-2">
          {p.status === "suspended" ? (
            <Button size="sm" variant="secondary" onClick={() => handleReactivate(p)}>
              Reactivate
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setSuspendTarget(p)}>
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
          <option value="pending_payment">Pending Payment</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-slate/15">
        <div className="p-4 border-b border-slate/15">
          <p className="text-sm text-slate">{filtered.length} participants</p>
        </div>
        <DataTable columns={columns} data={filtered} keyFn={(p) => p.id} />
      </div>

      {/* Suspend Modal */}
      <Modal open={!!suspendTarget} onClose={() => setSuspendTarget(null)} title="Suspend Participant">
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Suspend <strong>{suspendTarget?.company_name}</strong>? Their agents will be jailed and network participation disabled.
          </p>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Reason</label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Enter suspension reason..."
              className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              required
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleSuspend} disabled={!suspendReason.trim()}>
              Suspend
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
