"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import { StatCard } from "@/components/stat-card";

interface NetworkHealth {
  agent_uptime_pct: number;
  agents_jailed: number;
  agents_probation: number;
  heartbeat_success_rate: number;
  avg_response_time_ms: number;
  narrowing_completion_rate: number;
  rma_volume_30d: number;
}

const MOCK_HEALTH: NetworkHealth = {
  agent_uptime_pct: 97.2,
  agents_jailed: 1,
  agents_probation: 2,
  heartbeat_success_rate: 98.1,
  avg_response_time_ms: 245,
  narrowing_completion_rate: 84.5,
  rma_volume_30d: 3,
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

      <div className="grid grid-cols-4 gap-6">
        <StatCard label="Agent Uptime" value={`${data.agent_uptime_pct.toFixed(1)}%`} color={data.agent_uptime_pct >= 95 ? "text-success" : "text-warning"} />
        <StatCard label="Heartbeat Success" value={`${data.heartbeat_success_rate.toFixed(1)}%`} color="text-success" />
        <StatCard label="Agents Jailed" value={data.agents_jailed.toString()} color={data.agents_jailed > 0 ? "text-problem" : "text-success"} />
        <StatCard label="Agents Probation" value={data.agents_probation.toString()} color={data.agents_probation > 0 ? "text-warning" : "text-success"} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card title="Avg Response Time">
          <div className="text-3xl font-bold text-navy">{data.avg_response_time_ms}ms</div>
          <p className="text-xs text-slate mt-1">Mean heartbeat response</p>
        </Card>
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
