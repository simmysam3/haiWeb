"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/card";
import { useApi } from "@/lib/use-api";

const MAX_VISIBLE = 20;

/** A single in-app notification (haiCore notifications table shape). */
export interface NotificationRow {
  id: string;
  class: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

/** entity_approval payload (Task 15 builds to this exact shape; read defensively). */
interface EntityApprovalPayload {
  counterparty_name?: string;
  decision?: string;
  tier_label?: string;
  decided_by?: string;
  outstanding_element_labels?: string[];
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

function NotificationBody({ n }: { n: NotificationRow }) {
  if (n.class === "entity_approval") {
    const p = n.payload as EntityApprovalPayload;
    const name = str(p.counterparty_name) ?? "A counterparty";
    const approved = p.decision === "approved";
    const tier = str(p.tier_label);
    const by = str(p.decided_by);
    const labels = Array.isArray(p.outstanding_element_labels)
      ? p.outstanding_element_labels.filter((l): l is string => typeof l === "string")
      : [];
    return (
      <>
        <p className="text-sm text-charcoal">
          <span className="font-medium">{name}</span>
          {approved ? (
            <> — Approved{tier ? ` to ${tier}` : ""}</>
          ) : (
            <> — Revoked{tier ? ` from ${tier}` : ""}</>
          )}
          {by ? ` by ${by}` : ""}
        </p>
        {!approved && labels.length > 0 && (
          <p className="text-xs text-slate">Outstanding: {labels.join(", ")}</p>
        )}
      </>
    );
  }
  // Forward-compatible fallback for classes the UI doesn't model yet.
  return <p className="text-sm text-charcoal">{n.class}</p>;
}

export function NotificationsPanel() {
  // haiCore (passed through the BFF verbatim) wraps the list:
  // `{ notifications: [...] }` — never a bare array.
  const { data, loading, error } = useApi<{ notifications?: NotificationRow[] }>({
    url: "/api/account/notifications",
    fallback: {},
  });
  const rows = Array.isArray(data.notifications) ? data.notifications : [];

  // Locally-tracked read ids so a click de-emphasizes optimistically without
  // waiting for a refetch; reverted if the POST fails.
  const [localRead, setLocalRead] = useState<Record<string, boolean>>({});

  // Reset local overrides whenever a fresh server list arrives.
  useEffect(() => {
    setLocalRead({});
  }, [data]);

  async function markRead(n: NotificationRow) {
    if (n.read_at || localRead[n.id]) return;
    setLocalRead((prev) => ({ ...prev, [n.id]: true }));
    try {
      const res = await fetch(`/api/account/notifications/${n.id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("read failed");
    } catch {
      setLocalRead((prev) => ({ ...prev, [n.id]: false }));
    }
  }

  const visible = rows.slice(0, MAX_VISIBLE);

  return (
    <Card title="Notifications">
      {loading ? (
        <p className="text-sm text-slate py-4">Loading…</p>
      ) : error ? (
        <p className="text-sm text-problem py-4">Couldn&apos;t load your notifications.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate py-4">No notifications.</p>
      ) : (
        <div className="space-y-1">
          {visible.map((n) => {
            const unread = !n.read_at && !localRead[n.id];
            return (
              <button
                key={n.id}
                type="button"
                data-testid={`notif-${n.id}`}
                data-unread={unread ? "true" : "false"}
                onClick={() => markRead(n)}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-light-gray/40 ${
                  unread ? "bg-teal/5" : ""
                }`}
              >
                {unread ? (
                  <span aria-hidden className="mt-1.5 h-2 w-2 flex-none rounded-full bg-teal" />
                ) : (
                  <span aria-hidden className="mt-1.5 h-2 w-2 flex-none" />
                )}
                <span className={`flex-1 ${unread ? "font-medium" : ""}`}>
                  <NotificationBody n={n} />
                  <span className="mt-0.5 block text-xs text-slate">{formatDate(n.created_at)}</span>
                </span>
              </button>
            );
          })}
          {rows.length > MAX_VISIBLE && (
            <p className="pt-2 text-xs text-slate">Showing latest 20 of {rows.length}.</p>
          )}
        </div>
      )}
    </Card>
  );
}
