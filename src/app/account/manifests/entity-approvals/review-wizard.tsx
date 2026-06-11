"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { StepRail, type RailStep } from "@/app/account/sonar/_components/step-rail";
import { StepCard } from "@/app/account/sonar/_components/step-card";
import { useApi } from "@/lib/use-api";
import type { LibraryTier, Scorecard } from "@/lib/library-types";
import type { EntityApprovalQueueRow } from "./approvals-queue";
import { ScorecardTable } from "./scorecard-table";

const DEFAULT_TIER: LibraryTier = "connection";

/**
 * Build the scorecard fetch URL. The request path is used when the row carries a
 * request_id; the counterparty (proactive) path lands in Task 14.
 */
function scorecardUrl(row: EntityApprovalQueueRow, tier: LibraryTier): string {
  if (row.request_id) {
    return `/api/account/entity-approvals/${row.request_id}/scorecard?tier=${tier}`;
  }
  return `/api/account/entity-approvals/counterparty/${row.counterparty.id}/scorecard?tier=${tier}`;
}

interface Props {
  row: EntityApprovalQueueRow;
  onClose: () => void;
  onDecided: () => void;
}

export function ReviewWizard({ row, onClose, onDecided: _onDecided }: Props) {
  // Tier state drives the scorecard; the picker lands in Task 11 (Decision step).
  const [tier] = useState<LibraryTier>(DEFAULT_TIER);
  const [active, setActive] = useState("requirements");

  const { data: scorecard, loading, error } = useApi<Scorecard | null>({
    url: scorecardUrl(row, tier),
    fallback: null,
  });

  const steps: RailStep[] = [
    { id: "requirements", label: "Requirements review", state: active === "requirements" ? "active" : "done" },
    { id: "decision", label: "Decision", state: active === "decision" ? "active" : "todo" },
    { id: "confirm", label: "Confirm", state: active === "confirm" ? "active" : "todo" },
  ];

  function jump(id: string) {
    setActive(id);
    const el = document.getElementById(`step-${id}`);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-charcoal">Review — {row.counterparty.name}</p>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Back to queue
        </Button>
      </div>

      <div className="flex gap-6">
        <div className="pt-1">
          <StepRail steps={steps} onJump={jump} />
        </div>

        <div className="flex-1 max-w-3xl space-y-4">
          <StepCard id="requirements" index={0} title="Requirements review">
            {loading ? (
              <p className="text-sm text-slate py-6 text-center">Loading scorecard…</p>
            ) : error || !scorecard ? (
              <p className="text-sm text-problem py-6 text-center">
                Couldn&apos;t load the scorecard. Try again.
              </p>
            ) : (
              <ScorecardTable ownerId={row.counterparty.id} scorecard={scorecard} />
            )}
          </StepCard>

          <StepCard id="decision" index={1} title="Decision">
            <Card>
              <p className="text-sm text-slate py-4 text-center">
                Tier picker and reasoning land in the next step.
              </p>
            </Card>
          </StepCard>

          <StepCard id="confirm" index={2} title="Confirm">
            <Card>
              <p className="text-sm text-slate py-4 text-center">
                The decision summary and notification preview land in the next step.
              </p>
            </Card>
          </StepCard>
        </div>
      </div>
    </div>
  );
}
