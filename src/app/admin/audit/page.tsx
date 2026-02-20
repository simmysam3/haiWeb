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

const MOCK_AUDIT: AuditResponse = {
  events: [
    { id: "1", event_type: "connection.approved", actor_id: "system", actor_type: "system", participant_id: null, action: "auto_approved_bulk_criteria", timestamp: new Date().toISOString(), retention_class: "standard" },
    { id: "2", event_type: "admin.suspend", actor_id: "admin-1", actor_type: "admin", participant_id: "p-1", action: "suspended_account", timestamp: new Date(Date.now() - 86400000).toISOString(), retention_class: "critical" },
    { id: "3", event_type: "connection.blocked", actor_id: "p-2", actor_type: "participant", participant_id: "p-3", action: "blocked_participant", timestamp: new Date(Date.now() - 172800000).toISOString(), retention_class: "standard" },
  ],
  total: 3,
  page: 1,
  page_size: 50,
};

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse>(MOCK_AUDIT);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (eventTypeFilter) params.set("event_type", eventTypeFilter);

    fetch(`/api/admin/audit?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, [page, eventTypeFilter]);

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Log"
        description="Searchable, filterable audit event viewer."
      />

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
