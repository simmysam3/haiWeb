import Link from "next/link";
import { Card } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { IdChip } from "@/components/id-chip";
import type { MockAgent } from "@/lib/mock-types";

/**
 * Agents are provisioned out-of-band (the operator runs the agent client on
 * their own infrastructure with keys from the configuration guide). There is no
 * portal endpoint yet that lists a participant's real agents, so this renders an
 * empty state for every account rather than fabricating demo agents or issuing
 * fake credentials. When a real "list my agents" BFF route exists, pass its
 * result in as `agents` and the read-only list below renders it.
 */
export function AgentsPanel({ agents = [] }: { agents?: MockAgent[] }) {
  if (agents.length === 0) {
    return (
      <Card>
        <div className="text-center py-8 max-w-md mx-auto">
          <p className="text-sm font-medium text-charcoal mb-1">
            No agents provisioned yet
          </p>
          <p className="text-sm text-slate mb-5">
            HAIWAVE agents run on your own infrastructure. Download the agent
            client and follow the configuration guide — it walks you through
            getting your agent keys and connecting to the network.
          </p>
          <Link
            href="/account/agent-software"
            className="inline-flex items-center justify-center font-medium rounded-lg transition-colors bg-navy text-white hover:bg-charcoal px-4 py-2.5 text-sm"
          >
            Get the client &amp; configuration guide
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {agents.map((agent) => (
        <Card key={agent.id}>
          <div className="flex items-start justify-between">
            <div>
              <IdChip id={agent.id} className="text-sm" />
              <p className="text-xs text-slate mt-0.5">
                Created {new Date(agent.created_at).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={agent.status} />
          </div>
        </Card>
      ))}
    </div>
  );
}
