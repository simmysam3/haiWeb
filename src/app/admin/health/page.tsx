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

const MOCK_HEALTH: NetworkHealth = {
  agent_uptime_pct: 97.2,
  agents_jailed: 1,
  agents_probation: 0,
  heartbeat_success_rate: 97.2,
  avg_response_time_ms: 0,
  narrowing_completion_rate: 84.5,
  rma_volume_30d: 3,
  agents_healthy: 8,
  agents_quiet: 1,
  agents_unreachable: 1,
  agents_not_deployed: 0,
};

export default function HealthPage() {
  const [data, setData] = useState<NetworkHealth>(MOCK_HEALTH);

  useEffect(() => {
    fetch("/api/admin/dashboard?type=health")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Network Health"
        description="Agent fleet operational status and performance metrics."
      />

      {/* P7c (ruled): the derived availability taxonomy. Suspended is the
          administrative jailed count (P3: status is a decision). The
          probe-era cards — Heartbeat Success, Agents Probation, uptime from
          administrative status, the constant-zero response time — retired
          with their machine. `null` renders "Not Available" (older haiCore
          without the additive fields) rather than a fabricated zero. */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard label="Healthy" value={data.agents_healthy?.toString() ?? null} color="text-success" />
        <StatCard label="Quiet" value={data.agents_quiet?.toString() ?? null} color={(data.agents_quiet ?? 0) > 0 ? "text-warning" : "text-success"} />
        <StatCard label="Unreachable" value={data.agents_unreachable?.toString() ?? null} color={(data.agents_unreachable ?? 0) > 0 ? "text-problem" : "text-success"} />
        <StatCard label="Suspended" value={data.agents_jailed.toString()} color={data.agents_jailed > 0 ? "text-warning" : "text-success"} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Narrowing Completion">
          <div className="text-3xl font-bold text-navy">{data.narrowing_completion_rate.toFixed(1)}%</div>
          <p className="text-xs text-slate mt-1">Sessions completed vs. abandoned</p>
        </Card>
        <Card title="RMA Volume (30d)">
          <div className="text-3xl font-bold text-navy">{data.rma_volume_30d}</div>
          <p className="text-xs text-slate mt-1">Return merchandise authorizations</p>
        </Card>
      </div>
    </div>
  );
}
