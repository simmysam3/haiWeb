"use client";

import Link from "next/link";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { IdChip } from "@/components/id-chip";
import type { MockAgent } from "@/lib/mock-types";

function heartbeatAgeMinutes(lastHeartbeat: string): number | null {
  if (!lastHeartbeat) return null;
  const diffMs = Date.now() - new Date(lastHeartbeat).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function formatHeartbeat(agent: MockAgent): string {
  if (!agent.last_heartbeat) return "Never";
  const mins = heartbeatAgeMinutes(agent.last_heartbeat);
  if (mins === null) return "Never";
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function failureColor(count: number): string {
  if (count === 0) return "text-success";
  if (count < 3) return "text-warning";
  return "text-problem";
}

export function AgentHealthPanel() {
  // No portal endpoint lists a participant's real agents yet, so this reports
  // an empty fleet rather than fabricating demo agents. Wire a real "list my
  // agents" BFF route here when it exists.
  const agents: MockAgent[] = [];
  const activeCount = agents.filter((a) => a.status === "active").length;
  const impairedCount = agents.filter((a) => a.status !== "active").length;

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate mb-1">Deployed</p>
          <p className="text-2xl font-semibold text-navy">{agents.length}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate mb-1">Active</p>
          <p className="text-2xl font-semibold text-success">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-slate mb-1">Needs attention</p>
          <p className={`text-2xl font-semibold ${impairedCount > 0 ? "text-warning" : "text-slate"}`}>
            {impairedCount}
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        {agents.length === 0 && (
          <Card>
            <div className="text-center py-8 max-w-md mx-auto">
              <p className="text-sm font-medium text-charcoal mb-1">
                No agents to report on yet
              </p>
              <p className="text-sm text-slate mb-5">
                Once you deploy an agent it will report heartbeat and status
                here. Get started by downloading the client and configuration
                guide.
              </p>
              <Link
                href="/account/agent-software"
                className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm"
              >
                Get the client &amp; configuration guide
              </Link>
            </div>
          </Card>
        )}
        {agents.map((agent) => {
          const enabledTypes = agent.types.filter((t) => t.enabled);
          return (
            <Card key={agent.id}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <IdChip id={agent.id} className="text-sm" />
                  <p className="text-xs text-slate mt-0.5">
                    {enabledTypes.length > 0
                      ? enabledTypes.map((t) => t.label).join(" · ")
                      : "No enabled agent types"}
                  </p>
                </div>
                <StatusBadge status={agent.status} />
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate mb-1">Last heartbeat</p>
                  <p className="text-charcoal">{formatHeartbeat(agent)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate mb-1">Consecutive failures</p>
                  <p className={failureColor(agent.consecutive_failures)}>
                    {agent.consecutive_failures}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate mb-1">Deployed</p>
                  <p className="text-charcoal">{new Date(agent.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate">
        Provisioning, key rotation, and decommission actions live under{" "}
        <Link href="/account/agents" className="text-teal-dark hover:underline">
          Account Management → Agents
        </Link>
        .
      </p>
    </>
  );
}
