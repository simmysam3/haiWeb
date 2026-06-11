"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { ApprovalsQueue, type EntityApprovalQueueRow } from "./approvals-queue";
import { ReviewWizard } from "./review-wizard";

/**
 * Owns the Entity Approvals tab's queue ⇄ review switch. Selecting a row opens
 * the review wizard; the proactive "Approve a company" flow lands in Task 14
 * (placeholder panel for now).
 */
export function EntityApprovalsTab() {
  const [selected, setSelected] = useState<EntityApprovalQueueRow | null>(null);
  const [proactive, setProactive] = useState(false);

  function backToQueue() {
    setSelected(null);
    setProactive(false);
  }

  if (selected) {
    return <ReviewWizard row={selected} onClose={backToQueue} onDecided={backToQueue} />;
  }

  if (proactive) {
    return (
      <Card>
        <div className="space-y-3 py-4">
          <p className="text-sm font-medium text-charcoal">Approve a company</p>
          <p className="text-sm text-slate">Counterparty search lands in the next step.</p>
          <Button size="sm" variant="secondary" onClick={backToQueue}>
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
