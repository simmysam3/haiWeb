"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";

interface AuditEvent {
  id: string;
  event_type: string;
  actor_id: string;
  actor_type: string;
  participant_id: string | null;
  action: string;
  timestamp: string;
  retention_class: string;
}

interface AuditResponse {
  events: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
}

// Absence surfaces as absence (admin-dashboard.tsx): the page starts empty and
// a failed read is a visible notice — never seeded rows standing in for the
// network's audit trail (SEC-web-admin-ops-1-05).
const EMPTY: AuditResponse = { events: [], total: 0, page: 1, page_size: 50 };

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse>(EMPTY);
  // HTTP status of a refused read; 0 = the server could not be reached.
  const [loadError, setLoadError] = useState<number | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (eventTypeFilter) params.set("event_type", eventTypeFilter);
    let cancelled = false;

    fetch(`/api/admin/audit?${params}`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(r.status);
          setData(EMPTY);
          return;
        }
        setLoadError(null);
        setData((await r.json()) as AuditResponse);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(0);
          setData(EMPTY);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, eventTypeFilter]);

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Log"
        description="Searchable, filterable audit event viewer."
      />

      {loadError !== null && (
        <div role="alert" className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          Couldn&apos;t load the audit log — {loadError === 0 ? "the server could not be reached" : `haiCore answered ${loadError}`}. Nothing below is a record.
        </div>
      )}
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <select
            value={eventTypeFilter}
            onChange={(e) => { setEventTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate/20 rounded-lg text-sm bg-white text-charcoal"
          >
            <option value="">All Event Types</option>
            <option value="connection.approved">Connection Approved</option>
            <option value="connection.blocked">Connection Blocked</option>
            <option value="connection.unblocked">Connection Unblocked</option>
            <option value="admin.suspend">Admin Suspend</option>
            <option value="admin.reactivate">Admin Reactivate</option>
            <option value="admin.clear_ban">Admin Clear Ban</option>
            <option value="admin.override_tier">Admin Override Tier</option>
            <option value="admin.override_score">Admin Override Score</option>
          </select>
          <span className="text-sm text-slate">{data.total} events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate/15">
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Timestamp</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Event Type</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Actor</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Action</th>
                <th className="text-left text-xs font-medium uppercase tracking-wider text-slate py-3 px-4">Retention</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.id} className="border-b border-slate/10 hover:bg-light-gray/50">
                  <td className="py-3 px-4 text-slate font-mono text-xs">{new Date(e.timestamp).toLocaleString()}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-navy/5 text-navy text-xs rounded font-mono">{e.event_type}</span>
                  </td>
                  <td className="py-3 px-4 text-slate">
                    <span className="text-xs">{e.actor_type}</span>
                    <span className="text-charcoal ml-1">{e.actor_id.slice(0, 8)}</span>
                  </td>
                  <td className="py-3 px-4 text-charcoal">{e.action}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={e.retention_class === "critical" ? "suspended" : "active"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate/10">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm text-slate">Page {page} of {totalPages}</span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
