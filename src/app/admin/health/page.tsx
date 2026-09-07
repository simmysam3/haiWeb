"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { StatCard } from "@/components/stat-card";

/**
 * The haiCore NetworkHealth payload. The probe-era fields still arrive on
 * the wire (additive-only contract) but the cards below read the broker-P3
 * DERIVED availability split (agents_healthy/quiet/unreachable, optional
 * from an older haiCore) plus the administrative suspended count.
 */
interface NetworkHealth {
  agent_uptime_pct: number;
  agents_jailed: number;
  agents_probation: number;
  heartbeat_success_rate: number;
  avg_response_time_ms: number;
  narrowing_completion_rate: number;
  rma_volume_30d: number;
  agents_healthy?: number;
  agents_quiet?: number;
  agents_unreachable?: number;
  agents_not_deployed?: number;
}

export default function HealthPage() {
  // Absence surfaces as absence (admin-dashboard.tsx): no seeded fleet numbers;
  // a failed read is a visible notice and every value shows as absent
  // (SEC-web-admin-ops-1-05).
  const [data, setData] = useState<NetworkHealth | null>(null);
  // HTTP status of a refused read; 0 = the server could not be reached.
  const [loadError, setLoadError] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/dashboard?type=health")
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          setLoadError(r.status);
          setData(null);
          return;
        }
        setLoadError(null);
        setData((await r.json()) as NetworkHealth);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(0);
          setData(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Network Health"
        description="Agent fleet operational status and performance metrics."
      />

      {loadError !== null && (
        <div role="alert" className="bg-problem/5 border border-problem/20 rounded-lg px-4 py-3 text-sm text-problem">
          Couldn&apos;t load network health — {loadError === 0 ? "the server could not be reached" : `haiCore answered ${loadError}`}. Cards show absence, not a fleet.
        </div>
      )}
      {/* P7c (ruled): the derived availability taxonomy. Suspended is the
          administrative jailed count (P3: status is a decision). The
          probe-era cards — Heartbeat Success, Agents Probation, uptime from
          administrative status, the constant-zero response time — retired
          with their machine. `null` renders "Not Available" (older haiCore
          without the additive fields) rather than a fabricated zero. */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard label="Healthy" value={data?.agents_healthy?.toString() ?? null} color="text-success" />
        <StatCard label="Quiet" value={data?.agents_quiet?.toString() ?? null} color={(data?.agents_quiet ?? 0) > 0 ? "text-warning" : "text-success"} />
        <StatCard label="Unreachable" value={data?.agents_unreachable?.toString() ?? null} color={(data?.agents_unreachable ?? 0) > 0 ? "text-problem" : "text-success"} />
        <StatCard label="Suspended" value={data?.agents_jailed.toString() ?? null} color={(data?.agents_jailed ?? 0) > 0 ? "text-warning" : "text-success"} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Narrowing Completion">
          <div className="text-3xl font-bold text-navy">{data ? `${data.narrowing_completion_rate.toFixed(1)}%` : "—"}</div>
          <p className="text-xs text-slate mt-1">Sessions completed vs. abandoned</p>
        </Card>
        <Card title="RMA Volume (30d)">
          <div className="text-3xl font-bold text-navy">{data?.rma_volume_30d ?? "—"}</div>
          <p className="text-xs text-slate mt-1">Return merchandise authorizations</p>
        </Card>
      </div>
    </div>
  );
}
