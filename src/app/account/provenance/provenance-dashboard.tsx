"use client";

import { Card } from "@/components/card";
import { ManifestsTab } from "./manifests-tab";

// Certifications tab was suppressed pending clarification on what it
// represents. To restore: re-add the <Tabs> control, the certifications
// branch, and the useApi fetch of /api/account/provenance — full prior
// implementation is at git show <commit-before-this-one>:src/app/account/provenance/provenance-dashboard.tsx.
export function ProvenanceDashboard() {
  return (
    <div className="space-y-6">
      <Card>
        <ManifestsTab />
      </Card>
    </div>
  );
}
