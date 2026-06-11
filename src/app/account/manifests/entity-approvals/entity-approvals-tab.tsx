"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { ApprovalsQueue, type EntityApprovalQueueRow } from "./approvals-queue";

/**
 * Owns the Entity Approvals tab's queue ⇄ review switch. The review wizard
 * lands in Task 10; for now selecting a row (or "Approve a company") shows a
 * placeholder panel with a back affordance.
 */
export function EntityApprovalsTab() {
  const [selected, setSelected] = useState<EntityApprovalQueueRow | null>(null);
  const [proactive, setProactive] = useState(false);

  if (selected || proactive) {
    return (
      <Card>
        <div className="space-y-3 py-4">
          <p className="text-sm font-medium text-charcoal">
            {selected ? `Review — ${selected.counterparty.name}` : "Approve a company"}
          </p>
          <p className="text-sm text-slate">
            The review wizard is coming in the next step.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelected(null);
              setProactive(false);
            }}
          >
            Back to queue
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <ApprovalsQueue
      onReview={(row) => setSelected(row)}
      onProactive={() => setProactive(true)}
    />
  );
}
