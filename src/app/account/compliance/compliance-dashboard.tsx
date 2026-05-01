"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/card";
import { Modal } from "@/components/modal";
import { StatusBadge } from "@/components/status-badge";
import { Tabs } from "@/components/tabs";
import { useApi } from "@/lib/use-api";
import { useToast } from "@/lib/use-toast";

interface ComplianceFlag {
  flag_id: string;
  flagged_vendor_id: string;
  vendor_name?: string;
  external_product_id: string | null;
  reason_code: string;
  status: string;
  detected_at: string;
}

interface ComplianceApiResponse {
  flags: ComplianceFlag[];
  total_count: number;
  open_count: number;
}

const COMPLIANCE_FALLBACK: ComplianceApiResponse = {
  flags: [],
  total_count: 0,
  open_count: 0,
};

const PAGE_SIZE = 20;
type TabKey = "open" | "resolved";

export function ComplianceDashboard() {
  const [tab, setTab] = useState<TabKey>("open");
  const [page, setPage] = useState(1);

  const { data, loading, refetch } = useApi<ComplianceApiResponse>({
    url: `/api/account/compliance?status=${tab}&page=${page}&page_size=${PAGE_SIZE}`,
    fallback: COMPLIANCE_FALLBACK,
  });

  const [auditing, setAuditing] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<ComplianceFlag | null>(null);
  const [notes, setNotes] = useState("");
  const [resolving, setResolving] = useState(false);
  const { toast, showToast } = useToast();

  const openCount = data.open_count;
  const resolvedCount = Math.max(0, data.total_count - data.open_count);
  const tabCount = tab === "open" ? openCount : resolvedCount;
  const totalPages = Math.max(1, Math.ceil(tabCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  // Snap back into range when resolving items shrinks the active tab below
  // the current page index (e.g., user resolves the last row on page 3).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function changeTab(next: string) {
    if (next !== "open" && next !== "resolved") return;
    if (next === tab) return;
    setTab(next);
    setPage(1);
  }

  async function handleSelfAudit() {
    setAuditing(true);
    try {
      const res = await fetch("/api/account/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "self-audit" }),
      });
      if (res.ok) {
        if (tab !== "open") setTab("open");
        setPage(1);
        refetch();
      } else {
        const body = await res.json().catch(() => null);
        showToast(body?.error?.message ?? `Self-audit failed (${res.status})`);
      }
    } catch {
      showToast("Network error: could not reach the server");
    } finally {
      setAuditing(false);
    }
  }

  function openResolve(flag: ComplianceFlag) {
    setResolveTarget(flag);
    setNotes("");
  }

  function closeResolve() {
    if (resolving) return;
    setResolveTarget(null);
    setNotes("");
  }

  async function handleResolve() {
    if (!resolveTarget) return;
    const trimmed = notes.trim();
    if (trimmed.length === 0) {
      showToast("Resolution notes are required");
      return;
    }
    setResolving(true);
    try {
      const res = await fetch(
        `/api/account/compliance/flags/${resolveTarget.flag_id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: trimmed }),
        },
      );
      if (res.ok) {
        setResolveTarget(null);
        setNotes("");
        refetch();
      } else {
        const body = await res.json().catch(() => null);
        showToast(body?.error?.message ?? `Resolve failed (${res.status})`);
      }
    } catch {
      showToast("Network error: could not reach the server");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          {toast}
        </div>
      )}
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-slate mb-1">Open Flags</p>
          <p className="text-3xl font-bold text-problem">{openCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate mb-1">Total Flags</p>
          <p className="text-3xl font-bold text-navy">{data.total_count}</p>
        </Card>
      </div>

      {/* Flags Table */}
      <Card title="Compliance Flags">
        <div className="flex items-end justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0">
            <Tabs
              tabs={[
                { key: "open", label: "Open", count: openCount },
                { key: "resolved", label: "Resolved", count: resolvedCount },
              ]}
              active={tab}
              onChange={changeTab}
            />
          </div>
          <button
            onClick={handleSelfAudit}
            disabled={auditing}
            className="shrink-0 mb-6 px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            {auditing ? "Running..." : "Run Self-Audit"}
          </button>
        </div>

        {data.flags.length === 0 ? (
          <p className="text-sm text-slate py-8 text-center">
            {loading
              ? "Loading compliance data..."
              : tab === "open"
                ? "No open compliance flags."
                : "No resolved flags yet."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate border-b border-slate/15">
                    <th className="pb-3 font-medium">Vendor</th>
                    <th className="pb-3 font-medium">Product</th>
                    <th className="pb-3 font-medium">Reason Code</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Detected</th>
                    <th className="pb-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.flags.map((f) => (
                    <tr key={f.flag_id} className="border-b border-slate/10 hover:bg-gray-50">
                      <td className="py-3 text-navy font-medium">
                        {f.reason_code === "vendor_not_on_network"
                          ? "Unknown"
                          : f.vendor_name ?? f.flagged_vendor_id}
                      </td>
                      <td className="py-3 text-charcoal font-mono text-xs">{f.external_product_id ?? "—"}</td>
                      <td className="py-3 text-charcoal font-mono text-xs">{f.reason_code}</td>
                      <td className="py-3">
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="py-3 text-slate">{f.detected_at}</td>
                      <td className="py-3 text-right">
                        {f.status === "open" ? (
                          <button
                            onClick={() => openResolve(f)}
                            className="px-3 py-1 bg-teal text-white text-xs font-medium rounded hover:bg-teal-dark transition-colors"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-xs text-slate">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate/10">
              <p className="text-xs text-slate">
                Page {safePage} of {totalPages} · {tabCount} {tab === "open" ? "open" : "resolved"} flag{tabCount === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1 text-xs font-medium text-charcoal border border-slate/25 rounded hover:bg-slate/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1 text-xs font-medium text-charcoal border border-slate/25 rounded hover:bg-slate/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={resolveTarget !== null}
        onClose={closeResolve}
        title="Resolve compliance flag"
      >
        {resolveTarget && (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <p className="text-slate">
                Reason: <span className="font-mono text-xs text-charcoal">{resolveTarget.reason_code}</span>
              </p>
              <p className="text-slate">
                Product: <span className="font-mono text-xs text-charcoal">{resolveTarget.external_product_id ?? "—"}</span>
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="resolve-notes" className="block text-sm font-medium text-charcoal">
                Resolution notes
              </label>
              <textarea
                id="resolve-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={resolving}
                rows={5}
                maxLength={4000}
                placeholder="Describe how this flag was resolved (required)."
                className="w-full rounded-lg border border-slate/25 px-3 py-2 text-sm text-charcoal focus:border-teal focus:outline-none disabled:opacity-50"
              />
              <p className="text-xs text-slate">{notes.length} / 4000</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeResolve}
                disabled={resolving}
                className="px-4 py-2 text-sm font-medium text-charcoal rounded-lg hover:bg-slate/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving || notes.trim().length === 0}
                className="px-4 py-2 bg-teal text-white text-sm font-medium rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
              >
                {resolving ? "Resolving..." : "Resolve"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
