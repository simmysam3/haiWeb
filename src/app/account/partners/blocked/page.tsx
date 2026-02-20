"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import { DataTable, Column } from "@/components/data-table";
import { useApi } from "@/lib/use-api";
import { MOCK_BLOCKED_COMPANIES, MockBlockedCompany } from "@/lib/mock-data";

export default function BlockedCompaniesPage() {
  const [blocked, setBlocked] = useState<MockBlockedCompany[]>(MOCK_BLOCKED_COMPANIES);
  const [unblockTarget, setUnblockTarget] = useState<MockBlockedCompany | null>(null);
  const [toast, setToast] = useState("");
  const [processing, setProcessing] = useState(false);

  const blockedApi = useApi<MockBlockedCompany[]>({
    url: "/api/account/connections/blocked",
    fallback: MOCK_BLOCKED_COMPANIES,
  });

  useEffect(() => {
    if (!blockedApi.loading) {
      setBlocked(blockedApi.data);
    }
  }, [blockedApi.data, blockedApi.loading]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleUnblock() {
    if (!unblockTarget) return;
    setProcessing(true);

    try {
      await fetch(
        `/api/account/connections/blocked?blocked_participant_id=${encodeURIComponent(unblockTarget.participant_id)}`,
        { method: "DELETE" },
      );
    } catch {
      // Fire-and-forget: UI updates optimistically
    }

    setBlocked(blocked.filter((b) => b.participant_id !== unblockTarget.participant_id));
    showToast(`Unblocked ${unblockTarget.company_name}`);
    setUnblockTarget(null);
    setProcessing(false);
  }

  const columns: Column<MockBlockedCompany>[] = [
    {
      key: "company",
      label: "Company Name",
      render: (b) => (
        <span className="font-medium text-charcoal">{b.company_name}</span>
      ),
    },
    {
      key: "blocked_at",
      label: "Blocked Date",
      render: (b) => (
        <span className="text-slate">
          {new Date(b.blocked_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (b) => (
        <span className="text-charcoal">{b.reason}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      className: "text-right",
      render: (b) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setUnblockTarget(b)}
        >
          Unblock
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Blocked Companies"
        description="Companies you have blocked from sending connection requests."
      />

      {toast && (
        <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success mb-4">
          {toast}
        </div>
      )}

      <Card>
        {blockedApi.loading ? (
          <div className="text-center py-12 text-sm text-slate">
            Loading blocked companies...
          </div>
        ) : blocked.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-40">{"\u{1F6E1}"}</div>
            <p className="text-sm text-slate mb-1">No blocked companies</p>
            <p className="text-xs text-slate/70">
              You have not blocked any companies. Blocked companies cannot send you connection requests.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={blocked}
            keyFn={(b) => b.participant_id}
            emptyMessage="No blocked companies."
          />
        )}
      </Card>

      {/* Unblock Confirmation Modal */}
      <Modal
        open={!!unblockTarget}
        onClose={() => setUnblockTarget(null)}
        title="Unblock Company"
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal">
            Are you sure you want to unblock{" "}
            <strong>{unblockTarget?.company_name}</strong>?
          </p>
          <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3 text-sm text-warning">
            This company will be able to send you connection requests again. Any previous
            connection history is preserved.
          </div>
          {unblockTarget?.reason && (
            <div className="bg-light-gray rounded-lg px-4 py-3">
              <p className="text-xs font-medium text-slate uppercase tracking-wider mb-1">
                Blocked Reason
              </p>
              <p className="text-sm text-charcoal">{unblockTarget.reason}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setUnblockTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleUnblock} disabled={processing}>
              {processing ? "Unblocking..." : "Unblock"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
